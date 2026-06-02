import { CobrancasService } from './cobrancas.service';

/**
 * D-FISCAL-2.4.4c — Specs do roteamento do hook fiscal em darBaixa.
 *
 * Cobre:
 *  1. CONSOLIDADA (convenioContabilCobrancaId set) paga →
 *     criarLancamentoConvenioContrato (natureza do convênio) é chamado;
 *     criarLancamentoAutomatico(COBRANCA) NÃO é chamado.
 *  2. COBRANÇA NORMAL paga → CT.3 default (COBRANCA→PRÓPRIO) é chamado
 *     como antes (REGRESSÃO).
 *  3. Erro no hook fiscal NÃO reverte o pagamento (best-effort).
 *  4. Sem cooperativaId resolvível → hook fiscal não dispara (igual antes).
 */
describe('CobrancasService.darBaixa — D-FISCAL-2.4.4c (roteamento fiscal)', () => {
  // Prisma mocks
  const findFirstCobranca = jest.fn();
  const findUniqueCobranca = jest.fn();
  const updateManyCobranca = jest.fn();
  const updateCobranca = jest.fn();
  const findFirstLancCaixa = jest.fn();
  const updateLancCaixa = jest.fn();
  const createLancCaixa = jest.fn();

  const prismaMock = {
    cobranca: {
      findFirst: findFirstCobranca,
      findUnique: findUniqueCobranca,
      updateMany: updateManyCobranca,
      update: updateCobranca,
    },
    lancamentoCaixa: {
      findFirst: findFirstLancCaixa,
      update: updateLancCaixa,
      create: createLancCaixa,
    },
  } as any;

  // Service deps mocks
  const eventEmitterMock = { emit: jest.fn() } as any;
  const gatewayMock = {} as any;
  const clubeMock = {} as any;
  const waCicloMock = {
    notificarPagamentoConfirmado: jest.fn().mockResolvedValue(undefined),
  } as any;
  const waSenderMock = { enviarTexto: jest.fn().mockResolvedValue(undefined) } as any;
  const emailMock = { enviarEmail: jest.fn().mockResolvedValue(undefined) } as any;
  const cooperTokenMock = {} as any;
  const tokenContabilMock = {} as any;
  const multaJurosMock = { calcular: jest.fn() } as any;

  // ⭐ Hook contábil — o foco do spec
  const criarLancamentoAutomatico = jest.fn().mockResolvedValue({ id: 'lanc-CT3' });
  const criarLancamentoConvenioContrato = jest
    .fn()
    .mockResolvedValue({ id: 'lanc-CONVENIO' });
  const contabilidadeMock = {
    criarLancamentoAutomatico,
    criarLancamentoConvenioContrato,
  } as any;

  let service: CobrancasService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new CobrancasService(
      prismaMock,
      eventEmitterMock,
      gatewayMock,
      clubeMock,
      waCicloMock,
      waSenderMock,
      emailMock,
      cooperTokenMock,
      tokenContabilMock,
      multaJurosMock,
      contabilidadeMock,
    );
    // Defaults pra fluxo de baixa funcionar
    updateManyCobranca.mockResolvedValue({ count: 1 });
    findFirstLancCaixa.mockResolvedValue(null); // sem PREVISTO -> cria REALIZADO
    createLancCaixa.mockResolvedValue({ id: 'lanc-caixa-1' });
  });

  it('CONSOLIDADA (convenioContabilCobrancaId set) → criarLancamentoConvenioContrato + NÃO chama criarLancamentoAutomatico', async () => {
    const cobrancaConsolidada = {
      id: 'cob-consolidada-1',
      status: 'PENDENTE',
      cooperativaId: 'coop-A',
      mesReferencia: 5,
      anoReferencia: 2026,
      valorLiquido: '947.17',
      dataVencimento: new Date('2026-06-30'),
      convenioContabilCobrancaId: 'conv-1', // ⭐ chave do roteamento
      contrato: {
        cooperativaId: 'coop-A',
        cooperadoId: 'pagador-1',
        cooperado: { id: 'pagador-1', nomeCompleto: 'Clínica X', tipoCooperado: 'COM_UC' },
      },
    };
    findFirstCobranca.mockResolvedValueOnce(cobrancaConsolidada);
    findUniqueCobranca.mockResolvedValueOnce({ ...cobrancaConsolidada, status: 'PAGO' });

    await service.darBaixa('cob-consolidada-1', '2026-06-15', 947.17, 'PIX', 'coop-A');

    // Aguardar microtasks dos hooks fire-and-forget (Promise.catch)
    await Promise.resolve();
    await Promise.resolve();

    // Hook do CONVÊNIO foi chamado com args corretos
    expect(criarLancamentoConvenioContrato).toHaveBeenCalledTimes(1);
    const arg = criarLancamentoConvenioContrato.mock.calls[0][0];
    expect(arg.contratoConvenioId).toBe('conv-1');
    expect(arg.cooperativaId).toBe('coop-A');
    expect(Number(arg.valor)).toBeCloseTo(947.17, 2);
    expect(arg.competencia).toBe('2026-05');
    expect(arg.descricao).toContain('Consolidada custeio paga');
    expect(arg.dataMovimento).toBeInstanceOf(Date);

    // Hook PADRÃO CT.3 NÃO foi chamado (substituição, não complemento)
    expect(criarLancamentoAutomatico).not.toHaveBeenCalled();
  });

  it('COBRANÇA NORMAL (convenioContabilCobrancaId null) → CT.3 padrão COBRANCA→PRÓPRIO (REGRESSÃO)', async () => {
    const cobrancaNormal = {
      id: 'cob-normal-1',
      status: 'PENDENTE',
      cooperativaId: 'coop-A',
      mesReferencia: 5,
      anoReferencia: 2026,
      valorLiquido: '200.00',
      dataVencimento: new Date('2026-06-30'),
      convenioContabilCobrancaId: null, // ⭐ caminho legado
      contrato: {
        cooperativaId: 'coop-A',
        cooperadoId: 'coop-mem-1',
        cooperado: { id: 'coop-mem-1', nomeCompleto: 'Dr. A', tipoCooperado: 'COM_UC' },
      },
    };
    findFirstCobranca.mockResolvedValueOnce(cobrancaNormal);
    findUniqueCobranca.mockResolvedValueOnce({ ...cobrancaNormal, status: 'PAGO' });

    await service.darBaixa('cob-normal-1', '2026-06-15', 200, 'BOLETO', 'coop-A');

    await Promise.resolve();
    await Promise.resolve();

    // Hook PADRÃO CT.3 chamado (caminho legado preservado)
    expect(criarLancamentoAutomatico).toHaveBeenCalledTimes(1);
    const arg = criarLancamentoAutomatico.mock.calls[0][0];
    expect(arg.origemTipo).toBe('COBRANCA');
    expect(arg.origemId).toBe('cob-normal-1');
    expect(arg.fonte).toEqual({ tipo: 'COBRANCA', cooperadoTipoCooperado: 'COM_UC' });
    expect(arg.cooperativaId).toBe('coop-A');
    expect(arg.cooperadoId).toBe('coop-mem-1');
    expect(Number(arg.valor)).toBe(200);

    // Hook do CONVÊNIO NÃO foi chamado
    expect(criarLancamentoConvenioContrato).not.toHaveBeenCalled();
  });

  it('erro no hook fiscal (convênio) NÃO reverte o pagamento', async () => {
    const cobrancaConsolidada = {
      id: 'cob-consolidada-erro',
      status: 'PENDENTE',
      cooperativaId: 'coop-A',
      mesReferencia: 5,
      anoReferencia: 2026,
      valorLiquido: '100.00',
      dataVencimento: new Date('2026-06-30'),
      convenioContabilCobrancaId: 'conv-1',
      contrato: {
        cooperativaId: 'coop-A',
        cooperadoId: 'pagador-1',
        cooperado: { id: 'pagador-1', nomeCompleto: 'Clínica X', tipoCooperado: 'COM_UC' },
      },
    };
    findFirstCobranca.mockResolvedValueOnce(cobrancaConsolidada);
    findUniqueCobranca.mockResolvedValueOnce({ ...cobrancaConsolidada, status: 'PAGO' });
    criarLancamentoConvenioContrato.mockRejectedValueOnce(
      new Error('Convênio sem natureza definida'),
    );

    // NÃO deve lançar (best-effort) — pagamento foi efetuado
    await expect(
      service.darBaixa('cob-consolidada-erro', '2026-06-15', 100, 'PIX', 'coop-A'),
    ).resolves.toBeDefined();

    await Promise.resolve();
    await Promise.resolve();

    // updateMany do status PAGO foi chamado (pagamento efetivado)
    expect(updateManyCobranca).toHaveBeenCalledTimes(1);
    const updateArg = updateManyCobranca.mock.calls[0][0];
    expect(updateArg.data.status).toBe('PAGO');

    // Hook do convênio tentou (e falhou silenciosamente)
    expect(criarLancamentoConvenioContrato).toHaveBeenCalledTimes(1);
  });

  it('sem cooperativaId resolvível → nenhum hook fiscal dispara', async () => {
    const cobrancaSemCoop = {
      id: 'cob-sem-coop',
      status: 'PENDENTE',
      cooperativaId: null,
      mesReferencia: 5,
      anoReferencia: 2026,
      valorLiquido: '100.00',
      dataVencimento: new Date('2026-06-30'),
      convenioContabilCobrancaId: 'conv-1',
      contrato: {
        cooperativaId: null,
        cooperadoId: 'coop-mem-1',
        cooperado: { id: 'coop-mem-1', nomeCompleto: 'Dr. A', tipoCooperado: 'COM_UC' },
      },
    };
    findFirstCobranca.mockResolvedValueOnce(cobrancaSemCoop);
    findUniqueCobranca.mockResolvedValueOnce({ ...cobrancaSemCoop, status: 'PAGO' });

    await service.darBaixa('cob-sem-coop', '2026-06-15', 100, 'PIX');

    await Promise.resolve();
    await Promise.resolve();

    expect(criarLancamentoConvenioContrato).not.toHaveBeenCalled();
    expect(criarLancamentoAutomatico).not.toHaveBeenCalled();
  });
});
