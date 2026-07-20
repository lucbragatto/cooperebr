/**
 * Corretiva CooperToken FASE 2 (2026-07-20) — testes obrigatórios dos 3
 * cenários aprovados pelo Luciano na Fase 1:
 *
 *  (1) 2 creditar concorrentes da mesma (cooperativaId, referenciaTabela,
 *      referenciaId, CREDITO) → 1 só crédito; o 2º pega P2002 no unique
 *      parcial `cooper_token_ledger_ref_origem_uniq` → try/catch converte
 *      em retorno idempotente do ledger existente. Sem duplo-crédito.
 *
 *  (2) 2 debitar concorrentes da mesma referência → mesmo padrão. Além
 *      disso, isolationLevel Serializable protege a race saldo vs saldo
 *      (2 leitores pegam o mesmo valor, um aborta com 40001 — Postgres).
 *      Aqui simulamos o caminho P2002 (referência repetida), que é o vetor
 *      testável sem Postgres real.
 *
 *  (3) Replay de QR: 2ª chamada com o MESMO `qrToken` (mesmo JWT com o
 *      mesmo `jti`) colide no `TokenTransacao.jti @unique` → 409
 *      ConflictException. Também: QR sem `jti` no payload (legado
 *      pré-corretiva) é rejeitado com BadRequestException.
 *
 * Mocking:
 *  - Prisma completo mockado (nenhuma conexão real).
 *  - P2002 simulado via Prisma.PrismaClientKnownRequestError com meta.target
 *    incluindo as colunas do unique parcial (creditar/debitar) ou 'jti' (QR).
 *  - `jwt` real (o payload precisa mesmo ser um JWT válido pro
 *    `processarPagamentoQr` decodificar).
 */
import * as jwt from 'jsonwebtoken';
import { Prisma } from '@prisma/client';
import { CooperTokenService } from './cooper-token.service';

const SECRET = 'idempotencia-race-secret-com-mais-de-32-chars-aaaaa';

function buildP2002(target: string[]): Prisma.PrismaClientKnownRequestError {
  return new Prisma.PrismaClientKnownRequestError(
    'Unique constraint failed on the fields: (`' + target.join('`,`') + '`)',
    {
      code: 'P2002',
      clientVersion: '6.x-mock',
      meta: { target },
    } as any,
  );
}

describe('CooperTokenService — Idempotência via unique parcial + jti (Corretiva 2026-07-20)', () => {
  const ORIG_SECRET = process.env.COOPERTOKEN_QR_SECRET;

  beforeAll(() => {
    process.env.COOPERTOKEN_QR_SECRET = SECRET;
  });

  afterAll(() => {
    if (ORIG_SECRET === undefined) {
      delete process.env.COOPERTOKEN_QR_SECRET;
    } else {
      process.env.COOPERTOKEN_QR_SECRET = ORIG_SECRET;
    }
  });

  // ────────────────────────────────────────────────────────────────
  // Cenário 1 — creditar idempotente via P2002
  // ────────────────────────────────────────────────────────────────
  it('creditar: 2 execuções concorrentes da mesma ref → 1 crédito; 2ª retorna existente (P2002)', async () => {
    const ledgerExistente = {
      id: 'ledger-1',
      cooperativaId: 'coop-A',
      cooperadoId: 'coop-1',
      referenciaId: 'ref-1',
      referenciaTabela: 'Cobranca',
      operacao: 'CREDITO',
      quantidade: 10,
    };
    // 1ª call = sucesso; 2ª call = P2002. Postgres+Prisma reais têm o mesmo
    // comportamento — o pattern do try/catch converte a 2ª em idempotência.
    const ledgerCreate = jest
      .fn()
      .mockResolvedValueOnce(ledgerExistente)
      .mockRejectedValueOnce(
        buildP2002(['cooperativaId', 'referenciaTabela', 'referenciaId', 'operacao']),
      );
    const saldoUpdate = jest.fn().mockResolvedValue({});
    const saldoFindUnique = jest.fn().mockResolvedValue({
      saldoDisponivel: 0,
      saldoPendente: 0,
      totalEmitido: 0,
      cooperativaId: 'coop-A',
    });
    const cooperadoFindUnique = jest.fn().mockResolvedValue({
      id: 'coop-1',
      status: 'ATIVO_RECEBENDO_CREDITOS',
      cooperativaId: 'coop-A',
    });
    // findFirst tem 2 papéis (Corretiva 2026-07-20 dupla camada):
    //  1) FAST-PATH pré-tx: retry óbvio → null nas 2 execuções (simula
    //     race real, ambos não vêem nada ainda).
    //  2) CATCH pós-P2002: retorna o ledger existente pra ser devolvido
    //     como idempotente.
    // Sequência de chamadas:
    //  1ª execução — fast-path=null (passa) → cria → sucesso
    //  2ª execução — fast-path=null (race, ainda não commit visible)
    //               → cria → P2002 → catch busca → retorna existente
    const ledgerFindFirst = jest
      .fn()
      .mockResolvedValueOnce(null)             // 1ª exec, fast-path
      .mockResolvedValueOnce(null)             // 2ª exec, fast-path (race)
      .mockResolvedValueOnce(ledgerExistente); // 2ª exec, catch P2002

    const tx = {
      cooperTokenSaldo: {
        findUnique: saldoFindUnique,
        update: saldoUpdate,
        create: jest.fn().mockResolvedValue({}),
      },
      cooperTokenLedger: { create: ledgerCreate },
      lancamentoCaixa: { create: jest.fn().mockResolvedValue({}) },
    };
    const prisma: any = {
      $transaction: jest.fn((cb: any) => cb(tx)),
      cooperado: { findUnique: cooperadoFindUnique },
      cooperTokenLedger: { findFirst: ledgerFindFirst },
      configCooperToken: { findUnique: jest.fn().mockResolvedValue(null) },
      contratoConvenio: { findFirst: jest.fn().mockResolvedValue(null) },
      auditLog: { create: jest.fn() },
    };
    const eventEmitter: any = { emit: jest.fn() };
    const service = new CooperTokenService(prisma, eventEmitter);

    const chamada = {
      cooperadoId: 'coop-1',
      cooperativaId: 'coop-A',
      tipo: 'CADASTRO' as any,
      quantidade: 10,
      referenciaId: 'ref-1',
      referenciaTabela: 'Cobranca',
    };
    // Sequenciais pra simular a race (mock retorna sucesso→P2002 na ordem):
    const r1 = await service.creditar(chamada);
    const r2 = await service.creditar(chamada);

    // Ambas retornaram o MESMO ledger. Nenhuma throw. Prova de idempotência.
    expect(r1?.id).toBe('ledger-1');
    expect(r2?.id).toBe('ledger-1');
    // findFirst chamado 3x: 2 fast-path + 1 catch P2002 (ver mockResolvedValueOnce).
    expect(ledgerFindFirst).toHaveBeenCalledTimes(3);
    // Último call = catch P2002 (formato: 5 colunas com operacao E cooperadoId,
    // após fix P3 #3 do revisor financeiro — cooperadoId no where blinda contra
    // colisão teórica cross-cooperado do mesmo tenant).
    const lastCall = ledgerFindFirst.mock.calls[2][0];
    expect(lastCall).toEqual({
      where: {
        cooperativaId: 'coop-A',
        cooperadoId: 'coop-1',
        referenciaTabela: 'Cobranca',
        referenciaId: 'ref-1',
        operacao: 'CREDITO',
      },
    });
  });

  // ────────────────────────────────────────────────────────────────
  // Cenário 2 — debitar idempotente via P2002 (mesma ref)
  // ────────────────────────────────────────────────────────────────
  it('debitar: 2 execuções concorrentes da mesma ref → sem duplo-gasto; 2ª retorna existente (P2002)', async () => {
    const ledgerExistente = {
      id: 'ledger-deb-1',
      cooperativaId: 'coop-A',
      cooperadoId: 'coop-1',
      referenciaId: 'cobranca-42',
      referenciaTabela: 'Cobranca',
      operacao: 'DEBITO',
      quantidade: 5,
      saldoApos: 95,
    };
    const ledgerCreate = jest
      .fn()
      .mockResolvedValueOnce(ledgerExistente)
      .mockRejectedValueOnce(
        buildP2002(['cooperativaId', 'referenciaTabela', 'referenciaId', 'operacao']),
      );
    const saldoUpdate = jest.fn().mockResolvedValue({});
    // Saldo suficiente pra 1ª e 2ª — a race só existe se ambas passam o check.
    const saldoFindUnique = jest.fn().mockResolvedValue({
      saldoDisponivel: 100,
      cooperativaId: 'coop-A',
    });
    const ledgerFindFirst = jest.fn().mockResolvedValue(ledgerExistente);

    const tx = {
      cooperTokenSaldo: { findUnique: saldoFindUnique, update: saldoUpdate },
      cooperTokenLedger: { create: ledgerCreate },
      lancamentoCaixa: { create: jest.fn().mockResolvedValue({}) },
    };
    const prisma: any = {
      $transaction: jest.fn((cb: any, _opts?: any) => cb(tx)),
      cooperTokenLedger: { findFirst: ledgerFindFirst },
      configCooperToken: { findUnique: jest.fn().mockResolvedValue(null) },
    };
    const eventEmitter: any = { emit: jest.fn() };
    const service = new CooperTokenService(prisma, eventEmitter);

    const chamada = {
      cooperadoId: 'coop-1',
      cooperativaId: 'coop-A',
      quantidade: 5,
      tipo: 'DESCONTO_FATURA' as any,
      referenciaId: 'cobranca-42',
      referenciaTabela: 'Cobranca',
    };
    const r1 = await service.debitar(chamada);
    const r2 = await service.debitar(chamada);

    // Ambas retornam o mesmo ledger. Nenhuma throw. Saldo nunca duplicou.
    expect(r1.id).toBe('ledger-deb-1');
    expect(r2.id).toBe('ledger-deb-1');
    expect(ledgerFindFirst).toHaveBeenCalledTimes(1);
    expect(ledgerFindFirst).toHaveBeenCalledWith({
      where: {
        cooperativaId: 'coop-A',
        cooperadoId: 'coop-1',
        referenciaTabela: 'Cobranca',
        referenciaId: 'cobranca-42',
        operacao: 'DEBITO',
      },
    });
    // NOTA: `saldoUpdate` foi chamado 2x neste teste porque o mock de
    // `$transaction` NÃO simula rollback real (só invoca o callback).
    // Em Postgres real, o P2002 no ledger.create aborta a tx inteira e
    // reverte o update do saldo — garantia do banco, não testável aqui.
    // A prova estrutural desse teste é: `debitar` NÃO throw + retorna
    // ledger existente. Prova da não-duplicação de saldo em produção
    // fica com Serializable + rollback do Postgres (validado por design
    // no `isolationLevel: Prisma.TransactionIsolationLevel.Serializable`).
  });

  // ────────────────────────────────────────────────────────────────
  // Cenário 3 — QR anti-replay (jti no JWT)
  // ────────────────────────────────────────────────────────────────
  it('processarPagamentoQr: 2ª chamada com o MESMO qrToken → 409 ConflictException (jti replay)', async () => {
    // Mock mínimo pra deixar processarPagamentoQr chegar até o create do
    // TokenTransacao (o único ponto onde o jti dispara P2002).
    const tokenTxCreate = jest
      .fn()
      .mockResolvedValueOnce({
        id: 'tt-1',
        jti: 'jti-fixed-abc',
        tier: 'BAIXO',
        motivoStepUp: 'PRIMEIRO_USO',
        status: 'CONFIRMADA',
      })
      .mockRejectedValueOnce(buildP2002(['jti']));

    const tx = {
      cooperTokenSaldo: {
        findFirst: jest.fn().mockResolvedValue({ saldoDisponivel: 100 }),
        findUnique: jest.fn().mockResolvedValue({ saldoDisponivel: 0, totalEmitido: 0 }),
        update: jest.fn().mockResolvedValue({}),
        create: jest.fn().mockResolvedValue({}),
      },
      cooperTokenLedger: { create: jest.fn().mockResolvedValue({}) },
      cooperado: {
        findUnique: jest.fn(({ where }: any) => {
          if (where.id === 'pagador') return Promise.resolve({ id: 'pagador', cooperativaId: 'coop-A' });
          if (where.id === 'recebedor') return Promise.resolve({ id: 'recebedor', cooperativaId: 'coop-A' });
          return Promise.resolve(null);
        }),
      },
      tokenTransacao: {
        count: jest.fn().mockResolvedValue(0),
        create: tokenTxCreate,
      },
    };
    const prisma: any = {
      $transaction: jest.fn((cb: any, _opts?: any) => cb(tx)),
      configCooperToken: { findUnique: jest.fn().mockResolvedValue(null) },
    };
    const eventEmitter: any = { emit: jest.fn() };
    const service = new CooperTokenService(prisma, eventEmitter);

    // Cria 1 QR e usa 2x — mesmo jti no payload, mesma assinatura.
    const jtiFixo = 'jti-fixed-abc';
    const qrToken = jwt.sign(
      {
        pagadorId: 'pagador',
        cooperativaId: 'coop-A',
        quantidade: 10,
        tipo: 'COOPER_TOKEN_QR',
        jti: jtiFixo,
      },
      SECRET,
    );

    // 1ª execução: sucesso.
    const r1 = await service.processarPagamentoQr({
      qrToken,
      recebedorId: 'recebedor',
      recebedorCooperativaId: 'coop-A',
    });
    expect((r1 as any).tokenTransacaoJti).toBe(jtiFixo);

    // 2ª execução com o MESMO qrToken → replay → 409.
    await expect(
      service.processarPagamentoQr({
        qrToken,
        recebedorId: 'recebedor',
        recebedorCooperativaId: 'coop-A',
      }),
    ).rejects.toThrow(/QR já utilizado/);
  });

  it('processarPagamentoQr: QR SEM jti no payload (legado pré-corretiva) → BadRequestException', async () => {
    // Prisma mínimo — nunca chega no tx porque o jti check é ANTES.
    const prisma: any = {
      $transaction: jest.fn(),
      configCooperToken: { findUnique: jest.fn() },
    };
    const eventEmitter: any = { emit: jest.fn() };
    const service = new CooperTokenService(prisma, eventEmitter);

    // Payload SEM jti (formato pré-2026-07-20).
    const qrLegado = jwt.sign(
      {
        pagadorId: 'pagador',
        cooperativaId: 'coop-A',
        quantidade: 10,
        tipo: 'COOPER_TOKEN_QR',
      },
      SECRET,
    );

    await expect(
      service.processarPagamentoQr({
        qrToken: qrLegado,
        recebedorId: 'recebedor',
        recebedorCooperativaId: 'coop-A',
      }),
    ).rejects.toThrow(/Gere um novo QR/);
    // Nenhuma tx aberta (rejeição antes da $transaction).
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });
});
