import { RepasseMensalCron } from './repasse-mensal.cron';

/**
 * BH.5 + AN.2 (M41-M42, 2026-05-30) — Cobertura do cron mensal.
 *
 * AN.2 mudou a lógica: agora cria RepasseProprietario PENDENTE +
 * ContaAPagar ARRENDAMENTO_USINA em TRANSAÇÃO ATÔMICA via $transaction.
 * Idempotência checa `repasseProprietario.findUnique` (unique constraint
 * `usinaId_periodoInicio_periodoFim`).
 *
 * Cenários:
 *   1. Cria par Repasse+Arrendamento atômicamente por usina FIXO elegível
 *   2. Idempotência via findUnique repasseProprietario
 *   3. Idempotência via P2002 (race / unique constraint do banco)
 *   4. Pula usina com valor bruto null/zero
 *   5. Erro em 1 usina NÃO interrompe processamento das demais
 *   6. Filtro Prisma: só usinas com cooperativaId E formaPagamentoDono setado
 *   7. Resolve proprietarioUsuarioId via Caminho A (cooperadoId)
 */
describe('RepasseMensalCron', () => {
  const usinaFindMany = jest.fn();
  const usinaFindUnique = jest.fn();
  const repasseFindUnique = jest.fn();
  const cooperadoFindUnique = jest.fn();
  const usuarioFindFirst = jest.fn();
  const usuarioFindUnique = jest.fn();
  const tarifaConcessionariaFindMany = jest.fn();
  const geracaoMensalFindFirst = jest.fn();
  const $transaction = jest.fn();

  // Inner prisma "ops" — usadas como referência (mas só importa o array passado pro $transaction)
  const repasseCreate = jest.fn().mockReturnValue({ __op: 'repasseCreate' });
  const contaAPagarCreate = jest.fn().mockReturnValue({ __op: 'contaAPagarCreate' });
  const contaAPagarFindMany = jest.fn().mockResolvedValue([]); // pra calcularRepasseLiquido interno

  const prismaMock = {
    usina: { findMany: usinaFindMany, findUnique: usinaFindUnique },
    repasseProprietario: { findUnique: repasseFindUnique, create: repasseCreate },
    contaAPagar: { findMany: contaAPagarFindMany, create: contaAPagarCreate },
    cooperado: { findUnique: cooperadoFindUnique },
    usuario: { findFirst: usuarioFindFirst, findUnique: usuarioFindUnique },
    tarifaConcessionaria: { findMany: tarifaConcessionariaFindMany },
    geracaoMensal: { findFirst: geracaoMensalFindFirst },
    $transaction,
  } as any;

  let cron: RepasseMensalCron;

  beforeEach(() => {
    jest.clearAllMocks();
    tarifaConcessionariaFindMany.mockResolvedValue([]);
    geracaoMensalFindFirst.mockResolvedValue(null);
    usinaFindUnique.mockResolvedValue({ proprietarioCooperadoId: null, proprietarioEmail: null });
    contaAPagarFindMany.mockResolvedValue([]);
    cron = new RepasseMensalCron(prismaMock);
  });

  it('Cria par Repasse+Arrendamento ATÔMICAMENTE por usina FIXO elegível', async () => {
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
    repasseFindUnique.mockResolvedValueOnce(null);
    $transaction.mockResolvedValueOnce([{ id: 'r-novo' }, { id: 'd-novo' }]);

    const r = await cron.criarDespesasAluguelMensal();

    expect(r.criadas).toBe(1);
    expect(r.puladas).toBe(0);
    expect(r.erros).toBe(0);
    expect($transaction).toHaveBeenCalledTimes(1);
    const ops = $transaction.mock.calls[0][0];
    expect(ops).toHaveLength(2);
    // Confirma que repasseProprietario.create foi chamado primeiro com FIXO=1500
    const repasseCallArgs = repasseCreate.mock.calls[0][0].data;
    expect(repasseCallArgs.cooperativaId).toBe('coop-A');
    expect(repasseCallArgs.usinaId).toBe('u1');
    expect(Number(repasseCallArgs.valorBruto)).toBe(1500);
    expect(repasseCallArgs.status).toBe('PENDENTE');
    // Confirma ARRENDAMENTO_USINA já APROVADA+RESOLVIDA
    const contaCallArgs = contaAPagarCreate.mock.calls[0][0].data;
    expect(contaCallArgs.categoria).toBe('ARRENDAMENTO_USINA');
    expect(contaCallArgs.statusAprovacao).toBe('APROVADA');
    expect(contaCallArgs.statusResolucao).toBe('RESOLVIDA');
    expect(contaCallArgs.tratamento).toBe('ASSUMIDO');
  });

  it('Idempotência via findUnique: pula se RepasseProprietario já existe no período', async () => {
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
    repasseFindUnique.mockResolvedValueOnce({ id: 'r-ja-existe' });

    const r = await cron.criarDespesasAluguelMensal();

    expect(r.criadas).toBe(0);
    expect(r.puladas).toBe(1);
    expect($transaction).not.toHaveBeenCalled();
  });

  it('Idempotência via P2002: race entre findUnique e $transaction não conta erro', async () => {
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
    repasseFindUnique.mockResolvedValueOnce(null);
    $transaction.mockRejectedValueOnce({ code: 'P2002' });

    const r = await cron.criarDespesasAluguelMensal();

    expect(r.criadas).toBe(0);
    expect(r.puladas).toBe(1);
    expect(r.erros).toBe(0);
  });

  it('Pula usina com valor bruto null (PERCENTUAL sem geração)', async () => {
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
    repasseFindUnique.mockResolvedValueOnce(null);
    geracaoMensalFindFirst.mockResolvedValue(null);

    const r = await cron.criarDespesasAluguelMensal();

    expect(r.criadas).toBe(0);
    expect(r.puladas).toBe(1);
    expect($transaction).not.toHaveBeenCalled();
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
    repasseFindUnique.mockResolvedValue(null);
    // 1ª transação falha com erro real (não P2002), 2ª passa
    $transaction
      .mockRejectedValueOnce(new Error('Constraint diferente'))
      .mockResolvedValueOnce([{ id: 'r-ok' }, { id: 'd-ok' }]);

    const r = await cron.criarDespesasAluguelMensal();

    expect(r.criadas).toBe(1);
    expect(r.erros).toBe(1);
    expect($transaction).toHaveBeenCalledTimes(2);
  });

  it('Filtro Prisma: só usinas com cooperativaId E formaPagamentoDono setado', async () => {
    usinaFindMany.mockResolvedValueOnce([]);
    await cron.criarDespesasAluguelMensal();
    const where = usinaFindMany.mock.calls[0][0].where;
    expect(where.cooperativaId).toEqual({ not: null });
    expect(where.formaPagamentoDono).toEqual({ in: ['FIXO', 'PERCENTUAL', 'HIBRIDO'] });
  });

  it('Resolve proprietarioUsuarioId via Caminho A (cooperadoId) quando disponível', async () => {
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
    repasseFindUnique.mockResolvedValueOnce(null);
    usinaFindUnique.mockResolvedValueOnce({
      proprietarioCooperadoId: 'coopdo-1',
      proprietarioEmail: null,
    });
    cooperadoFindUnique.mockResolvedValueOnce({ email: 'dono@x.com', cpf: '12345678901' });
    usuarioFindFirst.mockResolvedValueOnce({ id: 'usr-real' });
    $transaction.mockResolvedValueOnce([{ id: 'r1' }, { id: 'd1' }]);

    await cron.criarDespesasAluguelMensal();

    const repasseArgs = repasseCreate.mock.calls[0][0].data;
    expect(repasseArgs.proprietarioUsuarioId).toBe('usr-real');
  });

  it('Caminho B fallback quando cooperadoId ausente: usa proprietarioEmail', async () => {
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
    repasseFindUnique.mockResolvedValueOnce(null);
    usinaFindUnique.mockResolvedValueOnce({
      proprietarioCooperadoId: null,
      proprietarioEmail: 'dono@x.com',
    });
    usuarioFindUnique.mockResolvedValueOnce({ id: 'usr-via-email' });
    $transaction.mockResolvedValueOnce([{ id: 'r1' }, { id: 'd1' }]);

    await cron.criarDespesasAluguelMensal();

    const repasseArgs = repasseCreate.mock.calls[0][0].data;
    expect(repasseArgs.proprietarioUsuarioId).toBe('usr-via-email');
    expect(usuarioFindUnique).toHaveBeenCalledWith({
      where: { email: 'dono@x.com' },
      select: { id: true },
    });
  });
});
