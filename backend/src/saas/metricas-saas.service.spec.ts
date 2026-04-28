import { MetricasSaasService } from './metricas-saas.service';

describe('MetricasSaasService.getResumoGeral', () => {
  const cooperativaCount = jest.fn();
  const cooperativaGroupBy = jest.fn();
  const cooperativaFindMany = jest.fn();
  const cooperadoCount = jest.fn();
  const cobrancaAggregate = jest.fn();
  const cobrancaCount = jest.fn();
  const faturaSaasCount = jest.fn();
  const faturaSaasAggregate = jest.fn();

  const prismaMock = {
    cooperativa: {
      count: cooperativaCount,
      groupBy: cooperativaGroupBy,
      findMany: cooperativaFindMany,
    },
    cooperado: { count: cooperadoCount },
    cobranca: { aggregate: cobrancaAggregate, count: cobrancaCount },
    faturaSaas: { count: faturaSaasCount, aggregate: faturaSaasAggregate },
  } as any;

  let service: MetricasSaasService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new MetricasSaasService(prismaMock);
  });

  it('cenário sem parceiros: retorna zeros sem erro', async () => {
    cooperativaCount.mockResolvedValue(0);
    cooperativaGroupBy.mockResolvedValue([]);
    cooperadoCount.mockResolvedValue(0);
    cobrancaAggregate.mockResolvedValue({ _sum: { valorPago: null }, _count: { _all: 0 } });
    cooperativaFindMany.mockResolvedValueOnce([]); // MRR
    cooperativaFindMany.mockResolvedValueOnce([]); // incêndios
    faturaSaasCount.mockResolvedValue(0);
    faturaSaasAggregate.mockResolvedValue({ _sum: { valorTotal: null } });

    const r = await service.getResumoGeral();

    expect(r.totalParceiros).toBe(0);
    expect(r.parceirosPorTipo).toEqual([]);
    expect(r.totalMembrosAtivos).toBe(0);
    expect(r.faturamentoMesAtual.totalReais).toBe(0);
    expect(r.mrr.total).toBe(0);
    expect(r.inadimplenciaSaaS.qtdFaturasVencidas).toBe(0);
    expect(r.parceirosComIncendio).toEqual([]);
    expect(r.geradoEm).toBeInstanceOf(Date);
  });

  it('1 parceiro CoopereBR ATIVO + plano: MRR = mensalidadeBase + % receita', async () => {
    cooperativaCount.mockResolvedValue(1);
    cooperativaGroupBy.mockResolvedValue([
      { tipoParceiro: 'COOPERATIVA', _count: { _all: 1 } },
    ]);
    cooperadoCount.mockResolvedValue(299);
    cobrancaAggregate
      .mockResolvedValueOnce({ _sum: { valorPago: 1300 }, _count: { _all: 7 } }) // faturamento mês
      .mockResolvedValueOnce({ _sum: { valorPago: 5000 } }); // MRR variável janela 30d
    cooperativaFindMany
      .mockResolvedValueOnce([
        {
          id: 'coop-1',
          planoSaas: { mensalidadeBase: 9999, percentualReceita: 20 },
        },
      ])
      .mockResolvedValueOnce([]); // sem incêndios
    faturaSaasCount.mockResolvedValue(0);
    faturaSaasAggregate.mockResolvedValue({ _sum: { valorTotal: null } });

    const r = await service.getResumoGeral();

    expect(r.totalParceiros).toBe(1);
    expect(r.totalMembrosAtivos).toBe(299);
    expect(r.faturamentoMesAtual.totalReais).toBe(1300);
    expect(r.mrr.fixo).toBe(9999);
    expect(r.mrr.variavelEstimado).toBe(1000); // 20% de 5000
    expect(r.mrr.total).toBe(10999);
    expect(r.mrr.parceirosContando).toBe(1);
  });

  it('parceiro TRIAL: NÃO entra no MRR', async () => {
    cooperativaCount.mockResolvedValue(2);
    cooperativaGroupBy.mockResolvedValue([
      { tipoParceiro: 'COOPERATIVA', _count: { _all: 2 } },
    ]);
    cooperadoCount.mockResolvedValue(303);
    cobrancaAggregate.mockResolvedValueOnce({ _sum: { valorPago: 1300 }, _count: { _all: 7 } });
    // findMany pra MRR retorna SÓ os ATIVO (mock simula filtro)
    cooperativaFindMany
      .mockResolvedValueOnce([
        { id: 'coop-1', planoSaas: { mensalidadeBase: 9999, percentualReceita: 20 } },
      ])
      .mockResolvedValueOnce([]);
    cobrancaAggregate.mockResolvedValueOnce({ _sum: { valorPago: 0 } });
    faturaSaasCount.mockResolvedValue(1);
    faturaSaasAggregate.mockResolvedValue({ _sum: { valorTotal: 5900 } });

    const r = await service.getResumoGeral();

    expect(r.mrr.parceirosContando).toBe(1); // Só CoopereBR ATIVO, não conta CoopereBR Teste TRIAL
    expect(r.inadimplenciaSaaS.qtdFaturasVencidas).toBe(1);
    expect(r.inadimplenciaSaaS.valorVencido).toBe(5900);
  });

  it('detecta incêndio quando taxa de vencimento > 20% e total >= 5', async () => {
    cooperativaCount.mockResolvedValue(1);
    cooperativaGroupBy.mockResolvedValue([{ tipoParceiro: 'COOPERATIVA', _count: { _all: 1 } }]);
    cooperadoCount.mockResolvedValue(10);
    cobrancaAggregate
      .mockResolvedValueOnce({ _sum: { valorPago: 0 }, _count: { _all: 0 } });
    cooperativaFindMany
      .mockResolvedValueOnce([]) // MRR
      .mockResolvedValueOnce([{ id: 'coop-fogo', nome: 'Parceiro Fogo' }]);
    cobrancaCount.mockResolvedValueOnce(10).mockResolvedValueOnce(3); // 30% vencidas
    faturaSaasCount.mockResolvedValue(0);
    faturaSaasAggregate.mockResolvedValue({ _sum: { valorTotal: null } });

    const r = await service.getResumoGeral();

    expect(r.parceirosComIncendio).toHaveLength(1);
    expect(r.parceirosComIncendio[0].nome).toBe('Parceiro Fogo');
    expect(r.parceirosComIncendio[0].taxaVencimentoPerc).toBe(30);
  });
});
