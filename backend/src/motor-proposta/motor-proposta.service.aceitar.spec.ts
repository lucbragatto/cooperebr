import { MotorPropostaService } from './motor-proposta.service';
import { BadRequestException } from '@nestjs/common';

/**
 * Sprint 5 T3 — aceitar() persiste snapshots conforme modelo.
 *
 * Cobre 5 cenários:
 * 1. FIXO + plano Tipo I + KWH_CHEIO → snapshots corretos
 * 2. FIXO + plano Tipo II + SEM_TRIBUTO → snapshots refletem plano
 * 3. Sem planoId → fallback + notificação de alerta (Decisão 2 Opção D)
 * 4. Plano COMPENSADOS com BLOQUEIO ligado → BadRequestException
 * 5. kwhContratoMensal persistido igual a r.kwhContrato
 *
 * Referência: docs/referencia/REGRAS-PLANOS-E-COBRANCA.md seção 2.3.
 */
describe('MotorPropostaService.aceitar — snapshots T3', () => {
  // Mocks Prisma: cooperado, plano, contrato, UC, usina, lista de espera, proposta, histórico
  const cooperadoFindUnique = jest.fn();
  const planoFindFirst = jest.fn();
  const planoFindUnique = jest.fn();
  const contratoCreate = jest.fn();
  const propostaCreate = jest.fn();
  const propostaFindMany = jest.fn();
  const propostaUpdate = jest.fn();
  const ucFindMany = jest.fn();
  const usinaFindMany = jest.fn();
  const listaEsperaCount = jest.fn();
  const listaEsperaCreate = jest.fn();
  const historicoCreate = jest.fn();
  const transactionMock = jest.fn();

  const prismaMock = {
    cooperado: { findUnique: cooperadoFindUnique },
    plano: { findFirst: planoFindFirst, findUnique: planoFindUnique },
    historicoStatusCooperado: { create: historicoCreate },
    $transaction: transactionMock,
  } as any;

  // Service mocks
  const notificacoesCriar = jest.fn().mockResolvedValue(undefined);
  const contratosGerarNumero = jest.fn().mockResolvedValue('C-0001');
  const cooperadosMarcarPendente = jest.fn().mockResolvedValue(undefined);
  const cooperadosCheckPronto = jest.fn().mockResolvedValue(undefined);

  const notificacoesMock = { criar: notificacoesCriar } as any;
  const contratosMock = { gerarNumeroContrato: contratosGerarNumero } as any;
  const cooperadosMock = {
    marcarPendenteDocumentos: cooperadosMarcarPendente,
    checkProntoParaAtivar: cooperadosCheckPronto,
  } as any;
  const empty = {} as any;

  let service: MotorPropostaService;

  // Resultado típico de calcular() legado (Tipo II + SEM_TRIBUTO implícito)
  const resultadoCalculo = {
    base: 'MES_RECENTE' as const,
    label: 'Baseado no mês atual',
    kwhApuradoBase: 1.0928,
    tarifaUnitSemTrib: 0.78931,
    tusdUtilizada: 0.46863,
    teUtilizada: 0.32068,
    descontoPercentual: 20,
    descontoAbsoluto: 0.15786,
    kwhContrato: 1131,
    valorCooperado: 0.93494, // = 1.0928 - 0.15786
    economiaAbsoluta: 0.15786,
    economiaPercentual: 14.44,
    economiaMensal: 178.54,
    economiaAnual: 2142.46,
    mesesEquivalentes: 1.73,
    kwhMesRecente: 1131,
    valorMesRecente: 1235.93,
    kwhMedio12m: 1131,
    valorMedio12m: 1235.93,
    mediaCooperativaKwh: 0.9,
    resultadoVsMedia: 3.88,
    mesReferencia: '2026-03',
  };

  beforeEach(() => {
    jest.clearAllMocks();
    delete process.env.BLOQUEIO_MODELOS_NAO_FIXO;

    cooperadoFindUnique.mockImplementation(async ({ select }: any) => {
      if (select?.status) return { status: 'APROVADO', cooperativaId: 'coop-1' };
      return { cooperativaId: 'coop-1' };
    });

    // Transação: executa o callback imediatamente passando tx mockado
    transactionMock.mockImplementation(async (cb: any) => {
      const tx = {
        propostaCooperado: {
          findMany: propostaFindMany.mockResolvedValue([]),
          update: propostaUpdate,
          create: propostaCreate.mockResolvedValue({
            id: 'prop-1',
            cooperado: { nomeCompleto: 'João da Silva' },
          }),
        },
        uc: { findMany: ucFindMany.mockResolvedValue([
          { id: 'uc-1', distribuidora: 'EDP', contratos: [] },
        ]) },
        usina: { findMany: usinaFindMany.mockResolvedValue([
          { id: 'usina-1', capacidadeKwh: 10000, contratos: [] },
        ]) },
        contrato: { create: contratoCreate.mockResolvedValue({
          id: 'contrato-1', numero: 'C-0001',
        }) },
        listaEspera: {
          count: listaEsperaCount.mockResolvedValue(0),
          create: listaEsperaCreate,
        },
      };
      return cb(tx);
    });

    service = new MotorPropostaService(
      prismaMock,
      notificacoesMock,
      cooperadosMock,
      contratosMock,
      empty, empty, empty, empty, empty, empty,
    );
  });

  it('FIXO + Tipo I + KWH_CHEIO → snapshots refletem plano', async () => {
    planoFindUnique.mockResolvedValue({
      modeloCobranca: 'FIXO_MENSAL',
      nome: 'Plano Fixo',
      baseCalculo: 'KWH_CHEIO',
      tipoDesconto: 'APLICAR_SOBRE_BASE',
    });

    await service.aceitar({
      cooperadoId: 'coop-id-1',
      resultado: resultadoCalculo,
      mesReferencia: '2026-03',
      planoId: 'plano-fixo',
    });

    expect(contratoCreate).toHaveBeenCalledTimes(1);
    const dataContrato = contratoCreate.mock.calls[0][0].data;

    expect(dataContrato.baseCalculoAplicado).toBe('KWH_CHEIO');
    expect(dataContrato.tipoDescontoAplicado).toBe('APLICAR_SOBRE_BASE');
    expect(dataContrato.valorContrato).toBeCloseTo(0.93494 * 1131, 1);
    expect(dataContrato.kwhContratoMensal).toBe(1131);
  });

  it('FIXO + Tipo II + SEM_TRIBUTO → snapshots refletem plano', async () => {
    planoFindUnique.mockResolvedValue({
      modeloCobranca: 'FIXO_MENSAL',
      nome: 'Plano Padrão Mercado',
      baseCalculo: 'SEM_TRIBUTO',
      tipoDesconto: 'ABATER_DA_CHEIA',
    });

    await service.aceitar({
      cooperadoId: 'coop-id-1',
      resultado: resultadoCalculo,
      mesReferencia: '2026-03',
      planoId: 'plano-sem-trib',
    });

    const dataContrato = contratoCreate.mock.calls[0][0].data;

    expect(dataContrato.baseCalculoAplicado).toBe('SEM_TRIBUTO');
    expect(dataContrato.tipoDescontoAplicado).toBe('ABATER_DA_CHEIA');
    expect(dataContrato.valorContrato).not.toBeUndefined();
  });

  it('sem planoId no DTO → fallback + notificação de alerta', async () => {
    planoFindFirst.mockResolvedValue({ id: 'plano-default' });
    planoFindUnique.mockResolvedValue({
      modeloCobranca: 'FIXO_MENSAL',
      nome: 'Plano Default',
      baseCalculo: 'KWH_CHEIO',
      tipoDesconto: 'APLICAR_SOBRE_BASE',
    });

    await service.aceitar({
      cooperadoId: 'coop-id-1',
      resultado: resultadoCalculo,
      mesReferencia: '2026-03',
      // planoId ausente — simula caller /dashboard/cooperados/[id]
    });

    // Fallback foi usado
    expect(planoFindFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          ativo: true,
          cooperativaId: 'coop-1',
        }),
      }),
    );

    // Notificação de alerta criada
    const chamadasNotificacao = notificacoesCriar.mock.calls.map((c: any) => c[0]);
    const alertaFallback = chamadasNotificacao.find(
      (n: any) => n.tipo === 'PLANO_FALLBACK_APLICADO',
    );
    expect(alertaFallback).toBeDefined();
    expect(alertaFallback.titulo).toContain('plano padrão');

    // Contrato foi criado mesmo assim (não bloqueia fluxo)
    const dataContrato = contratoCreate.mock.calls[0][0].data;
    expect(dataContrato.planoId).toBe('plano-default');
  });

  it('plano COMPENSADOS + BLOQUEIO_MODELOS_NAO_FIXO ligado → BadRequestException', async () => {
    process.env.BLOQUEIO_MODELOS_NAO_FIXO = 'true';
    planoFindUnique.mockResolvedValue({
      modeloCobranca: 'CREDITOS_COMPENSADOS',
      nome: 'Plano Compensados',
      baseCalculo: 'SEM_TRIBUTO',
      tipoDesconto: 'ABATER_DA_CHEIA',
    });

    await expect(
      service.aceitar({
        cooperadoId: 'coop-id-1',
        resultado: resultadoCalculo,
        mesReferencia: '2026-03',
        planoId: 'plano-comp',
      }),
    ).rejects.toThrow(BadRequestException);

    // Contrato NÃO deve ter sido criado
    expect(contratoCreate).not.toHaveBeenCalled();
  });

  it('kwhContratoMensal persistido igual a r.kwhContrato (sanidade)', async () => {
    planoFindUnique.mockResolvedValue({
      modeloCobranca: 'FIXO_MENSAL',
      nome: 'Plano',
      baseCalculo: 'KWH_CHEIO',
      tipoDesconto: 'APLICAR_SOBRE_BASE',
    });

    await service.aceitar({
      cooperadoId: 'coop-id-1',
      resultado: { ...resultadoCalculo, kwhContrato: 850 },
      mesReferencia: '2026-03',
      planoId: 'plano-1',
    });

    const dataContrato = contratoCreate.mock.calls[0][0].data;
    expect(dataContrato.kwhContratoMensal).toBe(850);
    expect(dataContrato.kwhContrato).toBe(850); // campo antigo permanece
  });

  it('T4: plano com promoção → grava snapshots promocionais', async () => {
    planoFindUnique.mockResolvedValue({
      modeloCobranca: 'FIXO_MENSAL',
      nome: 'Plano com Promoção',
      baseCalculo: 'KWH_CHEIO',
      tipoDesconto: 'APLICAR_SOBRE_BASE',
      descontoBase: 20,
      temPromocao: true,
      descontoPromocional: 30, // 30% nos primeiros meses
      mesesPromocao: 3,
    });

    await service.aceitar({
      cooperadoId: 'coop-id-1',
      resultado: resultadoCalculo,
      mesReferencia: '2026-03',
      planoId: 'plano-promo',
    });

    const dataContrato = contratoCreate.mock.calls[0][0].data;

    expect(dataContrato.descontoPromocionalAplicado).toBe(30);
    expect(dataContrato.mesesPromocaoAplicados).toBe(3);
    // Promocional deve ser menor que valor normal (30% > 20% de desconto)
    expect(Number(dataContrato.valorContratoPromocional))
      .toBeLessThan(Number(dataContrato.valorContrato));
    // Tarifa promocional = kwhApuradoBase × (1 - 30/100) = 1.0928 × 0.70
    expect(Number(dataContrato.tarifaContratualPromocional))
      .toBeCloseTo(1.0928 * 0.70, 3);
  });

  it('T4: plano sem promoção → não grava snapshots promocionais', async () => {
    planoFindUnique.mockResolvedValue({
      modeloCobranca: 'FIXO_MENSAL',
      nome: 'Plano Sem Promoção',
      baseCalculo: 'KWH_CHEIO',
      tipoDesconto: 'APLICAR_SOBRE_BASE',
      descontoBase: 20,
      temPromocao: false,
      descontoPromocional: null,
      mesesPromocao: null,
    });

    await service.aceitar({
      cooperadoId: 'coop-id-1',
      resultado: resultadoCalculo,
      mesReferencia: '2026-03',
      planoId: 'plano-s-promo',
    });

    const dataContrato = contratoCreate.mock.calls[0][0].data;

    expect(dataContrato.descontoPromocionalAplicado).toBeUndefined();
    expect(dataContrato.mesesPromocaoAplicados).toBeUndefined();
    expect(dataContrato.valorContratoPromocional).toBeUndefined();
  });
});
