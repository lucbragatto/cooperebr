import { SaasService } from './saas.service';

/**
 * Sprint 6 Ticket 10 — FaturaSaas automática.
 *
 * Testa gerarFaturasMensal(): cron que gera fatura SaaS mensal
 * pra cada parceiro com plano ativo.
 */
describe('SaasService.gerarFaturasMensal', () => {
  const planoSaasFindMany = jest.fn();
  const cooperativaFindMany = jest.fn();
  const cooperativaFindUnique = jest.fn();
  const faturaSaasFindUnique = jest.fn();
  const faturaSaasCreate = jest.fn();
  const cobrancaAggregate = jest.fn();

  const prismaMock = {
    cooperativa: { findMany: cooperativaFindMany, findUnique: cooperativaFindUnique },
    faturaSaas: {
      findUnique: faturaSaasFindUnique,
      create: faturaSaasCreate,
    },
    cobranca: { aggregate: cobrancaAggregate },
  } as any;

  let service: SaasService;

  const coopComPlano = {
    id: 'coop-1',
    nome: 'CoopereBR',
    diaVencimentoSaas: 10,
    planoSaas: {
      mensalidadeBase: 5900,
      percentualReceita: 25,
    },
  };

  beforeEach(() => {
    jest.clearAllMocks();
    cooperativaFindUnique.mockResolvedValue(coopComPlano);
    service = new SaasService(prismaMock);
    (service as any).logger = { log: jest.fn(), error: jest.fn() };
  });

  it('gera FaturaSaas pra parceiro com plano ativo', async () => {
    cooperativaFindMany.mockResolvedValue([coopComPlano]);
    faturaSaasFindUnique.mockResolvedValue(null); // não existe ainda
    cobrancaAggregate.mockResolvedValue({ _sum: { valorLiquido: 10000 } });
    faturaSaasCreate.mockResolvedValue({ id: 'fatura-1' });

    const r = await service.gerarFaturasMensal();

    expect(r.total).toBe(1);
    expect(r.faturas[0].status).toBe('CRIADA');
    // valorBase 5900 + valorReceita (25% de 10000 = 2500) = 8400
    expect(r.faturas[0].valor).toBe(8400);

    expect(faturaSaasCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          cooperativaId: 'coop-1',
          valorBase: 5900,
          valorReceita: 2500,
          valorTotal: 8400,
        }),
      }),
    );
  });

  it('anti-dup: não gera se já existe fatura na competência', async () => {
    cooperativaFindMany.mockResolvedValue([coopComPlano]);
    faturaSaasFindUnique.mockResolvedValue({ id: 'fatura-existente', valorTotal: 5900 });

    const r = await service.gerarFaturasMensal();

    expect(r.faturas[0].status).toBe('JA_EXISTE');
    expect(faturaSaasCreate).not.toHaveBeenCalled();
  });

  it('sem cobranças pagas = valorReceita zero', async () => {
    cooperativaFindMany.mockResolvedValue([coopComPlano]);
    faturaSaasFindUnique.mockResolvedValue(null);
    cobrancaAggregate.mockResolvedValue({ _sum: { valorLiquido: null } });
    faturaSaasCreate.mockResolvedValue({ id: 'fatura-2' });

    const r = await service.gerarFaturasMensal();

    expect(r.faturas[0].valor).toBe(5900); // só mensalidade base
    expect(faturaSaasCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          valorReceita: 0,
          valorTotal: 5900,
        }),
      }),
    );
  });

  it('parceiro sem plano = não processa', async () => {
    cooperativaFindMany.mockResolvedValue([]); // nenhum com plano

    const r = await service.gerarFaturasMensal();

    expect(r.total).toBe(0);
    expect(faturaSaasCreate).not.toHaveBeenCalled();
  });

  // Sprint 13a P0: método público parametrizado por cooperativaId
  it('gerarFaturaParaCooperativa: cria fatura quando cooperativa tem plano', async () => {
    faturaSaasFindUnique.mockResolvedValue(null);
    cobrancaAggregate.mockResolvedValue({ _sum: { valorLiquido: 1000 } });
    faturaSaasCreate.mockResolvedValue({ id: 'fatura-x' });

    const r = await service.gerarFaturaParaCooperativa('coop-1');

    expect(r.status).toBe('CRIADA');
    expect(r.valor).toBe(6150); // 5900 base + 25% de 1000 = 250
    expect(r.faturaId).toBe('fatura-x');
  });

  it('gerarFaturaParaCooperativa: throw quando cooperativa sem plano', async () => {
    cooperativaFindUnique.mockResolvedValue({ id: 'coop-2', nome: 'Sem Plano', planoSaas: null, diaVencimentoSaas: 10 });
    await expect(service.gerarFaturaParaCooperativa('coop-2')).rejects.toThrow(/sem plano SaaS/);
  });
});
