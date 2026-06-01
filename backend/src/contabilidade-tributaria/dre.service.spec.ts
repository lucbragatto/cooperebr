import {
  ConflictException,
  NotFoundException,
  NotImplementedException,
} from '@nestjs/common';
import { Prisma, StatusApuracao, TipoRegimeContabil } from '@prisma/client';
import { DreService } from './dre.service';

/**
 * D-novo-BR-CT CT.5 (31/05/2026) — Specs das 4 visões de DRE.
 *
 * Cobre:
 *  - 4 visões (geral / proprio / auxiliar / nao-coop) com dados teste
 *    coerentes com CT.4 (sobras 1300, não-coop 300)
 *  - Snapshot FECHADA vs preview on-the-fly (apuração aberta)
 *  - validadoContador=false → avisoValidacao destacado
 *  - Regime não-coop → NotImplementedException (P0-1)
 *  - Visão inválida → 409
 *  - Cooperativa inexistente → 404
 *  - Terminologia cooperativa correta (NBC ITG 2004 — "ingressos"/"dispêndios")
 */
describe('DreService — CT.5', () => {
  const findCoop = jest.fn();
  const findApur = jest.fn();
  const apurarMes = jest.fn();

  const prismaMock = {
    cooperativa: { findUnique: findCoop },
    apuracaoMensalSegregada: { findUnique: findApur },
  } as any;

  const apuracaoServiceMock = { apurarMes } as any;

  let service: DreService;

  const coopCooperativo = {
    id: 'coop-A',
    nome: 'Coop Teste',
    regimeContabil: TipoRegimeContabil.COOPERATIVO,
  };

  const snapshotPadrao = {
    id: 'apur1',
    status: StatusApuracao.FECHADA,
    receitaPropria: new Prisma.Decimal('1500'),
    receitaAuxiliar: new Prisma.Decimal('300'),
    receitaNaoCoop: new Prisma.Decimal('400'),
    despesaPropria: new Prisma.Decimal('200'),
    despesaAuxiliar: new Prisma.Decimal('300'), // trânsito = 0
    despesaNaoCoop: new Prisma.Decimal('100'),
    pisDevido: new Prisma.Decimal('2.6'), // 0,65% × 400
    cofinsDevido: new Prisma.Decimal('12'), // 3% × 400
    irpjDevido: new Prisma.Decimal('14.4'), // 15% × 32% × 300
    csllDevido: new Prisma.Decimal('8.64'), // 9% × 32% × 300
    fundoReserva: new Prisma.Decimal('130'), // 10% × 1300
    fates: new Prisma.Decimal('327.36'), // 5% × 1300 + (300 - 37.64) ≈ 65 + 262.36
    sobrasDistribuiveis: new Prisma.Decimal('1105'), // 1300 - 130 - 65
    fundamentoIsencao: 'STF Tema 536 + STJ Tema 986 + Art. 79 Lei 5.764/71',
    validadoContador: false,
    validadoEm: null,
  };

  beforeEach(() => {
    jest.clearAllMocks();
    service = new DreService(prismaMock, apuracaoServiceMock);
  });

  // ============================================================
  // Validações de entrada
  // ============================================================

  describe('validações de entrada', () => {
    it('visão inválida → 409', async () => {
      await expect(
        service.montarDre('coop-A', 2026, 5, 'invalida' as any),
      ).rejects.toThrow(ConflictException);
    });

    it('cooperativa inexistente → 404', async () => {
      findCoop.mockResolvedValueOnce(null);
      await expect(service.montarDre('coop-X', 2026, 5, 'geral')).rejects.toThrow(
        NotFoundException,
      );
    });

    it.each([
      TipoRegimeContabil.CONSORCIO_PROPORCIONAL,
      TipoRegimeContabil.ASSOCIACAO_SEM_FINS_LUCRATIVOS,
      TipoRegimeContabil.CONDOMINIO_EDILICIO,
    ])('regime %s → NotImplementedException (P0-1)', async (regime) => {
      findCoop.mockResolvedValueOnce({ ...coopCooperativo, regimeContabil: regime });
      await expect(service.montarDre('coop-A', 2026, 5, 'geral')).rejects.toThrow(
        NotImplementedException,
      );
    });
  });

  // ============================================================
  // Snapshot FECHADA — usa dados do banco
  // ============================================================

  describe('snapshot FECHADA', () => {
    beforeEach(() => {
      findCoop.mockResolvedValue(coopCooperativo);
      findApur.mockResolvedValue(snapshotPadrao);
    });

    it('fonte = SNAPSHOT quando apuração está FECHADA', async () => {
      const r = await service.montarDre('coop-A', 2026, 5, 'geral');
      expect(r.fonte).toBe('SNAPSHOT');
      expect(r.snapshotId).toBe('apur1');
      expect(apurarMes).not.toHaveBeenCalled();
    });

    it('validadoContador=false → avisoValidacao destacado (GATE VALIDAÇÃO FISCAL)', async () => {
      const r = await service.montarDre('coop-A', 2026, 5, 'geral');
      expect(r.validadoContador).toBe(false);
      expect(r.avisoValidacao).toMatch(/PENDENTE VALIDAÇÃO FISCAL/);
      expect(r.avisoValidacao).toMatch(/NÃO usar pra DCTF\/SPED/);
    });

    it('validadoContador=true → avisoValidacao null', async () => {
      findApur.mockResolvedValueOnce({
        ...snapshotPadrao,
        validadoContador: true,
        validadoEm: new Date('2026-06-05'),
      });
      const r = await service.montarDre('coop-A', 2026, 5, 'geral');
      expect(r.validadoContador).toBe(true);
      expect(r.avisoValidacao).toBeNull();
    });
  });

  // ============================================================
  // Snapshot ABERTA / inexistente → preview on-the-fly
  // ============================================================

  describe('preview on-the-fly', () => {
    beforeEach(() => {
      findCoop.mockResolvedValue(coopCooperativo);
      findApur.mockResolvedValue(null); // sem snapshot
      apurarMes.mockResolvedValue({
        receitaPropria: new Prisma.Decimal('1500'),
        receitaAuxiliar: new Prisma.Decimal('300'),
        receitaNaoCoop: new Prisma.Decimal('400'),
        despesaPropria: new Prisma.Decimal('200'),
        despesaAuxiliar: new Prisma.Decimal('300'),
        despesaNaoCoop: new Prisma.Decimal('100'),
        pisDevido: new Prisma.Decimal('2.6'),
        cofinsDevido: new Prisma.Decimal('12'),
        irpjDevido: new Prisma.Decimal('14.4'),
        csllDevido: new Prisma.Decimal('8.64'),
        fundoReserva: new Prisma.Decimal('130'),
        fates: new Prisma.Decimal('327.36'),
        sobrasDistribuiveis: new Prisma.Decimal('1105'),
        fundamentoIsencao: 'STF Tema 536 + STJ Tema 986 + Art. 79 Lei 5.764/71',
      } as any);
    });

    it('fonte = PREVIEW quando não há snapshot fechado', async () => {
      const r = await service.montarDre('coop-A', 2026, 5, 'geral');
      expect(r.fonte).toBe('PREVIEW');
      expect(r.snapshotId).toBeNull();
      expect(apurarMes).toHaveBeenCalledWith('coop-A', 2026, 5);
    });

    it('preview SEMPRE vem com validadoContador=false', async () => {
      const r = await service.montarDre('coop-A', 2026, 5, 'geral');
      expect(r.validadoContador).toBe(false);
      expect(r.avisoValidacao).toMatch(/PENDENTE VALIDAÇÃO FISCAL/);
    });

    it('apuração ABERTA pré-existente também usa preview (status != FECHADA)', async () => {
      findApur.mockResolvedValueOnce({
        ...snapshotPadrao,
        status: StatusApuracao.ABERTA,
      });
      const r = await service.montarDre('coop-A', 2026, 5, 'geral');
      expect(r.fonte).toBe('PREVIEW');
      expect(apurarMes).toHaveBeenCalled();
    });
  });

  // ============================================================
  // Visão GERAL — consolidada
  // ============================================================

  describe('visão GERAL — consolidada', () => {
    beforeEach(() => {
      findCoop.mockResolvedValue(coopCooperativo);
      findApur.mockResolvedValue(snapshotPadrao);
    });

    it('inclui blocos PRÓPRIO + AUXILIAR + NÃO-COOP + FUNDOS + DESTINAÇÃO', async () => {
      const r = await service.montarDre('coop-A', 2026, 5, 'geral');
      const headers = r.linhas.filter((l) => l.tipo === 'header').map((l) => l.rotulo);
      expect(headers).toEqual(
        expect.arrayContaining([
          expect.stringMatching(/ATO COOPERATIVO PRÓPRIO/),
          expect.stringMatching(/ATO COOPERATIVO AUXILIAR/),
          expect.stringMatching(/ATO NÃO-COOPERATIVO/),
          expect.stringMatching(/FUNDOS OBRIGATÓRIOS/),
          expect.stringMatching(/DESTINAÇÃO/),
        ]),
      );
    });

    it('total = sobras a distribuir (1105)', async () => {
      const r = await service.montarDre('coop-A', 2026, 5, 'geral');
      expect(r.total.toString()).toBe('1105');
      expect(r.totalRotulo).toBe('Sobras a distribuir');
    });

    it('linhas de tributos presentes', async () => {
      const r = await service.montarDre('coop-A', 2026, 5, 'geral');
      const tributos = r.linhas.filter((l) => l.tipo === 'tributo');
      expect(tributos.length).toBe(4); // PIS, COFINS, IRPJ, CSLL
      const rotulos = tributos.map((l) => l.rotulo);
      expect(rotulos).toEqual(
        expect.arrayContaining([
          expect.stringMatching(/PIS/),
          expect.stringMatching(/COFINS/),
          expect.stringMatching(/IRPJ/),
          expect.stringMatching(/CSLL/),
        ]),
      );
    });
  });

  // ============================================================
  // Visão PRÓPRIO — terminologia "ingressos/dispêndios"
  // ============================================================

  describe('visão PROPRIO — Art. 79 (NBC ITG 2004)', () => {
    beforeEach(() => {
      findCoop.mockResolvedValue(coopCooperativo);
      findApur.mockResolvedValue(snapshotPadrao);
    });

    it('usa "Ingressos / Dispêndios" (NÃO "Receitas / Despesas")', async () => {
      const r = await service.montarDre('coop-A', 2026, 5, 'proprio');
      const ingresso = r.linhas.find((l) => l.tipo === 'ingresso');
      const dispendio = r.linhas.find((l) => l.tipo === 'dispendio');
      expect(ingresso?.rotulo).toMatch(/Ingressos de ato próprio/);
      expect(dispendio?.rotulo).toMatch(/Dispêndios de ato próprio/);
      // Garante que NÃO usa terminologia comercial nesta visão
      expect(r.linhas.find((l) => l.tipo === 'receita')).toBeUndefined();
      expect(r.linhas.find((l) => l.tipo === 'despesa')).toBeUndefined();
    });

    it('cita isenções fiscais (RIR Art. 182 + STF Tema 536)', async () => {
      const r = await service.montarDre('coop-A', 2026, 5, 'proprio');
      const infoLinha = r.linhas.find((l) => l.tipo === 'info');
      expect(infoLinha?.rotulo).toMatch(/Art\. 182/);
      expect(infoLinha?.rotulo).toMatch(/STF Tema 536/);
    });

    it('total = sobras a distribuir aos cooperados', async () => {
      const r = await service.montarDre('coop-A', 2026, 5, 'proprio');
      expect(r.totalRotulo).toMatch(/Sobras a distribuir/);
      expect(r.total.toString()).toBe('1105');
    });

    it('sem isenção (flag false) → mensagem ajustada', async () => {
      findApur.mockResolvedValueOnce({ ...snapshotPadrao, fundamentoIsencao: null });
      const r = await service.montarDre('coop-A', 2026, 5, 'proprio');
      const infoLinha = r.linhas.find((l) => l.tipo === 'info');
      expect(infoLinha?.rotulo).toMatch(/PIS\/COFINS: incide/);
    });
  });

  // ============================================================
  // Visão AUXILIAR — trânsito zero esperado
  // ============================================================

  describe('visão AUXILIAR — Art. 88', () => {
    beforeEach(() => {
      findCoop.mockResolvedValue(coopCooperativo);
    });

    it('trânsito = 0 → ✅ mensagem positiva', async () => {
      findApur.mockResolvedValueOnce(snapshotPadrao); // 300 - 300 = 0
      const r = await service.montarDre('coop-A', 2026, 5, 'auxiliar');
      expect(r.total.toString()).toBe('0');
      const ultimaInfo = r.linhas.filter((l) => l.tipo === 'info').slice(-1)[0];
      expect(ultimaInfo?.rotulo).toMatch(/✅ Trânsito zero/);
    });

    it('trânsito ≠ 0 → ⚠️ alerta de reclassificação', async () => {
      findApur.mockResolvedValueOnce({
        ...snapshotPadrao,
        receitaAuxiliar: new Prisma.Decimal('500'),
        despesaAuxiliar: new Prisma.Decimal('300'),
      });
      const r = await service.montarDre('coop-A', 2026, 5, 'auxiliar');
      expect(r.total.toString()).toBe('200');
      const ultimaInfo = r.linhas.filter((l) => l.tipo === 'info').slice(-1)[0];
      expect(ultimaInfo?.rotulo).toMatch(/⚠️ Trânsito ≠ 0/);
    });
  });

  // ============================================================
  // Visão NAO-COOP — tributada + integra FATES
  // ============================================================

  describe('visão NAO-COOP — Art. 86', () => {
    beforeEach(() => {
      findCoop.mockResolvedValue(coopCooperativo);
      findApur.mockResolvedValue(snapshotPadrao);
    });

    it('usa "Receitas / Despesas" (terminologia comercial — não cooperativa)', async () => {
      const r = await service.montarDre('coop-A', 2026, 5, 'nao-coop');
      const receita = r.linhas.find((l) => l.tipo === 'receita');
      const despesa = r.linhas.find((l) => l.tipo === 'despesa');
      expect(receita?.rotulo).toMatch(/Receitas de terceiros/);
      expect(despesa?.rotulo).toMatch(/Despesas atreladas/);
      // Garante que NÃO usa terminologia cooperativa nesta visão
      expect(r.linhas.find((l) => l.tipo === 'ingresso')).toBeUndefined();
      expect(r.linhas.find((l) => l.tipo === 'dispendio')).toBeUndefined();
    });

    it('total = resultado líquido positivo (vai pra FATES Art. 87)', async () => {
      const r = await service.montarDre('coop-A', 2026, 5, 'nao-coop');
      // Bruto: 400 - 100 = 300; Tributos: 2.6+12+14.4+8.64 = 37.64; Líquido: 262.36
      expect(r.total.toString()).toBe('262.36');
      expect(r.totalRotulo).toMatch(/FATES/);
    });

    it('resultado negativo → total zero (não integra FATES)', async () => {
      findApur.mockResolvedValueOnce({
        ...snapshotPadrao,
        receitaNaoCoop: new Prisma.Decimal('100'),
        despesaNaoCoop: new Prisma.Decimal('500'),
      });
      const r = await service.montarDre('coop-A', 2026, 5, 'nao-coop');
      expect(r.total.toString()).toBe('0');
    });

    it('todos os 4 tributos listados', async () => {
      const r = await service.montarDre('coop-A', 2026, 5, 'nao-coop');
      const tributos = r.linhas.filter((l) => l.tipo === 'tributo');
      expect(tributos.length).toBe(4);
    });
  });

  // ============================================================
  // Metadata gerais
  // ============================================================

  describe('metadata', () => {
    beforeEach(() => {
      findCoop.mockResolvedValue(coopCooperativo);
      findApur.mockResolvedValue(snapshotPadrao);
    });

    it('competência no formato YYYY-MM', async () => {
      const r = await service.montarDre('coop-A', 2026, 5, 'geral');
      expect(r.competencia).toBe('2026-05');
    });

    it('título + fundamentoLegal específicos por visão', async () => {
      const geral = await service.montarDre('coop-A', 2026, 5, 'geral');
      const proprio = await service.montarDre('coop-A', 2026, 5, 'proprio');
      const auxiliar = await service.montarDre('coop-A', 2026, 5, 'auxiliar');
      const naoCoop = await service.montarDre('coop-A', 2026, 5, 'nao-coop');

      expect(geral.titulo).toMatch(/Consolidada/);
      expect(proprio.titulo).toMatch(/Art\. 79/);
      expect(auxiliar.titulo).toMatch(/Art\. 88/);
      expect(naoCoop.titulo).toMatch(/Art\. 86/);

      expect(proprio.fundamentoLegal).toMatch(/Art\. 182/);
      expect(naoCoop.fundamentoLegal).toMatch(/9\.249\/95/);
    });
  });
});
