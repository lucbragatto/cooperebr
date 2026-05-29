import { RepasseMensalCron } from './repasse-mensal.cron';

/**
 * BH.5 (M41, 2026-05-30) — Cobertura do cron mensal de aluguel automático.
 *
 * Cenários:
 *   1. Cria 1 despesa ARRENDAMENTO_USINA por usina elegível.
 *   2. Idempotência: 2ª execução no mesmo período NÃO duplica.
 *   3. Pula usina com repasse bruto null (formaPagamentoDono não definido).
 *   4. Erro em 1 usina NÃO interrompe processamento das demais.
 *   5. Pula usina com valor 0.
 */
describe('RepasseMensalCron', () => {
  const usinaFindMany = jest.fn();
  const contaAPagarFindFirst = jest.fn();
  const contaAPagarCreate = jest.fn();
  const tarifaConcessionariaFindMany = jest.fn();
  const geracaoMensalFindFirst = jest.fn();

  const prismaMock = {
    usina: { findMany: usinaFindMany },
    contaAPagar: {
      findFirst: contaAPagarFindFirst,
      findMany: jest.fn().mockResolvedValue([]), // pra calcularRepasseLiquido interno
      create: contaAPagarCreate,
    },
    tarifaConcessionaria: { findMany: tarifaConcessionariaFindMany },
    geracaoMensal: { findFirst: geracaoMensalFindFirst },
  } as any;

  let cron: RepasseMensalCron;

  beforeEach(() => {
    jest.clearAllMocks();
    tarifaConcessionariaFindMany.mockResolvedValue([]);
    geracaoMensalFindFirst.mockResolvedValue(null); // Não importa pra FIXO
    cron = new RepasseMensalCron(prismaMock);
  });

  it('Cria 1 despesa ARRENDAMENTO_USINA por usina FIXO elegível', async () => {
    usinaFindMany.mockResolvedValueOnce([
      {
        id: 'u1',
        nome: 'Solar A',
        cooperativaId: 'coop-A',
        formaPagamentoDono: 'FIXO',
        valorAluguelFixo: 1500,
        percentualGeracaoDono: null,
        valorKwhPadrao: null,
        distribuidora: null,
      },
      {
        id: 'u2',
        nome: 'Solar B',
        cooperativaId: 'coop-A',
        formaPagamentoDono: 'FIXO',
        valorAluguelFixo: 2000,
        percentualGeracaoDono: null,
        valorKwhPadrao: null,
        distribuidora: null,
      },
    ]);
    contaAPagarFindFirst.mockResolvedValue(null); // nenhuma já existe
    contaAPagarCreate.mockResolvedValue({ id: 'd-novo' });

    const r = await cron.criarDespesasAluguelMensal();

    expect(r.criadas).toBe(2);
    expect(r.puladas).toBe(0);
    expect(r.erros).toBe(0);
    expect(contaAPagarCreate).toHaveBeenCalledTimes(2);
    const args1 = contaAPagarCreate.mock.calls[0][0].data;
    expect(args1.categoria).toBe('ARRENDAMENTO_USINA');
    expect(args1.statusAprovacao).toBe('APROVADA');
    expect(args1.statusResolucao).toBe('RESOLVIDA');
    expect(args1.tratamento).toBe('ASSUMIDO');
    expect(args1.quemPagouTipo).toBe('PARCEIRO');
    expect(args1.responsavelPagamento).toBe('PARCEIRO');
    expect(args1.valor).toBe(1500);
  });

  it('Idempotência: pula se já existir despesa ARRENDAMENTO_USINA no período', async () => {
    usinaFindMany.mockResolvedValueOnce([
      {
        id: 'u1',
        nome: 'Solar A',
        cooperativaId: 'coop-A',
        formaPagamentoDono: 'FIXO',
        valorAluguelFixo: 1500,
        percentualGeracaoDono: null,
        valorKwhPadrao: null,
        distribuidora: null,
      },
    ]);
    contaAPagarFindFirst.mockResolvedValueOnce({ id: 'ja-existe' });

    const r = await cron.criarDespesasAluguelMensal();

    expect(r.criadas).toBe(0);
    expect(r.puladas).toBe(1);
    expect(contaAPagarCreate).not.toHaveBeenCalled();
  });

  it('Pula usina com valor bruto 0 (sem geração + PERCENTUAL)', async () => {
    usinaFindMany.mockResolvedValueOnce([
      {
        id: 'u1',
        nome: 'Solar A',
        cooperativaId: 'coop-A',
        formaPagamentoDono: 'PERCENTUAL',
        valorAluguelFixo: null,
        percentualGeracaoDono: 30,
        valorKwhPadrao: 0.5,
        distribuidora: null,
      },
    ]);
    contaAPagarFindFirst.mockResolvedValue(null);
    geracaoMensalFindFirst.mockResolvedValue(null); // sem geração → bruto null pra PERCENTUAL

    const r = await cron.criarDespesasAluguelMensal();

    expect(r.criadas).toBe(0);
    expect(r.puladas).toBe(1);
    expect(contaAPagarCreate).not.toHaveBeenCalled();
  });

  it('Erro em 1 usina NÃO interrompe processamento das demais', async () => {
    usinaFindMany.mockResolvedValueOnce([
      {
        id: 'u-erro',
        nome: 'Solar Erro',
        cooperativaId: 'coop-A',
        formaPagamentoDono: 'FIXO',
        valorAluguelFixo: 100,
        percentualGeracaoDono: null,
        valorKwhPadrao: null,
        distribuidora: null,
      },
      {
        id: 'u-ok',
        nome: 'Solar OK',
        cooperativaId: 'coop-A',
        formaPagamentoDono: 'FIXO',
        valorAluguelFixo: 200,
        percentualGeracaoDono: null,
        valorKwhPadrao: null,
        distribuidora: null,
      },
    ]);
    contaAPagarFindFirst.mockResolvedValue(null);
    // 1ª criação falha, 2ª sucesso
    contaAPagarCreate
      .mockRejectedValueOnce(new Error('Constraint violation'))
      .mockResolvedValueOnce({ id: 'd-ok' });

    const r = await cron.criarDespesasAluguelMensal();

    expect(r.criadas).toBe(1);
    expect(r.erros).toBe(1);
    expect(contaAPagarCreate).toHaveBeenCalledTimes(2);
  });

  it('Filtro Prisma: só usinas com cooperativaId E formaPagamentoDono setado', async () => {
    usinaFindMany.mockResolvedValueOnce([]);
    await cron.criarDespesasAluguelMensal();
    const where = usinaFindMany.mock.calls[0][0].where;
    expect(where.cooperativaId).toEqual({ not: null });
    expect(where.formaPagamentoDono).toEqual({ in: ['FIXO', 'PERCENTUAL', 'HIBRIDO'] });
  });
});
