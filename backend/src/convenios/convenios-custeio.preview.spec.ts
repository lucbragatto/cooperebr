/**
 * Sprint Onboarding Bloco 2 Fatia 2.1 (07/06/2026) — specs do helper
 * read-only `previewKwhConsolidado`.
 *
 * Cobertura:
 *  - (a) CONSUMO_REAL com 3 membros + faturas APROVADAS → status=OK,
 *    breakdown por membro + percentuais somam 100%.
 *  - (b) CONSUMO_REAL com 1 membro sem fatura → status=OK mas membro
 *    aparece com kwh=0 + semFaturaNoMes=true (transparência operacional).
 *  - (c) CONSUMO_REAL com 0 membros + 0 UCs pagador → status=SEM_MEMBROS
 *    (sem throw — UI mostra estado vazio).
 *  - (d) CONSUMO_REAL com membros sem UC → status=SEM_UCS_CUSTEADAS.
 *  - (e) CONSUMO_REAL com UCs mas plano não-custeado → status=SEM_UCS_CUSTEADAS.
 *  - (f) CONSUMO_REAL com UCs custeadas mas 0 faturas no mês → SEM_FATURAS_NO_MES.
 *  - (g) ALOCACAO_FIXA com cotas distintas → rateio proporcional + warning=undefined.
 *  - (h) ALOCACAO_FIXA com todas cotas=null → fallback IGUALITARIO +
 *    warningRateioIgualitario=true.
 *  - (i) ALOCACAO_FIXA sem kwhAlocadoMensal → throw BadRequest.
 *  - (j) anti-IDOR: cooperativaId errada → 404 (NÃO 403, anti-enumeração).
 *  - (k) pagador!=EMPRESA → throw BadRequest.
 *  - (l) UCs do pagador entram como entrada virtual `isPagador=true`.
 */
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { ConveniosCusteioService } from './convenios-custeio.service';

describe('ConveniosCusteioService.previewKwhConsolidado — Fatia 2.1', () => {
  let service: ConveniosCusteioService;
  let prismaMock: any;

  const TENANT_A = 'coop-A';
  const CONVENIO_ID = 'conv-1';

  const baseConvenio = {
    id: CONVENIO_ID,
    empresaNome: 'Clínica X',
    status: 'ATIVO',
    pagador: 'EMPRESA',
    cooperativaId: TENANT_A,
    pagadorCooperadoId: 'pagador-1',
    baseCobrancaCusteio: 'CONSUMO_REAL',
    kwhAlocadoMensal: null,
  };

  beforeEach(() => {
    prismaMock = {
      contratoConvenio: { findFirst: jest.fn() },
      convenioCooperado: { findMany: jest.fn() },
      uc: { findMany: jest.fn().mockResolvedValue([]) },
      contrato: { findMany: jest.fn() },
      faturaProcessada: { findMany: jest.fn() },
    };
    service = new ConveniosCusteioService(prismaMock);
  });

  // ─── (a) caminho feliz CONSUMO_REAL ─────────────────────────────────
  it('(a) CONSUMO_REAL com 3 membros → status=OK, breakdown, percentuais somam 100%', async () => {
    prismaMock.contratoConvenio.findFirst.mockResolvedValue(baseConvenio);
    prismaMock.convenioCooperado.findMany.mockResolvedValue([
      {
        cooperado: {
          id: 'c1',
          nomeCompleto: 'Dra. A',
          cotaKwhMensal: 300,
          ucs: [{ id: 'uc1', numero: 'UC001', distribuidora: 'EDP_ES' }],
        },
      },
      {
        cooperado: {
          id: 'c2',
          nomeCompleto: 'Dr. B',
          cotaKwhMensal: 200,
          ucs: [{ id: 'uc2', numero: 'UC002', distribuidora: 'EDP_ES' }],
        },
      },
      {
        cooperado: {
          id: 'c3',
          nomeCompleto: 'Dra. C',
          cotaKwhMensal: 100,
          ucs: [{ id: 'uc3', numero: 'UC003', distribuidora: 'EDP_ES' }],
        },
      },
    ]);
    prismaMock.contrato.findMany.mockResolvedValue([
      { ucId: 'uc1' },
      { ucId: 'uc2' },
      { ucId: 'uc3' },
    ]);
    prismaMock.faturaProcessada.findMany.mockResolvedValue([
      { ucId: 'uc1', dadosExtraidos: { consumoAtualKwh: 300 }, mediaKwhCalculada: '300' },
      { ucId: 'uc2', dadosExtraidos: { consumoAtualKwh: 200 }, mediaKwhCalculada: '200' },
      { ucId: 'uc3', dadosExtraidos: { consumoAtualKwh: 100 }, mediaKwhCalculada: '100' },
    ]);

    const r = await service.previewKwhConsolidado({
      convenioId: CONVENIO_ID,
      mesReferencia: 5,
      anoReferencia: 2026,
      cooperativaId: TENANT_A,
    });

    expect(r.status).toBe('OK');
    expect(r.kwhTotal).toBe(600);
    expect(r.membros).toHaveLength(3);
    expect(r.membros.map((m) => m.kwh).reduce((a, b) => a + b, 0)).toBe(600);
    const somaPct = r.membros.reduce((a, m) => a + m.percentual, 0);
    expect(Math.abs(somaPct - 100)).toBeLessThanOrEqual(0.05);
    expect(r.membros[0]!.fonte).toBe('fatura');
    expect(r.distribuidoraUsada).toBe('EDP_ES');
    expect(r.mesRefStr).toBe('05/2026');
  });

  // ─── (b) membro sem fatura no mês — transparência operacional ───────
  it('(b) CONSUMO_REAL com 1 membro sem fatura → semFaturaNoMes=true exibido', async () => {
    prismaMock.contratoConvenio.findFirst.mockResolvedValue(baseConvenio);
    prismaMock.convenioCooperado.findMany.mockResolvedValue([
      {
        cooperado: {
          id: 'c1',
          nomeCompleto: 'Dra. A',
          cotaKwhMensal: 300,
          ucs: [{ id: 'uc1', numero: 'UC001', distribuidora: 'EDP_ES' }],
        },
      },
      {
        cooperado: {
          id: 'c2',
          nomeCompleto: 'Dr. B (sem fatura)',
          cotaKwhMensal: 200,
          ucs: [{ id: 'uc2', numero: 'UC002', distribuidora: 'EDP_ES' }],
        },
      },
    ]);
    prismaMock.contrato.findMany.mockResolvedValue([{ ucId: 'uc1' }, { ucId: 'uc2' }]);
    prismaMock.faturaProcessada.findMany.mockResolvedValue([
      { ucId: 'uc1', dadosExtraidos: { consumoAtualKwh: 300 }, mediaKwhCalculada: '300' },
      // uc2 sem fatura
    ]);

    const r = await service.previewKwhConsolidado({
      convenioId: CONVENIO_ID,
      mesReferencia: 5,
      anoReferencia: 2026,
      cooperativaId: TENANT_A,
    });

    expect(r.status).toBe('OK');
    expect(r.kwhTotal).toBe(300);
    const c2 = r.membros.find((m) => m.cooperadoId === 'c2')!;
    expect(c2.kwh).toBe(0);
    expect(c2.semFaturaNoMes).toBe(true);
    expect(c2.fonte).toBe('sem-dado');
    expect(c2.percentual).toBe(0);
  });

  // ─── (c) SEM_MEMBROS ────────────────────────────────────────────────
  it('(c) CONSUMO_REAL com 0 membros + 0 UCs pagador → SEM_MEMBROS sem throw', async () => {
    prismaMock.contratoConvenio.findFirst.mockResolvedValue(baseConvenio);
    prismaMock.convenioCooperado.findMany.mockResolvedValue([]);

    const r = await service.previewKwhConsolidado({
      convenioId: CONVENIO_ID,
      mesReferencia: 5,
      anoReferencia: 2026,
      cooperativaId: TENANT_A,
    });

    expect(r.status).toBe('SEM_MEMBROS');
    expect(r.kwhTotal).toBe(0);
    expect(r.membros).toEqual([]);
  });

  // ─── (d) SEM_UCS_CUSTEADAS (membros sem UC) ─────────────────────────
  it('(d) CONSUMO_REAL com membros sem UC → SEM_UCS_CUSTEADAS', async () => {
    prismaMock.contratoConvenio.findFirst.mockResolvedValue(baseConvenio);
    prismaMock.convenioCooperado.findMany.mockResolvedValue([
      {
        cooperado: {
          id: 'c1',
          nomeCompleto: 'Dra. A',
          cotaKwhMensal: null,
          ucs: [],
        },
      },
    ]);

    const r = await service.previewKwhConsolidado({
      convenioId: CONVENIO_ID,
      mesReferencia: 5,
      anoReferencia: 2026,
      cooperativaId: TENANT_A,
    });

    expect(r.status).toBe('SEM_UCS_CUSTEADAS');
    expect(r.membros).toHaveLength(1);
    expect(r.membros[0]!.semFaturaNoMes).toBe(true);
  });

  // ─── (e) SEM_UCS_CUSTEADAS (plano não-custeado) ─────────────────────
  it('(e) CONSUMO_REAL com UCs mas nenhuma com plano custeado → SEM_UCS_CUSTEADAS', async () => {
    prismaMock.contratoConvenio.findFirst.mockResolvedValue(baseConvenio);
    prismaMock.convenioCooperado.findMany.mockResolvedValue([
      {
        cooperado: {
          id: 'c1',
          nomeCompleto: 'Dra. A',
          cotaKwhMensal: 300,
          ucs: [{ id: 'uc1', numero: 'UC001', distribuidora: 'EDP_ES' }],
        },
      },
    ]);
    prismaMock.contrato.findMany.mockResolvedValue([]); // ZERO custeado

    const r = await service.previewKwhConsolidado({
      convenioId: CONVENIO_ID,
      mesReferencia: 5,
      anoReferencia: 2026,
      cooperativaId: TENANT_A,
    });

    expect(r.status).toBe('SEM_UCS_CUSTEADAS');
  });

  // ─── (f) SEM_FATURAS_NO_MES ─────────────────────────────────────────
  it('(f) CONSUMO_REAL com UCs custeadas mas 0 faturas no mês → SEM_FATURAS_NO_MES', async () => {
    prismaMock.contratoConvenio.findFirst.mockResolvedValue(baseConvenio);
    prismaMock.convenioCooperado.findMany.mockResolvedValue([
      {
        cooperado: {
          id: 'c1',
          nomeCompleto: 'Dra. A',
          cotaKwhMensal: 300,
          ucs: [{ id: 'uc1', numero: 'UC001', distribuidora: 'EDP_ES' }],
        },
      },
    ]);
    prismaMock.contrato.findMany.mockResolvedValue([{ ucId: 'uc1' }]);
    prismaMock.faturaProcessada.findMany.mockResolvedValue([]); // 0 faturas

    const r = await service.previewKwhConsolidado({
      convenioId: CONVENIO_ID,
      mesReferencia: 5,
      anoReferencia: 2026,
      cooperativaId: TENANT_A,
    });

    expect(r.status).toBe('SEM_FATURAS_NO_MES');
    expect(r.kwhTotal).toBe(0);
    expect(r.membros[0]!.semFaturaNoMes).toBe(true);
  });

  // ─── (g) ALOCACAO_FIXA com cotas distintas ──────────────────────────
  it('(g) ALOCACAO_FIXA com cotas 600/300/100 → rateio proporcional ao kwhAlocadoMensal=1000', async () => {
    prismaMock.contratoConvenio.findFirst.mockResolvedValue({
      ...baseConvenio,
      baseCobrancaCusteio: 'ALOCACAO_FIXA',
      kwhAlocadoMensal: 1000,
    });
    prismaMock.convenioCooperado.findMany.mockResolvedValue([
      {
        cooperado: {
          id: 'c1',
          nomeCompleto: 'A',
          cotaKwhMensal: 600,
          ucs: [{ id: 'uc1', numero: 'UC001', distribuidora: 'EDP_ES' }],
        },
      },
      {
        cooperado: {
          id: 'c2',
          nomeCompleto: 'B',
          cotaKwhMensal: 300,
          ucs: [{ id: 'uc2', numero: 'UC002', distribuidora: 'EDP_ES' }],
        },
      },
      {
        cooperado: {
          id: 'c3',
          nomeCompleto: 'C',
          cotaKwhMensal: 100,
          ucs: [{ id: 'uc3', numero: 'UC003', distribuidora: 'EDP_ES' }],
        },
      },
    ]);

    const r = await service.previewKwhConsolidado({
      convenioId: CONVENIO_ID,
      mesReferencia: 5,
      anoReferencia: 2026,
      cooperativaId: TENANT_A,
    });

    expect(r.status).toBe('OK');
    expect(r.kwhTotal).toBe(1000);
    expect(r.warningRateioIgualitario).toBeUndefined();
    expect(r.membros).toHaveLength(3);
    expect(r.membros.find((m) => m.cooperadoId === 'c1')!.kwh).toBe(600);
    expect(r.membros.find((m) => m.cooperadoId === 'c2')!.kwh).toBe(300);
    expect(r.membros.find((m) => m.cooperadoId === 'c3')!.kwh).toBe(100);
    expect(r.membros[0]!.fonte).toBe('rateio');
  });

  // ─── (h) ALOCACAO_FIXA fallback IGUALITARIO ─────────────────────────
  it('(h) ALOCACAO_FIXA com todas cotas=null → fallback IGUALITARIO + warning=true', async () => {
    prismaMock.contratoConvenio.findFirst.mockResolvedValue({
      ...baseConvenio,
      baseCobrancaCusteio: 'ALOCACAO_FIXA',
      kwhAlocadoMensal: 900,
    });
    prismaMock.convenioCooperado.findMany.mockResolvedValue([
      {
        cooperado: { id: 'c1', nomeCompleto: 'A', cotaKwhMensal: null, ucs: [] },
      },
      {
        cooperado: { id: 'c2', nomeCompleto: 'B', cotaKwhMensal: null, ucs: [] },
      },
      {
        cooperado: { id: 'c3', nomeCompleto: 'C', cotaKwhMensal: null, ucs: [] },
      },
    ]);

    const r = await service.previewKwhConsolidado({
      convenioId: CONVENIO_ID,
      mesReferencia: 5,
      anoReferencia: 2026,
      cooperativaId: TENANT_A,
    });

    expect(r.status).toBe('OK');
    expect(r.warningRateioIgualitario).toBe(true);
    expect(r.membros).toHaveLength(3);
    expect(r.membros.every((m) => m.kwh === 300)).toBe(true);
  });

  // ─── (i) ALOCACAO_FIXA sem kwhAlocadoMensal ─────────────────────────
  it('(i) ALOCACAO_FIXA sem kwhAlocadoMensal → throw BadRequest (config errada)', async () => {
    prismaMock.contratoConvenio.findFirst.mockResolvedValue({
      ...baseConvenio,
      baseCobrancaCusteio: 'ALOCACAO_FIXA',
      kwhAlocadoMensal: null,
    });

    await expect(
      service.previewKwhConsolidado({
        convenioId: CONVENIO_ID,
        mesReferencia: 5,
        anoReferencia: 2026,
        cooperativaId: TENANT_A,
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  // ─── (j) anti-IDOR: cooperativaId errada ────────────────────────────
  it('(j) anti-IDOR: cooperativaId errada → NotFound (não vaza existência)', async () => {
    prismaMock.contratoConvenio.findFirst.mockResolvedValue(null);

    await expect(
      service.previewKwhConsolidado({
        convenioId: CONVENIO_ID,
        mesReferencia: 5,
        anoReferencia: 2026,
        cooperativaId: 'OUTRO-TENANT',
      }),
    ).rejects.toBeInstanceOf(NotFoundException);

    // Confirma que o where exigiu cooperativaId no filtro
    expect(prismaMock.contratoConvenio.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: CONVENIO_ID, cooperativaId: 'OUTRO-TENANT' },
      }),
    );
  });

  // ─── (k) pagador != EMPRESA ─────────────────────────────────────────
  it('(k) pagador=COOPERADO → throw BadRequest', async () => {
    prismaMock.contratoConvenio.findFirst.mockResolvedValue({
      ...baseConvenio,
      pagador: 'COOPERADO',
    });

    await expect(
      service.previewKwhConsolidado({
        convenioId: CONVENIO_ID,
        mesReferencia: 5,
        anoReferencia: 2026,
        cooperativaId: TENANT_A,
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  // ─── (l) UCs do pagador entram como entrada virtual isPagador ───────
  it('(l) empresa COM_UC própria com contrato custeado → entrada virtual isPagador=true', async () => {
    prismaMock.contratoConvenio.findFirst.mockResolvedValue(baseConvenio);
    prismaMock.convenioCooperado.findMany.mockResolvedValue([
      {
        cooperado: {
          id: 'c1',
          nomeCompleto: 'Dra. A',
          cotaKwhMensal: 300,
          ucs: [{ id: 'uc1', numero: 'UC001', distribuidora: 'EDP_ES' }],
        },
      },
    ]);
    // Pagador COM 1 UC própria
    prismaMock.uc.findMany.mockResolvedValue([
      { id: 'uc-pagador-1', numero: 'PAG999', distribuidora: 'EDP_ES' },
    ]);
    prismaMock.contrato.findMany.mockResolvedValue([
      { ucId: 'uc1' },
      { ucId: 'uc-pagador-1' },
    ]);
    prismaMock.faturaProcessada.findMany.mockResolvedValue([
      { ucId: 'uc1', dadosExtraidos: { consumoAtualKwh: 300 }, mediaKwhCalculada: '300' },
      {
        ucId: 'uc-pagador-1',
        dadosExtraidos: { consumoAtualKwh: 100 },
        mediaKwhCalculada: '100',
      },
    ]);

    const r = await service.previewKwhConsolidado({
      convenioId: CONVENIO_ID,
      mesReferencia: 5,
      anoReferencia: 2026,
      cooperativaId: TENANT_A,
    });

    expect(r.status).toBe('OK');
    expect(r.kwhTotal).toBe(400);
    expect(r.membros).toHaveLength(2);
    const entradaPagador = r.membros.find((m) => m.isPagador);
    expect(entradaPagador).toBeDefined();
    expect(entradaPagador!.kwh).toBe(100);
    expect(entradaPagador!.ucs[0]!.numero).toBe('PAG999');
  });
});
