import { BadRequestException, NotFoundException } from '@nestjs/common';
import { Prisma, TipoRegimeContabil } from '@prisma/client';
import { ContabilidadeTributariaService } from './contabilidade-tributaria.service';

/**
 * D-FISCAL-2.2 (01/06/2026 noite) — Specs do motor consolidado.
 *
 * Cobre os 4 enforcements + caso feliz + estorno + listar + preservação
 * do fix CT.9.1 (timezone competência derivada da string).
 */
describe('ContabilidadeTributariaService — D-FISCAL-2.2 (convênio consolidado)', () => {
  const findContrato = jest.fn();
  const findCoop = jest.fn();
  const findApurUnique = jest.fn();
  const createLanc = jest.fn();
  const findFirstLanc = jest.fn();
  const findManyLanc = jest.fn();
  const deleteLanc = jest.fn();

  const prismaMock = {
    contratoConvenio: { findFirst: findContrato },
    cooperativa: { findUnique: findCoop },
    apuracaoMensalSegregada: { findUnique: findApurUnique },
    lancamentoCaixa: {
      create: createLanc,
      findFirst: findFirstLanc,
      findMany: findManyLanc,
      delete: deleteLanc,
    },
  } as any;

  // Factory mínimo — service só precisa dele se classificarLancamento for chamado.
  // No caso D-FISCAL-2.2 usamos naturezaOverride → factory NUNCA é invocado.
  const factoryMock = {
    resolve: jest.fn(() => ({
      classificarLancamento: () => 'AUXILIAR',
    })),
  } as any;

  // ApuracaoService mínimo — garantirMesAberto vira no-op (mock retorna OK)
  const apuracaoMock = {
    garantirMesAberto: jest.fn().mockResolvedValue(undefined),
  } as any;

  let service: ContabilidadeTributariaService;

  const contratoBase = {
    id: 'cc1',
    empresaNome: 'Conv Teste',
    status: 'ATIVO',
    geraLancamentoContabil: true,
    naturezaAtoCooperativo: 'PROPRIO',
    fluxoFinanceiro: 'INGRESSO_CUSTEIO_AUXILIAR',
    cooperativaId: 'coop-A',
  };

  const coopCooperativa = {
    tipoParceiro: 'COOPERATIVA',
    regimeContabil: TipoRegimeContabil.COOPERATIVO,
    nome: 'Coop Teste',
  };

  beforeEach(() => {
    jest.clearAllMocks();
    service = new ContabilidadeTributariaService(prismaMock, factoryMock, apuracaoMock);
    apuracaoMock.garantirMesAberto.mockResolvedValue(undefined);
  });

  // ============================================================
  // ENFORCEMENTS (4 erros + casos de borda)
  // ============================================================

  describe('enforcements', () => {
    it('contrato inexistente no tenant → NotFoundException', async () => {
      findContrato.mockResolvedValueOnce(null);
      await expect(
        service.criarLancamentoConvenioContrato({
          contratoConvenioId: 'inexistente',
          valor: 100,
          dataMovimento: new Date(2026, 7, 1),
          cooperativaId: 'coop-A',
        }),
      ).rejects.toThrow(NotFoundException);
    });

    it('contrato não-ATIVO → BadRequestException', async () => {
      findContrato.mockResolvedValueOnce({ ...contratoBase, status: 'ENCERRADO' });
      await expect(
        service.criarLancamentoConvenioContrato({
          contratoConvenioId: 'cc1',
          valor: 100,
          dataMovimento: new Date(2026, 7, 1),
          cooperativaId: 'coop-A',
        }),
      ).rejects.toThrow(/não está ATIVO/);
    });

    it('#1 geraLancamentoContabil=false → BadRequest claro', async () => {
      findContrato.mockResolvedValueOnce({ ...contratoBase, geraLancamentoContabil: false });
      await expect(
        service.criarLancamentoConvenioContrato({
          contratoConvenioId: 'cc1',
          valor: 100,
          dataMovimento: new Date(2026, 7, 1),
          cooperativaId: 'coop-A',
        }),
      ).rejects.toThrow(/não está marcado para gerar lançamento contábil/);
    });

    it('#2 naturezaAtoCooperativo=null → BadRequest claro', async () => {
      findContrato.mockResolvedValueOnce({ ...contratoBase, naturezaAtoCooperativo: null });
      await expect(
        service.criarLancamentoConvenioContrato({
          contratoConvenioId: 'cc1',
          valor: 100,
          dataMovimento: new Date(2026, 7, 1),
          cooperativaId: 'coop-A',
        }),
      ).rejects.toThrow(/natureza do ato definida/);
    });

    it('#3 fluxoFinanceiro=null → BadRequest claro', async () => {
      findContrato.mockResolvedValueOnce({ ...contratoBase, fluxoFinanceiro: null });
      await expect(
        service.criarLancamentoConvenioContrato({
          contratoConvenioId: 'cc1',
          valor: 100,
          dataMovimento: new Date(2026, 7, 1),
          cooperativaId: 'coop-A',
        }),
      ).rejects.toThrow(/fluxo financeiro definido/);
    });

    it.each([
      ['CONSORCIO', TipoRegimeContabil.CONSORCIO_PROPORCIONAL],
      ['ASSOCIACAO', TipoRegimeContabil.ASSOCIACAO_SEM_FINS_LUCRATIVOS],
      ['CONDOMINIO', TipoRegimeContabil.CONDOMINIO_EDILICIO],
    ])('#4 P0-1: %s + naturezaAtoCooperativo=PROPRIO → BadRequest', async (tipo, regime) => {
      findContrato.mockResolvedValueOnce(contratoBase);
      findCoop.mockResolvedValueOnce({
        tipoParceiro: tipo,
        regimeContabil: regime,
        nome: `${tipo} Teste`,
      });
      await expect(
        service.criarLancamentoConvenioContrato({
          contratoConvenioId: 'cc1',
          valor: 100,
          dataMovimento: new Date(2026, 7, 1),
          cooperativaId: 'coop-A',
        }),
      ).rejects.toThrow(/D-novo-CT-MULTI-REGIME-CLASSIFICACAO/);
    });

    it('#4 P0-1: NAO_COOPERATIVO em parceiro não-coop → PASSA (não viola P0-1)', async () => {
      findContrato.mockResolvedValueOnce({
        ...contratoBase,
        naturezaAtoCooperativo: 'NAO_COOPERATIVO',
      });
      findCoop.mockResolvedValueOnce({
        tipoParceiro: 'CONSORCIO',
        regimeContabil: TipoRegimeContabil.CONSORCIO_PROPORCIONAL,
        nome: 'Consórcio X',
      });
      createLanc.mockResolvedValueOnce({ id: 'lanc1', naturezaAto: 'NAO_COOPERATIVO' });
      const r = await service.criarLancamentoConvenioContrato({
        contratoConvenioId: 'cc1',
        valor: 100,
        dataMovimento: new Date(2026, 7, 1),
        competencia: '2026-08',
        cooperativaId: 'coop-A',
      });
      expect(r.naturezaAto).toBe('NAO_COOPERATIVO');
    });
  });

  // ============================================================
  // Caso feliz
  // ============================================================

  describe('caso feliz', () => {
    it('COOPERATIVA + PROPRIO → cria lançamento RECEITA com natureza override', async () => {
      findContrato.mockResolvedValueOnce(contratoBase);
      findCoop.mockResolvedValueOnce(coopCooperativa);
      createLanc.mockResolvedValueOnce({ id: 'lanc1', naturezaAto: 'PROPRIO' });
      const r = await service.criarLancamentoConvenioContrato({
        contratoConvenioId: 'cc1',
        valor: 1500.5,
        dataMovimento: new Date(2026, 7, 1), // 01/08 LOCAL
        competencia: '2026-08',
        descricao: 'Aporte custeio mês',
        cooperativaId: 'coop-A',
      });
      expect(r.tipo).toBe('RECEITA');
      expect(r.naturezaAto).toBe('PROPRIO');
      expect(r.competencia).toBe('2026-08');
      expect(r.valor).toBe('1500.50');
      expect(r.descricao).toBe('Aporte custeio mês');
      // Factory.resolve NÃO foi chamado (naturezaOverride bypassa regime)
      expect(factoryMock.resolve).not.toHaveBeenCalled();
      // Lançamento criado com convenioId (FK ContratoConvenio), não convenioContabilId
      const dataPassada = createLanc.mock.calls[0][0].data;
      expect(dataPassada.convenioId).toBe('cc1');
      expect(dataPassada.convenioContabilId).toBeNull();
      expect(dataPassada.naturezaAto).toBe('PROPRIO');
    });

    it('COOPERATIVA + AUXILIAR + REPASSE_PROVEDOR_EXTERNO → tipo=DESPESA', async () => {
      findContrato.mockResolvedValueOnce({
        ...contratoBase,
        naturezaAtoCooperativo: 'AUXILIAR',
        fluxoFinanceiro: 'REPASSE_PROVEDOR_EXTERNO',
      });
      findCoop.mockResolvedValueOnce(coopCooperativa);
      createLanc.mockResolvedValueOnce({ id: 'lanc2', naturezaAto: 'AUXILIAR' });
      const r = await service.criarLancamentoConvenioContrato({
        contratoConvenioId: 'cc1',
        valor: 800,
        dataMovimento: new Date(2026, 7, 15),
        competencia: '2026-08',
        cooperativaId: 'coop-A',
      });
      expect(r.tipo).toBe('DESPESA');
      expect(r.naturezaAto).toBe('AUXILIAR');
    });

    it('PRESERVA fix CT.9.1: competência do caller (string) prevalece sobre Date', async () => {
      findContrato.mockResolvedValueOnce(contratoBase);
      findCoop.mockResolvedValueOnce(coopCooperativa);
      createLanc.mockResolvedValueOnce({ id: 'lanc1', naturezaAto: 'PROPRIO' });
      // Date intencionalmente diferente: caller passa '2026-08' (correto)
      // mas Date passa 31/07 (simulando bug TZ se não tivesse o fix)
      const r = await service.criarLancamentoConvenioContrato({
        contratoConvenioId: 'cc1',
        valor: 100,
        dataMovimento: new Date(2026, 6, 31, 23, 0, 0), // 31/07 LOCAL
        competencia: '2026-08', // mas competência da STRING original do form
        cooperativaId: 'coop-A',
      });
      expect(r.competencia).toBe('2026-08'); // caller venceu (CT.9.1 fix preservado)
    });

    it('valor com 3 casas decimais → arredondado pra 2 (CLAUDE.md)', async () => {
      findContrato.mockResolvedValueOnce(contratoBase);
      findCoop.mockResolvedValueOnce(coopCooperativa);
      createLanc.mockResolvedValueOnce({ id: 'lanc1', naturezaAto: 'PROPRIO' });
      const r = await service.criarLancamentoConvenioContrato({
        contratoConvenioId: 'cc1',
        valor: 100.567, // 3 casas
        dataMovimento: new Date(2026, 7, 1),
        competencia: '2026-08',
        cooperativaId: 'coop-A',
      });
      expect(r.valor).toBe('100.57'); // Math.round(x*100)/100
    });

    it('valor zero → BadRequest', async () => {
      findContrato.mockResolvedValueOnce(contratoBase);
      findCoop.mockResolvedValueOnce(coopCooperativa);
      await expect(
        service.criarLancamentoConvenioContrato({
          contratoConvenioId: 'cc1',
          valor: 0,
          dataMovimento: new Date(2026, 7, 1),
          cooperativaId: 'coop-A',
        }),
      ).rejects.toThrow(/Valor deve ser positivo/);
    });

    it('apuração FECHADA propaga erro (gate CT.4 reusado)', async () => {
      findContrato.mockResolvedValueOnce(contratoBase);
      findCoop.mockResolvedValueOnce(coopCooperativa);
      apuracaoMock.garantirMesAberto.mockRejectedValueOnce(
        new Error('Apuração de 2026-08 FECHADA — reabra primeiro'),
      );
      await expect(
        service.criarLancamentoConvenioContrato({
          contratoConvenioId: 'cc1',
          valor: 100,
          dataMovimento: new Date(2026, 7, 1),
          competencia: '2026-08',
          cooperativaId: 'coop-A',
        }),
      ).rejects.toThrow(/FECHADA/);
    });
  });

  // ============================================================
  // listarMovimentosContrato
  // ============================================================

  describe('listarMovimentosContrato', () => {
    it('contrato inexistente no tenant → NotFoundException', async () => {
      findContrato.mockResolvedValueOnce(null);
      await expect(
        service.listarMovimentosContrato('inexistente', 'coop-A'),
      ).rejects.toThrow(NotFoundException);
    });

    it('retorna lista ordenada por dataPagamento desc', async () => {
      findContrato.mockResolvedValueOnce({ id: 'cc1' });
      findManyLanc.mockResolvedValueOnce([
        {
          id: 'l1',
          tipo: 'RECEITA',
          descricao: 'Aporte 1',
          valor: new Prisma.Decimal('500.00'),
          competencia: '2026-08',
          dataPagamento: new Date(2026, 7, 15),
          status: 'REALIZADO',
          naturezaAto: 'PROPRIO',
          createdAt: new Date(),
        },
      ]);
      const r = await service.listarMovimentosContrato('cc1', 'coop-A');
      expect(r).toHaveLength(1);
      expect(r[0].valor).toBe(500);
      expect(r[0].naturezaAto).toBe('PROPRIO');
      // Verifica filtros do where
      expect(findManyLanc).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            convenioId: 'cc1',
            cooperativaId: 'coop-A',
            origemTipo: 'CONVENIO',
          }),
        }),
      );
    });
  });

  // ============================================================
  // estornarMovimentoConvenioContrato
  // ============================================================

  describe('estornarMovimentoConvenioContrato', () => {
    it('movimento inexistente no contrato/tenant → NotFoundException', async () => {
      findFirstLanc.mockResolvedValueOnce(null);
      await expect(
        service.estornarMovimentoConvenioContrato({
          contratoConvenioId: 'cc1',
          lancamentoId: 'fantasma',
          cooperativaId: 'coop-A',
        }),
      ).rejects.toThrow(NotFoundException);
    });

    it('caso feliz: deleta atômico + retorna {estornado:true}', async () => {
      findFirstLanc.mockResolvedValueOnce({ id: 'lanc1', competencia: '2026-08' });
      deleteLanc.mockResolvedValueOnce({ id: 'lanc1' });
      const r = await service.estornarMovimentoConvenioContrato({
        contratoConvenioId: 'cc1',
        lancamentoId: 'lanc1',
        cooperativaId: 'coop-A',
        motivo: 'Erro de digitação',
        usuarioId: 'u1',
      });
      expect(r).toEqual({ id: 'lanc1', estornado: true });
      expect(deleteLanc).toHaveBeenCalledWith({ where: { id: 'lanc1' } });
    });

    it('gate apuração FECHADA bloqueia o estorno', async () => {
      findFirstLanc.mockResolvedValueOnce({ id: 'lanc1', competencia: '2026-08' });
      apuracaoMock.garantirMesAberto.mockRejectedValueOnce(
        new Error('Apuração de 2026-08 FECHADA — reabra primeiro'),
      );
      await expect(
        service.estornarMovimentoConvenioContrato({
          contratoConvenioId: 'cc1',
          lancamentoId: 'lanc1',
          cooperativaId: 'coop-A',
        }),
      ).rejects.toThrow(/FECHADA/);
      expect(deleteLanc).not.toHaveBeenCalled();
    });
  });
});
