import {
  ConflictException,
  NotFoundException,
  NotImplementedException,
} from '@nestjs/common';
import { Prisma, StatusApuracao, TipoRegimeContabil } from '@prisma/client';
import { ApuracaoService } from './apuracao.service';

/**
 * D-novo-BR-CT CT.4 (31/05/2026) — Specs do motor de apuração.
 *
 * Cobre:
 *  - Agregação correta por natureza (PROPRIO/AUXILIAR/NAO_COOPERATIVO)
 *  - Fundos Lei 5.764/71 Art. 28 (FR 10% + FATES 5%)
 *  - Sobras isentas / Resultado não-coop tributado
 *  - Flag isencaoPisCofinsAtiva controla PIS/COFINS próprio (P0-4)
 *  - Alíquotas configuráveis (preview usa defaults se não há config)
 *  - Snapshot imutável (fechar 2x → 409)
 *  - validadoContador nasce false (GATE WALTER)
 *  - Bloqueio retroativo (lançamento em mês FECHADA bloqueado)
 *  - validarApuracao + reabrir
 *  - Regimes não-coop → NotImplementedException
 */
describe('ApuracaoService — CT.4', () => {
  const findCoop = jest.fn();
  const findConfig = jest.fn();
  const findLanc = jest.fn();
  const findApur = jest.fn();
  const createApur = jest.fn();
  const updateApur = jest.fn();

  const prismaMock = {
    cooperativa: { findUnique: findCoop },
    configuracaoTributaria: { findUnique: findConfig },
    lancamentoCaixa: { findMany: findLanc },
    apuracaoMensalSegregada: {
      findUnique: findApur,
      create: createApur,
      update: updateApur,
    },
  } as any;

  let service: ApuracaoService;

  const coopCooperativo = {
    id: 'coop-A',
    nome: 'Coop Teste',
    regimeContabil: TipoRegimeContabil.COOPERATIVO,
    isencaoPisCofinsAtiva: true,
  };

  beforeEach(() => {
    jest.clearAllMocks();
    service = new ApuracaoService(prismaMock);
    findConfig.mockResolvedValue(null); // usa defaults
  });

  // ============================================================
  // apurarMes — preview
  // ============================================================

  describe('apurarMes — preview', () => {
    it('mês inválido → 409', async () => {
      await expect(service.apurarMes('coop-A', 2026, 13)).rejects.toThrow(ConflictException);
      await expect(service.apurarMes('coop-A', 2026, 0)).rejects.toThrow(ConflictException);
    });

    it('cooperativa inexistente → 404', async () => {
      findCoop.mockResolvedValueOnce(null);
      await expect(service.apurarMes('coop-X', 2026, 5)).rejects.toThrow(NotFoundException);
    });

    it.each([
      TipoRegimeContabil.CONSORCIO_PROPORCIONAL,
      TipoRegimeContabil.ASSOCIACAO_SEM_FINS_LUCRATIVOS,
      TipoRegimeContabil.CONDOMINIO_EDILICIO,
    ])('regime %s → NotImplementedException (P0-1)', async (regime) => {
      findCoop.mockResolvedValueOnce({ ...coopCooperativo, regimeContabil: regime });
      await expect(service.apurarMes('coop-A', 2026, 5)).rejects.toThrow(
        NotImplementedException,
      );
    });

    it('agrega receitas/despesas por natureza corretamente', async () => {
      findCoop.mockResolvedValueOnce(coopCooperativo);
      findLanc.mockResolvedValueOnce([
        { tipo: 'RECEITA', valor: new Prisma.Decimal(1000), naturezaAto: 'PROPRIO' },
        { tipo: 'RECEITA', valor: new Prisma.Decimal(500), naturezaAto: 'PROPRIO' },
        { tipo: 'DESPESA', valor: new Prisma.Decimal(200), naturezaAto: 'PROPRIO' },
        { tipo: 'RECEITA', valor: new Prisma.Decimal(300), naturezaAto: 'AUXILIAR' },
        { tipo: 'RECEITA', valor: new Prisma.Decimal(400), naturezaAto: 'NAO_COOPERATIVO' },
        { tipo: 'DESPESA', valor: new Prisma.Decimal(100), naturezaAto: 'NAO_COOPERATIVO' },
      ]);
      const r = await service.apurarMes('coop-A', 2026, 5);
      expect(r.receitaPropria.toString()).toBe('1500');
      expect(r.despesaPropria.toString()).toBe('200');
      expect(r.receitaAuxiliar.toString()).toBe('300');
      expect(r.receitaNaoCoop.toString()).toBe('400');
      expect(r.despesaNaoCoop.toString()).toBe('100');
      expect(r.sobrasBrutas.toString()).toBe('1300'); // 1500 - 200
      expect(r.resultadoNaoCoop.toString()).toBe('300'); // 400 - 100
    });

    it('flag isencaoPisCofinsAtiva=true zera PIS/COFINS sobre receita PRÓPRIA (P0-4 STF Tema 536)', async () => {
      findCoop.mockResolvedValueOnce({ ...coopCooperativo, isencaoPisCofinsAtiva: true });
      findLanc.mockResolvedValueOnce([
        { tipo: 'RECEITA', valor: new Prisma.Decimal(10000), naturezaAto: 'PROPRIO' },
      ]);
      const r = await service.apurarMes('coop-A', 2026, 5);
      expect(r.pisDevido.toString()).toBe('0'); // não incide sobre próprio
      expect(r.cofinsDevido.toString()).toBe('0');
      expect(r.fundamentoIsencao).toContain('STF Tema 536');
    });

    it('flag isencaoPisCofinsAtiva=false → PIS/COFINS calculados sobre próprio', async () => {
      findCoop.mockResolvedValueOnce({ ...coopCooperativo, isencaoPisCofinsAtiva: false });
      findLanc.mockResolvedValueOnce([
        { tipo: 'RECEITA', valor: new Prisma.Decimal(10000), naturezaAto: 'PROPRIO' },
      ]);
      const r = await service.apurarMes('coop-A', 2026, 5);
      // PIS 0,65% × 10000 = 65; COFINS 3% × 10000 = 300
      expect(r.pisDevido.toString()).toBe('65');
      expect(r.cofinsDevido.toString()).toBe('300');
      expect(r.fundamentoIsencao).toBeNull();
    });

    it('PIS/COFINS sobre receita NÃO-COOP SEMPRE incidem (não há isenção)', async () => {
      findCoop.mockResolvedValueOnce({ ...coopCooperativo, isencaoPisCofinsAtiva: true });
      findLanc.mockResolvedValueOnce([
        { tipo: 'RECEITA', valor: new Prisma.Decimal(1000), naturezaAto: 'NAO_COOPERATIVO' },
      ]);
      const r = await service.apurarMes('coop-A', 2026, 5);
      expect(r.pisDevido.toString()).toBe('6.5'); // 0,65% × 1000
      expect(r.cofinsDevido.toString()).toBe('30'); // 3% × 1000
    });

    it('IRPJ/CSLL apenas sobre resultado NÃO-COOP (sobras próprias isentas RIR/2018 Art. 182)', async () => {
      findCoop.mockResolvedValueOnce(coopCooperativo);
      findLanc.mockResolvedValueOnce([
        // Próprio gera sobras 5000 — isentas IRPJ/CSLL
        { tipo: 'RECEITA', valor: new Prisma.Decimal(8000), naturezaAto: 'PROPRIO' },
        { tipo: 'DESPESA', valor: new Prisma.Decimal(3000), naturezaAto: 'PROPRIO' },
        // Não-coop resultado 1000
        { tipo: 'RECEITA', valor: new Prisma.Decimal(2000), naturezaAto: 'NAO_COOPERATIVO' },
        { tipo: 'DESPESA', valor: new Prisma.Decimal(1000), naturezaAto: 'NAO_COOPERATIVO' },
      ]);
      const r = await service.apurarMes('coop-A', 2026, 5);
      // Base presumida IRPJ: 32% × 1000 = 320 → IRPJ 15% × 320 = 48
      expect(r.irpjDevido.toString()).toBe('48');
      // Base presumida CSLL: 32% × 1000 = 320 → CSLL 9% × 320 = 28.8
      expect(r.csllDevido.toString()).toBe('28.8');
    });

    it('IRPJ adicional 10% quando base presumida > R$ 20.000/mês', async () => {
      findCoop.mockResolvedValueOnce(coopCooperativo);
      findLanc.mockResolvedValueOnce([
        // Resultado não-coop 100000 → base 32% = 32000 (>20000)
        { tipo: 'RECEITA', valor: new Prisma.Decimal(100000), naturezaAto: 'NAO_COOPERATIVO' },
      ]);
      const r = await service.apurarMes('coop-A', 2026, 5);
      // IRPJ base: 15% × 32000 = 4800
      // Adicional: 10% × (32000 - 20000) = 1200
      // Total: 6000
      expect(r.irpjDevido.toString()).toBe('6000');
    });

    it('fundos Lei 5.764/71 Art. 28: FR 10% + FATES 5% das sobras', async () => {
      findCoop.mockResolvedValueOnce(coopCooperativo);
      findLanc.mockResolvedValueOnce([
        { tipo: 'RECEITA', valor: new Prisma.Decimal(10000), naturezaAto: 'PROPRIO' },
        { tipo: 'DESPESA', valor: new Prisma.Decimal(0), naturezaAto: 'PROPRIO' },
      ]);
      const r = await service.apurarMes('coop-A', 2026, 5);
      // Sobras = 10000; FR = 1000; FATES (só de sobras, sem resultado não-coop) = 500
      expect(r.fundoReserva.toString()).toBe('1000');
      expect(r.fates.toString()).toBe('500');
      // Sobras distribuíveis = 10000 - 1000 - 500 = 8500
      expect(r.sobrasDistribuiveis.toString()).toBe('8500');
    });

    it('resultado NÃO-COOP após tributos integra FATES (Art. 87 Lei 5.764/71)', async () => {
      findCoop.mockResolvedValueOnce(coopCooperativo);
      findLanc.mockResolvedValueOnce([
        // Resultado não-coop 1000
        { tipo: 'RECEITA', valor: new Prisma.Decimal(1000), naturezaAto: 'NAO_COOPERATIVO' },
      ]);
      const r = await service.apurarMes('coop-A', 2026, 5);
      // Tributos não-coop: PIS 6.5 + COFINS 30 + IRPJ (15% × 32% × 1000)=48 + CSLL (9% × 32% × 1000)=28.8 = 113.3
      // Resultado pós-tributos: 1000 - 113.3 = 886.7 → vai pra FATES (Art. 87)
      // FATES de sobras: 0 (sem sobras próprias); FATES não-coop: 886.7
      expect(r.fates.toString()).toBe('886.7');
    });

    it('aviso GATE WALTER presente no preview', async () => {
      findCoop.mockResolvedValueOnce(coopCooperativo);
      findLanc.mockResolvedValueOnce([]);
      const r = await service.apurarMes('coop-A', 2026, 5);
      expect(r.avisoValidacao).toMatch(/NÃO-VALIDADOS/);
      expect(r.configuracao.avisoPresuncao).toMatch(/CONFIRMAR COM WALTER/);
    });
  });

  // ============================================================
  // fecharApuracao — snapshot imutável + validadoContador=false
  // ============================================================

  describe('fecharApuracao', () => {
    beforeEach(() => {
      findCoop.mockResolvedValue(coopCooperativo);
      findLanc.mockResolvedValue([
        { tipo: 'RECEITA', valor: new Prisma.Decimal(1000), naturezaAto: 'PROPRIO' },
      ]);
    });

    it('cria snapshot com validadoContador=false (GATE WALTER)', async () => {
      findApur.mockResolvedValueOnce(null); // não existia ainda
      createApur.mockResolvedValueOnce({
        id: 'apur1',
        status: StatusApuracao.FECHADA,
        validadoContador: false,
      });
      const r = await service.fecharApuracao('coop-A', 2026, 5, 'user-1');
      expect(r.validadoContador).toBe(false);
      expect(r.status).toBe(StatusApuracao.FECHADA);
      expect(createApur).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            validadoContador: false,
            status: StatusApuracao.FECHADA,
            fechadoPorUsuarioId: 'user-1',
          }),
        }),
      );
    });

    it('fechar 2x mesmo mês → 409 ConflictException', async () => {
      findApur.mockResolvedValueOnce({ id: 'apur1', status: StatusApuracao.FECHADA });
      await expect(
        service.fecharApuracao('coop-A', 2026, 5, 'user-1'),
      ).rejects.toThrow(ConflictException);
    });

    it('snapshot ABERTA pré-existente → atualiza para FECHADA', async () => {
      findApur.mockResolvedValueOnce({ id: 'apur-old', status: StatusApuracao.ABERTA });
      updateApur.mockResolvedValueOnce({
        id: 'apur-old',
        status: StatusApuracao.FECHADA,
        validadoContador: false,
      });
      const r = await service.fecharApuracao('coop-A', 2026, 5, 'user-1');
      expect(r.id).toBe('apur-old');
      expect(updateApur).toHaveBeenCalled();
      expect(createApur).not.toHaveBeenCalled();
    });

    it('race condition (P2002) → ConflictException com mensagem clara', async () => {
      findApur.mockResolvedValueOnce(null);
      createApur.mockRejectedValueOnce({ code: 'P2002', message: 'unique' });
      await expect(
        service.fecharApuracao('coop-A', 2026, 5, 'user-1'),
      ).rejects.toThrow(ConflictException);
    });
  });

  // ============================================================
  // validarApuracao — Walter/contador
  // ============================================================

  describe('validarApuracao', () => {
    it('snapshot FECHADA + não validado → marca validadoContador=true', async () => {
      findApur.mockResolvedValueOnce({
        id: 'apur1',
        cooperativaId: 'coop-A',
        status: StatusApuracao.FECHADA,
        validadoContador: false,
      });
      updateApur.mockResolvedValueOnce({
        id: 'apur1',
        validadoContador: true,
        validadoEm: new Date(),
      });
      const r = await service.validarApuracao('apur1', 'coop-A', 'walter', 'Conferi tudo');
      expect(r.validadoContador).toBe(true);
      expect(updateApur).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            validadoContador: true,
            observacaoContador: 'Conferi tudo',
            validadoPorUsuarioId: 'walter',
          }),
        }),
      );
    });

    it('snapshot inexistente → 404', async () => {
      findApur.mockResolvedValueOnce(null);
      await expect(
        service.validarApuracao('apur-X', 'coop-A', 'walter'),
      ).rejects.toThrow(NotFoundException);
    });

    it('snapshot ABERTA não pode ser validada → 409', async () => {
      findApur.mockResolvedValueOnce({
        id: 'apur1',
        cooperativaId: 'coop-A',
        status: StatusApuracao.ABERTA,
        validadoContador: false,
      });
      await expect(
        service.validarApuracao('apur1', 'coop-A', 'walter'),
      ).rejects.toThrow(ConflictException);
    });

    it('snapshot já validada → 409 (idempotência explícita)', async () => {
      findApur.mockResolvedValueOnce({
        id: 'apur1',
        cooperativaId: 'coop-A',
        status: StatusApuracao.FECHADA,
        validadoContador: true,
      });
      await expect(
        service.validarApuracao('apur1', 'coop-A', 'walter'),
      ).rejects.toThrow(ConflictException);
    });

    it('cross-tenant → 403 (defesa em profundidade)', async () => {
      findApur.mockResolvedValueOnce({
        id: 'apur1',
        cooperativaId: 'coop-A',
        status: StatusApuracao.FECHADA,
        validadoContador: false,
      });
      await expect(
        service.validarApuracao('apur1', 'coop-B', 'walter'),
      ).rejects.toThrow(/outro tenant/);
    });
  });

  // ============================================================
  // reabrirApuracao — SUPER_ADMIN only
  // ============================================================

  describe('reabrirApuracao', () => {
    it('motivo < 10 chars → 409', async () => {
      await expect(service.reabrirApuracao('apur1', 'sa', 'curto')).rejects.toThrow(
        ConflictException,
      );
    });

    it('apuração ABERTA não pode ser reaberta → 409', async () => {
      findApur.mockResolvedValueOnce({ id: 'apur1', status: StatusApuracao.ABERTA });
      await expect(
        service.reabrirApuracao('apur1', 'sa', 'Erro em lançamento detectado pós-fechamento'),
      ).rejects.toThrow(ConflictException);
    });

    it('FECHADA → reabre + limpa validação', async () => {
      findApur.mockResolvedValueOnce({ id: 'apur1', status: StatusApuracao.FECHADA });
      updateApur.mockResolvedValueOnce({ id: 'apur1', status: StatusApuracao.ABERTA });
      const r = await service.reabrirApuracao(
        'apur1',
        'sa',
        'Erro em lançamento detectado pós-fechamento',
      );
      expect(r.status).toBe(StatusApuracao.ABERTA);
      expect(updateApur).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            status: StatusApuracao.ABERTA,
            validadoContador: false,
            validadoPorUsuarioId: null,
            validadoEm: null,
            motivoReabertura: 'Erro em lançamento detectado pós-fechamento',
          }),
        }),
      );
    });
  });

  // ============================================================
  // garantirMesAberto — bloqueio retroativo do hook CT.3
  // ============================================================

  describe('garantirMesAberto (bloqueio retroativo CT.3)', () => {
    it('mês FECHADA → ConflictException (snapshot imutável)', async () => {
      findApur.mockResolvedValueOnce({ id: 'apur1', status: StatusApuracao.FECHADA });
      await expect(
        service.garantirMesAberto('coop-A', '2026-05'),
      ).rejects.toThrow(ConflictException);
    });

    it('mês ABERTA → não bloqueia', async () => {
      findApur.mockResolvedValueOnce({ id: 'apur1', status: StatusApuracao.ABERTA });
      await expect(service.garantirMesAberto('coop-A', '2026-05')).resolves.toBeUndefined();
    });

    it('mês sem apuração → não bloqueia', async () => {
      findApur.mockResolvedValueOnce(null);
      await expect(service.garantirMesAberto('coop-A', '2026-05')).resolves.toBeUndefined();
    });

    it('competência mal-formada → não bloqueia (delega ao hook)', async () => {
      await expect(service.garantirMesAberto('coop-A', 'XXX')).resolves.toBeUndefined();
      expect(findApur).not.toHaveBeenCalled();
    });
  });
});
