import { BadRequestException, NotFoundException } from '@nestjs/common';
import { ConveniosCusteioService } from './convenios-custeio.service';

/**
 * D-FISCAL-2.4.4a (02/06/2026) — Specs do motor de cobrança consolidada.
 *
 * Cobre:
 *  1. CONSUMO_REAL consolida N membros em 1 cobrança (chama cobrancas.create
 *     uma única vez com soma dos kWh × tarifa).
 *  2. ALOCACAO_FIXA usa kwhAlocadoMensal (não soma faturas).
 *  3. Aplica descontoKwhCusteio (Math.round monetário).
 *  4. Idempotência soft: cobrança existente → status JA_EXISTE, NÃO chama create.
 *  5. pagador=CADA_MEMBRO → BadRequest (não gera).
 *  6. Convênio status≠ATIVO → BadRequest.
 *  7. Sem pagadorCooperadoId → BadRequest.
 *  8. Sem membros ativos → status SEM_MEMBROS.
 *  9. Multi-tenant: cooperativaId errado → NotFound.
 * 10. Tarifa ausente → throw explícito (NUNCA fallback).
 * 11. Plano consolidador custeado=true → throw (defesa em profundidade).
 *
 * Helper `criarOuRecuperarContratoConsolidador` testado indiretamente via
 * fluxo principal (lazy create na 1ª geração).
 */
describe('ConveniosCusteioService — D-FISCAL-2.4.4a', () => {
  const findFirstConvenio = jest.fn();
  const updateConvenio = jest.fn();
  const findFirstCobranca = jest.fn();
  const createCobranca = jest.fn();
  const findManyMembros = jest.fn();
  const findManyFaturas = jest.fn();
  const findManyTarifas = jest.fn();
  const findFirstTarifa = jest.fn();
  const findFirstPlano = jest.fn();
  const findUniqueUc = jest.fn();
  const createUc = jest.fn();
  const findManyUcsPagador = jest.fn();
  const findUniqueContrato = jest.fn();
  const createContrato = jest.fn();
  // D-FISCAL-2.4.4a.2: filtro invariante custeado⟺consolidado
  const findManyContratosCusteado = jest.fn();
  const createLancamentoCaixa = jest.fn();
  const transactionFn = jest.fn();

  // Mock tx que rebatena os mocks de cima
  const txMock = {
    cobranca: { create: createCobranca },
    lancamentoCaixa: { create: createLancamentoCaixa },
  };

  const prismaMock = {
    contratoConvenio: { findFirst: findFirstConvenio, update: updateConvenio },
    cobranca: { findFirst: findFirstCobranca, create: createCobranca },
    lancamentoCaixa: { create: createLancamentoCaixa },
    convenioCooperado: { findMany: findManyMembros },
    faturaProcessada: { findMany: findManyFaturas },
    tarifaConcessionaria: {
      findMany: findManyTarifas,
      findFirst: findFirstTarifa,
    },
    plano: { findFirst: findFirstPlano },
    uc: { findUnique: findUniqueUc, create: createUc, findMany: findManyUcsPagador },
    contrato: {
      findUnique: findUniqueContrato,
      create: createContrato,
      findMany: findManyContratosCusteado, // D-FISCAL-2.4.4a.2 filtro custeado
    },
    $transaction: transactionFn,
  } as any;

  let service: ConveniosCusteioService;

  // Fixtures
  const convenioBase = {
    id: 'conv-1',
    empresaNome: 'Clínica Médica X',
    status: 'ATIVO',
    pagador: 'EMPRESA',
    cooperativaId: 'coop-A',
    pagadorCooperadoId: 'pagador-1',
    baseCobrancaCusteio: 'CONSUMO_REAL',
    kwhAlocadoMensal: null,
    descontoKwhCusteio: null,
    contratoConsolidadorId: 'contrato-cons-1', // já existe (skip lazy create)
  };

  const tarifaEdpEs = {
    concessionaria: 'EDP_ES',
    tusdNova: '0.46863',
    teNova: '0.32068',
    dataVigencia: new Date('2026-01-01'),
  };

  beforeEach(() => {
    jest.resetAllMocks();
    service = new ConveniosCusteioService(prismaMock);

    // Defaults: contrato consolidador existe + plano válido
    findUniqueContrato.mockResolvedValue({
      id: 'contrato-cons-1',
      plano: { custeadoPorConvenio: false, nome: 'Consolidador de Custeio' },
    });
    findFirstPlano.mockResolvedValue({
      id: 'plano-cons',
      custeadoPorConvenio: false,
    });
    createCobranca.mockResolvedValue({ id: 'cob-novo-1' });
    createLancamentoCaixa.mockResolvedValue({ id: 'lanc-1' });
    // $transaction roda o callback passando o tx mock
    transactionFn.mockImplementation(async (cb: any) => cb(txMock));
    // D-FISCAL-2.4.4a.1 — default: pagador SEM UC própria (empresa SEM_UC).
    // Specs específicos de COM_UC sobrescrevem com mockResolvedValueOnce.
    findManyUcsPagador.mockResolvedValue([]);
    // D-FISCAL-2.4.4a.2 — default: TODAS as UCs candidatas têm contrato custeado.
    // Specs específicos do invariante sobrescrevem com mockResolvedValueOnce
    // pra simular UCs não-custeadas (que devem ser excluídas).
    findManyContratosCusteado.mockImplementation(async (args: any) => {
      const ucIds: string[] = args?.where?.ucId?.in ?? [];
      // Por default, retorna 1 contrato custeado pra cada UC candidata
      return ucIds.map((ucId) => ({ ucId }));
    });
  });

  // ============================================================
  // CASOS DE SUCESSO
  // ============================================================

  it('CONSUMO_REAL: consolida 3 membros em 1 cobrança', async () => {
    findFirstConvenio.mockResolvedValue(convenioBase);
    findFirstCobranca.mockResolvedValue(null); // não existe ainda
    findManyMembros.mockResolvedValue([
      {
        cooperado: {
          id: 'mem-1',
          nomeCompleto: 'Dr. A',
          ucs: [{ id: 'uc-1', numero: '001', distribuidora: 'EDP_ES' }],
        },
      },
      {
        cooperado: {
          id: 'mem-2',
          nomeCompleto: 'Dr. B',
          ucs: [{ id: 'uc-2', numero: '002', distribuidora: 'EDP_ES' }],
        },
      },
      {
        cooperado: {
          id: 'mem-3',
          nomeCompleto: 'Dr. C',
          ucs: [{ id: 'uc-3', numero: '003', distribuidora: 'EDP_ES' }],
        },
      },
    ]);
    findManyFaturas.mockResolvedValue([
      { ucId: 'uc-1', dadosExtraidos: { consumoAtualKwh: 300 }, mediaKwhCalculada: '300' },
      { ucId: 'uc-2', dadosExtraidos: { consumoAtualKwh: 400 }, mediaKwhCalculada: '400' },
      { ucId: 'uc-3', dadosExtraidos: { consumoAtualKwh: 500 }, mediaKwhCalculada: '500' },
    ]);
    findManyTarifas.mockResolvedValue([tarifaEdpEs]);

    const r = await service.gerarCobrancaConsolidada({
      convenioId: 'conv-1',
      mesReferencia: 5,
      anoReferencia: 2026,
      cooperativaId: 'coop-A',
    });

    expect(r.status).toBe('CRIADA');
    expect(createCobranca).toHaveBeenCalledTimes(1);
    const bodyArg = createCobranca.mock.calls[0][0].data;
    expect(bodyArg.cooperativaId).toBe('coop-A');
    expect(bodyArg.contratoId).toBe('contrato-cons-1');
    expect(bodyArg.mesReferencia).toBe(5);
    expect(bodyArg.anoReferencia).toBe(2026);
    expect(bodyArg.convenioContabilCobrancaId).toBe('conv-1');

    // 1200 kWh * (0.46863 + 0.32068) = 1200 * 0.78931 = 947.172 → R$ 947.17
    expect(Number(bodyArg.valorBruto)).toBeCloseTo(947.17, 2);
    expect(Number(bodyArg.percentualDesconto)).toBe(0);
    expect(Number(bodyArg.valorLiquido)).toBeCloseTo(947.17, 2);

    // LancamentoCaixa PREVISTO criado dentro da mesma tx
    expect(createLancamentoCaixa).toHaveBeenCalledTimes(1);
    const lancArg = createLancamentoCaixa.mock.calls[0][0].data;
    expect(lancArg.tipo).toBe('RECEITA');
    expect(lancArg.status).toBe('PREVISTO');
    expect(lancArg.cooperativaId).toBe('coop-A');
    expect(lancArg.cooperadoId).toBe('pagador-1');
    expect(Number(lancArg.valor)).toBeCloseTo(947.17, 2);
  });

  it('CONSUMO_REAL com desconto 20%: aplica Math.round monetário', async () => {
    findFirstConvenio.mockResolvedValue({
      ...convenioBase,
      descontoKwhCusteio: '20', // 20%
    });
    findFirstCobranca.mockResolvedValue(null);
    findManyMembros.mockResolvedValue([
      {
        cooperado: {
          id: 'mem-1',
          nomeCompleto: 'Dr. A',
          ucs: [{ id: 'uc-1', numero: '001', distribuidora: 'EDP_ES' }],
        },
      },
    ]);
    findManyFaturas.mockResolvedValue([
      { ucId: 'uc-1', dadosExtraidos: { consumoAtualKwh: 1000 }, mediaKwhCalculada: '1000' },
    ]);
    findManyTarifas.mockResolvedValue([tarifaEdpEs]);

    await service.gerarCobrancaConsolidada({
      convenioId: 'conv-1',
      mesReferencia: 5,
      anoReferencia: 2026,
      cooperativaId: 'coop-A',
    });

    const bodyArg = createCobranca.mock.calls[0][0].data;
    // 1000 * 0.78931 = 789.31 bruto
    expect(Number(bodyArg.valorBruto)).toBeCloseTo(789.31, 2);
    // 789.31 * 0.80 = 631.448 → R$ 631.45
    expect(Number(bodyArg.valorLiquido)).toBeCloseTo(631.45, 2);
    expect(Number(bodyArg.valorDesconto)).toBeCloseTo(157.86, 2);
    expect(Number(bodyArg.percentualDesconto)).toBe(20);
  });

  it('ALOCACAO_FIXA: usa kwhAlocadoMensal, não soma faturas', async () => {
    findFirstConvenio.mockResolvedValue({
      ...convenioBase,
      baseCobrancaCusteio: 'ALOCACAO_FIXA',
      kwhAlocadoMensal: 5000,
    });
    findFirstCobranca.mockResolvedValue(null);
    findManyMembros.mockResolvedValue([
      {
        cooperado: {
          id: 'mem-1',
          nomeCompleto: 'Dr. A',
          ucs: [{ id: 'uc-1', distribuidora: 'EDP_ES' }],
        },
      },
    ]);
    findManyTarifas.mockResolvedValue([tarifaEdpEs]);

    await service.gerarCobrancaConsolidada({
      convenioId: 'conv-1',
      mesReferencia: 5,
      anoReferencia: 2026,
      cooperativaId: 'coop-A',
    });

    // 5000 * 0.78931 = 3946.55
    const bodyArg = createCobranca.mock.calls[0][0].data;
    expect(Number(bodyArg.valorBruto)).toBeCloseTo(3946.55, 2);
    // NÃO consultou faturas (base ALOCACAO_FIXA)
    expect(findManyFaturas).not.toHaveBeenCalled();
  });

  // ============================================================
  // IDEMPOTÊNCIA
  // ============================================================

  it('idempotência soft: cobrança existente → JA_EXISTE + NÃO chama create', async () => {
    findFirstConvenio.mockResolvedValue(convenioBase);
    findFirstCobranca.mockResolvedValue({ id: 'cob-existente-1' });

    const r = await service.gerarCobrancaConsolidada({
      convenioId: 'conv-1',
      mesReferencia: 5,
      anoReferencia: 2026,
      cooperativaId: 'coop-A',
    });

    expect(r.status).toBe('JA_EXISTE');
    if (r.status === 'JA_EXISTE') {
      expect(r.cobrancaId).toBe('cob-existente-1');
    }
    expect(createCobranca).not.toHaveBeenCalled();
  });

  it('idempotência hard (skipIfExists=false): cobrança existente → BadRequest', async () => {
    findFirstConvenio.mockResolvedValue(convenioBase);
    findFirstCobranca.mockResolvedValue({ id: 'cob-existente-1' });

    await expect(
      service.gerarCobrancaConsolidada({
        convenioId: 'conv-1',
        mesReferencia: 5,
        anoReferencia: 2026,
        cooperativaId: 'coop-A',
        skipIfExists: false,
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  // ============================================================
  // ENFORCEMENTS
  // ============================================================

  it('pagador=CADA_MEMBRO → BadRequest (não gera consolidada)', async () => {
    findFirstConvenio.mockResolvedValue({
      ...convenioBase,
      pagador: 'CADA_MEMBRO',
    });

    await expect(
      service.gerarCobrancaConsolidada({
        convenioId: 'conv-1',
        mesReferencia: 5,
        anoReferencia: 2026,
        cooperativaId: 'coop-A',
      }),
    ).rejects.toThrow(/pagador=EMPRESA/);

    expect(createCobranca).not.toHaveBeenCalled();
  });

  it('status≠ATIVO → BadRequest', async () => {
    findFirstConvenio.mockResolvedValue({
      ...convenioBase,
      status: 'PAUSADO',
    });

    await expect(
      service.gerarCobrancaConsolidada({
        convenioId: 'conv-1',
        mesReferencia: 5,
        anoReferencia: 2026,
        cooperativaId: 'coop-A',
      }),
    ).rejects.toThrow(/não está ATIVO/);
  });

  it('sem pagadorCooperadoId → BadRequest', async () => {
    findFirstConvenio.mockResolvedValue({
      ...convenioBase,
      pagadorCooperadoId: null,
    });

    await expect(
      service.gerarCobrancaConsolidada({
        convenioId: 'conv-1',
        mesReferencia: 5,
        anoReferencia: 2026,
        cooperativaId: 'coop-A',
      }),
    ).rejects.toThrow(/sem pagadorCooperadoId/);
  });

  it('multi-tenant: cooperativaId errado → NotFound', async () => {
    findFirstConvenio.mockResolvedValue(null);

    await expect(
      service.gerarCobrancaConsolidada({
        convenioId: 'conv-1',
        mesReferencia: 5,
        anoReferencia: 2026,
        cooperativaId: 'coop-OUTRA',
      }),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('sem membros ativos → SEM_MEMBROS (sem erro, log + skip)', async () => {
    findFirstConvenio.mockResolvedValue(convenioBase);
    findFirstCobranca.mockResolvedValue(null);
    findManyMembros.mockResolvedValue([]);

    const r = await service.gerarCobrancaConsolidada({
      convenioId: 'conv-1',
      mesReferencia: 5,
      anoReferencia: 2026,
      cooperativaId: 'coop-A',
    });

    expect(r.status).toBe('SEM_MEMBROS');
    expect(createCobranca).not.toHaveBeenCalled();
  });

  // ============================================================
  // TARIFA — decisão Luciano: SEMPRE throw, nunca fallback 0.5
  // ============================================================

  it('tarifa ausente → throw explícito (NUNCA fallback 0.5 silencioso)', async () => {
    findFirstConvenio.mockResolvedValue(convenioBase);
    findFirstCobranca.mockResolvedValue(null);
    findManyMembros.mockResolvedValue([
      {
        cooperado: {
          id: 'mem-1',
          nomeCompleto: 'Dr. A',
          ucs: [{ id: 'uc-1', numero: '001', distribuidora: 'EDP_ES' }],
        },
      },
    ]);
    findManyFaturas.mockResolvedValue([
      { ucId: 'uc-1', dadosExtraidos: { consumoAtualKwh: 300 }, mediaKwhCalculada: '300' },
    ]);
    // Zero tarifas no banco
    findManyTarifas.mockResolvedValue([]);
    findFirstTarifa.mockResolvedValue(null);

    await expect(
      service.gerarCobrancaConsolidada({
        convenioId: 'conv-1',
        mesReferencia: 5,
        anoReferencia: 2026,
        cooperativaId: 'coop-A',
      }),
    ).rejects.toThrow(/Nenhuma TarifaConcessionaria cadastrada/);

    expect(createCobranca).not.toHaveBeenCalled();
  });

  // ============================================================
  // DEFESA EM PROFUNDIDADE — plano consolidador NÃO pode ser custeado
  // ============================================================

  it('contrato consolidador com plano custeado=true → throw (defesa em profundidade)', async () => {
    findFirstConvenio.mockResolvedValue(convenioBase);
    findFirstCobranca.mockResolvedValue(null);
    findUniqueContrato.mockResolvedValueOnce({
      id: 'contrato-cons-1',
      plano: { custeadoPorConvenio: true, nome: 'Custeado por convênio' },
    });

    await expect(
      service.gerarCobrancaConsolidada({
        convenioId: 'conv-1',
        mesReferencia: 5,
        anoReferencia: 2026,
        cooperativaId: 'coop-A',
      }),
    ).rejects.toThrow(/custeado/i);

    expect(createCobranca).not.toHaveBeenCalled();
  });

  // ============================================================
  // LAZY CREATE do contrato consolidador (1ª geração)
  // ============================================================

  it('1ª geração: lazy create do contrato consolidador + UC sintética', async () => {
    findFirstConvenio.mockResolvedValueOnce({
      ...convenioBase,
      contratoConsolidadorId: null, // ainda não existe
    });
    // Dentro do criarOuRecuperarContratoConsolidador (re-load do convênio)
    findFirstConvenio.mockResolvedValueOnce({
      id: 'conv-1',
      contratoConsolidadorId: null,
      empresaNome: 'Clínica Médica X',
    });
    findUniqueUc.mockResolvedValueOnce(null); // UC sintética não existe
    createUc.mockResolvedValueOnce({ id: 'uc-sintetica-1' });
    createContrato.mockResolvedValueOnce({ id: 'contrato-cons-novo' });
    updateConvenio.mockResolvedValueOnce({});

    // Depois da criação do contrato, idempotência check passa
    findFirstCobranca.mockResolvedValueOnce(null);
    findManyMembros.mockResolvedValue([
      {
        cooperado: {
          id: 'mem-1',
          nomeCompleto: 'Dr. A',
          ucs: [{ id: 'uc-real-1', numero: '001', distribuidora: 'EDP_ES' }],
        },
      },
    ]);
    findManyFaturas.mockResolvedValue([
      { ucId: 'uc-real-1', dadosExtraidos: { consumoAtualKwh: 500 }, mediaKwhCalculada: '500' },
    ]);
    findManyTarifas.mockResolvedValue([tarifaEdpEs]);

    const r = await service.gerarCobrancaConsolidada({
      convenioId: 'conv-1',
      mesReferencia: 5,
      anoReferencia: 2026,
      cooperativaId: 'coop-A',
    });

    expect(r.status).toBe('CRIADA');
    expect(createUc).toHaveBeenCalledTimes(1);
    expect(createUc.mock.calls[0][0].data.numero).toBe('CONSOLIDADOR-conv-1');
    expect(createUc.mock.calls[0][0].data.cooperadoId).toBe('pagador-1');
    expect(createContrato).toHaveBeenCalledTimes(1);
    expect(createContrato.mock.calls[0][0].data.ucId).toBe('uc-sintetica-1');
    expect(createContrato.mock.calls[0][0].data.planoId).toBe('plano-cons');
    expect(updateConvenio).toHaveBeenCalledWith({
      where: { id: 'conv-1' },
      data: { contratoConsolidadorId: 'contrato-cons-novo' },
    });
    // Cobrança usa o contrato recém-criado
    const bodyArg = createCobranca.mock.calls[0][0].data;
    expect(bodyArg.contratoId).toBe('contrato-cons-novo');
  });

  // ============================================================
  // D-FISCAL-2.4.4a.1 — empresa COM_UC beneficiária no consolidado
  // ============================================================

  it('D-FISCAL-2.4.4a.1: empresa COM_UC com contrato custeado (pré-existente) → UC própria entra no consolidado', async () => {
    // Cenário: empresa COM_UC com contrato pré-existente já marcado como custeado
    // (ex: setup manual via admin antes do Wizard 2.4.3). UC passa pelo filtro
    // invariante 2.4.4a.2 e entra no total.
    findFirstConvenio.mockResolvedValue(convenioBase);
    findFirstCobranca.mockResolvedValue(null);
    findManyMembros.mockResolvedValue([
      {
        cooperado: {
          id: 'mem-1',
          nomeCompleto: 'Dr. A',
          ucs: [{ id: 'uc-mem-1', numero: '001', distribuidora: 'EDP_ES' }],
        },
      },
    ]);
    // Pagador (empresa) tem 1 UC real própria
    findManyUcsPagador.mockResolvedValueOnce([
      { id: 'uc-empresa-1', numero: '999', distribuidora: 'EDP_ES' },
    ]);
    // Default do mock: ambas UCs (uc-mem-1 + uc-empresa-1) têm contrato custeado
    // → passam pelo filtro invariante 2.4.4a.2
    findManyFaturas.mockResolvedValue([
      { ucId: 'uc-mem-1', dadosExtraidos: { consumoAtualKwh: 400 }, mediaKwhCalculada: '400' },
      { ucId: 'uc-empresa-1', dadosExtraidos: { consumoAtualKwh: 600 }, mediaKwhCalculada: '600' },
    ]);
    findManyTarifas.mockResolvedValue([tarifaEdpEs]);

    const r = await service.gerarCobrancaConsolidada({
      convenioId: 'conv-1',
      mesReferencia: 5,
      anoReferencia: 2026,
      cooperativaId: 'coop-A',
    });

    expect(r.status).toBe('CRIADA');
    // Total: 400 (membro) + 600 (empresa) = 1000 kWh × 0.78931 = 789.31
    const bodyArg = createCobranca.mock.calls[0][0].data;
    expect(Number(bodyArg.valorBruto)).toBeCloseTo(789.31, 2);

    // Query filtrou UC sintética via NOT startsWith
    expect(findManyUcsPagador).toHaveBeenCalledTimes(1);
    const argsUcs = findManyUcsPagador.mock.calls[0][0];
    expect(argsUcs.where.cooperadoId).toBe('pagador-1');
    expect(argsUcs.where.NOT).toEqual({ numero: { startsWith: 'CONSOLIDADOR-' } });
  });

  it('D-FISCAL-2.4.4a.1: empresa SEM_UC → total = só membros (zero UC pagador)', async () => {
    findFirstConvenio.mockResolvedValue(convenioBase);
    findFirstCobranca.mockResolvedValue(null);
    findManyMembros.mockResolvedValue([
      {
        cooperado: {
          id: 'mem-1',
          nomeCompleto: 'Dr. A',
          ucs: [{ id: 'uc-mem-1', numero: '001', distribuidora: 'EDP_ES' }],
        },
      },
    ]);
    // Pagador SEM UC real (default já é [] no beforeEach)
    findManyFaturas.mockResolvedValue([
      { ucId: 'uc-mem-1', dadosExtraidos: { consumoAtualKwh: 500 }, mediaKwhCalculada: '500' },
    ]);
    findManyTarifas.mockResolvedValue([tarifaEdpEs]);

    await service.gerarCobrancaConsolidada({
      convenioId: 'conv-1',
      mesReferencia: 5,
      anoReferencia: 2026,
      cooperativaId: 'coop-A',
    });

    // Só o membro: 500 × 0.78931 = 394.66
    const bodyArg = createCobranca.mock.calls[0][0].data;
    expect(Number(bodyArg.valorBruto)).toBeCloseTo(394.66, 2);
  });

  it('D-FISCAL-2.4.4a.1: SEM double-count quando empresa COM_UC TAMBÉM é membro', async () => {
    findFirstConvenio.mockResolvedValue(convenioBase);
    findFirstCobranca.mockResolvedValue(null);
    // Pagador (id='pagador-1') é MEMBRO e tem a mesma UC real
    findManyMembros.mockResolvedValue([
      {
        cooperado: {
          id: 'pagador-1', // o próprio pagador é membro
          nomeCompleto: 'Clínica Médica X',
          ucs: [{ id: 'uc-empresa-1', numero: '999', distribuidora: 'EDP_ES' }],
        },
      },
      {
        cooperado: {
          id: 'mem-2',
          nomeCompleto: 'Dr. B',
          ucs: [{ id: 'uc-mem-2', numero: '002', distribuidora: 'EDP_ES' }],
        },
      },
    ]);
    // Mesma UC retornada também via busca do pagador (cenário real)
    findManyUcsPagador.mockResolvedValueOnce([
      { id: 'uc-empresa-1', numero: '999', distribuidora: 'EDP_ES' },
    ]);
    // Faturas: 1 pra cada UC distinta
    findManyFaturas.mockResolvedValue([
      { ucId: 'uc-empresa-1', dadosExtraidos: { consumoAtualKwh: 800 }, mediaKwhCalculada: '800' },
      { ucId: 'uc-mem-2', dadosExtraidos: { consumoAtualKwh: 200 }, mediaKwhCalculada: '200' },
    ]);
    findManyTarifas.mockResolvedValue([tarifaEdpEs]);

    await service.gerarCobrancaConsolidada({
      convenioId: 'conv-1',
      mesReferencia: 5,
      anoReferencia: 2026,
      cooperativaId: 'coop-A',
    });

    // SEM double-count: 800 + 200 = 1000 kWh × 0.78931 = 789.31 (NÃO 1800)
    const bodyArg = createCobranca.mock.calls[0][0].data;
    expect(Number(bodyArg.valorBruto)).toBeCloseTo(789.31, 2);

    // Validação extra: faturas foi chamado com 2 ucIds únicos (dedup via Set)
    const ucIdsArg = findManyFaturas.mock.calls[0][0].where.ucId.in as string[];
    expect(ucIdsArg).toHaveLength(2);
    expect(new Set(ucIdsArg)).toEqual(new Set(['uc-empresa-1', 'uc-mem-2']));
  });

  // ============================================================
  // D-FISCAL-2.4.4a.2 — INVARIANTE custeado⟺consolidado (zero double-bill)
  // ============================================================

  it('D-FISCAL-2.4.4a.2: empresa COM_UC membro custeado → UC no consolidado', async () => {
    findFirstConvenio.mockResolvedValue(convenioBase);
    findFirstCobranca.mockResolvedValue(null);
    findManyMembros.mockResolvedValue([
      {
        cooperado: {
          id: 'pagador-1', // empresa é membro
          nomeCompleto: 'Clínica X (membro)',
          ucs: [{ id: 'uc-empresa-1', numero: '999', distribuidora: 'EDP_ES' }],
        },
      },
    ]);
    findManyUcsPagador.mockResolvedValueOnce([
      { id: 'uc-empresa-1', numero: '999', distribuidora: 'EDP_ES' },
    ]);
    // UC da empresa TEM contrato custeado (porque ela é membro custeado)
    findManyContratosCusteado.mockResolvedValueOnce([{ ucId: 'uc-empresa-1' }]);
    findManyFaturas.mockResolvedValue([
      { ucId: 'uc-empresa-1', dadosExtraidos: { consumoAtualKwh: 800 }, mediaKwhCalculada: '800' },
    ]);
    findManyTarifas.mockResolvedValue([tarifaEdpEs]);

    const r = await service.gerarCobrancaConsolidada({
      convenioId: 'conv-1',
      mesReferencia: 5,
      anoReferencia: 2026,
      cooperativaId: 'coop-A',
    });

    expect(r.status).toBe('CRIADA');
    // 800 × 0.78931 = 631.45
    const bodyArg = createCobranca.mock.calls[0][0].data;
    expect(Number(bodyArg.valorBruto)).toBeCloseTo(631.45, 2);
    // Filtro custeado foi consultado com a UC candidata
    expect(findManyContratosCusteado).toHaveBeenCalledTimes(1);
    const filterArgs = findManyContratosCusteado.mock.calls[0][0];
    expect(filterArgs.where.status).toBe('ATIVO');
    expect(filterArgs.where.plano).toEqual({ custeadoPorConvenio: true });
    expect(filterArgs.where.ucId.in).toContain('uc-empresa-1');
  });

  it('D-FISCAL-2.4.4a.2: empresa COM_UC NÃO-membro (UC sem contrato custeado) → UC EXCLUÍDA do consolidado', async () => {
    findFirstConvenio.mockResolvedValue(convenioBase);
    findFirstCobranca.mockResolvedValue(null);
    findManyMembros.mockResolvedValue([
      {
        cooperado: {
          id: 'mem-1',
          nomeCompleto: 'Dr. A (membro custeado)',
          ucs: [{ id: 'uc-mem-1', numero: '001', distribuidora: 'EDP_ES' }],
        },
      },
    ]);
    // Pagador tem UC real, mas NÃO é membro → contrato dela NÃO é custeado
    findManyUcsPagador.mockResolvedValueOnce([
      { id: 'uc-empresa-NAO-custeada', numero: '999', distribuidora: 'EDP_ES' },
    ]);
    // Filtro custeado retorna SÓ a UC do membro — a UC da empresa NÃO entra
    findManyContratosCusteado.mockResolvedValueOnce([{ ucId: 'uc-mem-1' }]);
    findManyFaturas.mockResolvedValue([
      // Mesmo se houver fatura da UC da empresa, ela não entra (filtro impede)
      { ucId: 'uc-mem-1', dadosExtraidos: { consumoAtualKwh: 500 }, mediaKwhCalculada: '500' },
    ]);
    findManyTarifas.mockResolvedValue([tarifaEdpEs]);

    const r = await service.gerarCobrancaConsolidada({
      convenioId: 'conv-1',
      mesReferencia: 5,
      anoReferencia: 2026,
      cooperativaId: 'coop-A',
    });

    expect(r.status).toBe('CRIADA');
    // Total = só membro (500). UC da empresa NÃO-custeada NÃO entra.
    const bodyArg = createCobranca.mock.calls[0][0].data;
    expect(Number(bodyArg.valorBruto)).toBeCloseTo(394.66, 2); // 500 × 0.78931

    // findManyFaturas foi chamado SÓ com a UC custeada (uc-mem-1), não a NÃO-custeada
    const faturasArgs = findManyFaturas.mock.calls[0][0];
    expect(faturasArgs.where.ucId.in).toEqual(['uc-mem-1']);
    expect(faturasArgs.where.ucId.in).not.toContain('uc-empresa-NAO-custeada');
  });

  it('D-FISCAL-2.4.4a.2: ZERO UC custeada → BadRequest (não gera consolidada vazia)', async () => {
    findFirstConvenio.mockResolvedValue(convenioBase);
    findFirstCobranca.mockResolvedValue(null);
    findManyMembros.mockResolvedValue([
      {
        cooperado: {
          id: 'mem-1',
          nomeCompleto: 'Dr. A (contrato antigo NÃO migrado)',
          ucs: [{ id: 'uc-mem-1', numero: '001', distribuidora: 'EDP_ES' }],
        },
      },
    ]);
    findManyUcsPagador.mockResolvedValueOnce([
      { id: 'uc-empresa-NAO-custeada', numero: '999', distribuidora: 'EDP_ES' },
    ]);
    // Filtro custeado retorna VAZIO — nenhuma UC candidata tem contrato custeado
    findManyContratosCusteado.mockResolvedValueOnce([]);
    findManyTarifas.mockResolvedValue([tarifaEdpEs]);

    await expect(
      service.gerarCobrancaConsolidada({
        convenioId: 'conv-1',
        mesReferencia: 5,
        anoReferencia: 2026,
        cooperativaId: 'coop-A',
      }),
    ).rejects.toThrow(/nenhuma.*contrato ATIVO com plano custeado/);

    expect(createCobranca).not.toHaveBeenCalled();
  });

  it('D-FISCAL-2.4.4a.1: convênio só com pagador COM_UC (zero membros UCs) → consolidada gerada', async () => {
    findFirstConvenio.mockResolvedValue(convenioBase);
    findFirstCobranca.mockResolvedValue(null);
    findManyMembros.mockResolvedValue([
      // Membro placeholder sem UC (caso real: empresa pagadora cadastrada
      // como único membro mas a UC dela ainda não foi vinculada como membership;
      // a busca explícita por pagador resolve)
      {
        cooperado: {
          id: 'mem-1',
          nomeCompleto: 'Dr. A',
          ucs: [],
        },
      },
    ]);
    findManyUcsPagador.mockResolvedValueOnce([
      { id: 'uc-empresa-1', numero: '999', distribuidora: 'EDP_ES' },
    ]);
    findManyFaturas.mockResolvedValue([
      { ucId: 'uc-empresa-1', dadosExtraidos: { consumoAtualKwh: 700 }, mediaKwhCalculada: '700' },
    ]);
    findManyTarifas.mockResolvedValue([tarifaEdpEs]);

    const r = await service.gerarCobrancaConsolidada({
      convenioId: 'conv-1',
      mesReferencia: 5,
      anoReferencia: 2026,
      cooperativaId: 'coop-A',
    });

    expect(r.status).toBe('CRIADA');
    // 700 × 0.78931 = 552.52
    const bodyArg = createCobranca.mock.calls[0][0].data;
    expect(Number(bodyArg.valorBruto)).toBeCloseTo(552.52, 2);
  });
});
