/**
 * Sprint Clube P1 — Fase 2 Bloco 3 (11/06/2026).
 *
 * Specs do `processarPagamentoCompraPj` invocado pelo
 * `CooperTokenCompraPjListener` quando webhook Asaas confirma pagamento.
 *
 * Cobre:
 *  - Idempotencia camada 1: webhook duplicado (ultimoWebhookEventId
 *    igual) → skip.
 *  - Status guard: compra ja PAGO → skip.
 *  - Caminho legado tenant (compradorCooperadoId null) → skip.
 *  - Compra nao encontrada → skip warn.
 *  - Happy path: PAYMENT_RECEIVED → update PAGO + creditar() chamado com
 *    tipo COMPRA_PJ_COOPERADA + referenciaId/referenciaTabela.
 *  - Idempotencia camada 2: ledger.findFirst ja achou entry com mesma ref
 *    → retorna existente (defesa final).
 */
import { CooperTokenService } from './cooper-token.service';

const COOPERATIVA = 'coop-A';
const COMPRADOR_PJ = 'pj-1';
const COMPRA_ID = 'compra-1';
const ASAAS_PAY_ID = 'asaas-pay-1';
const EVENT_ID = 'PAYMENT_RECEIVED_asaas-pay-1';

function buildPrisma(opts: {
  compra?: any;
  cooperado?: any;
  saldoExistente?: any;
  ledgerJaCreditado?: any;
  swapCount?: number; // GAP 1 fix: simula compare-and-swap count
}) {
  const swapCount = opts.swapCount ?? 1;
  return {
    cooperTokenCompra: {
      findUnique: jest.fn().mockResolvedValue(opts.compra ?? null),
      update: jest.fn().mockResolvedValue({}),
      // GAP 1 fix: updateMany usado pra compare-and-swap.
      updateMany: jest.fn().mockResolvedValue({ count: swapCount }),
    },
    cooperado: {
      findUnique: jest.fn().mockResolvedValue(opts.cooperado ?? null),
    },
    cooperTokenLedger: {
      findFirst: jest.fn().mockResolvedValue(opts.ledgerJaCreditado ?? null),
    },
    configCooperToken: {
      findUnique: jest.fn().mockResolvedValue(null),
    },
    $transaction: jest.fn(async (cb: any) => {
      const tx = {
        cooperTokenSaldo: {
          findUnique: jest.fn().mockResolvedValue(opts.saldoExistente ?? null),
          create: jest.fn().mockResolvedValue({ id: 'saldo-new' }),
          update: jest.fn().mockResolvedValue({ id: 'saldo-upd' }),
        },
        cooperTokenLedger: {
          create: jest.fn().mockResolvedValue({
            id: 'ledger-new',
            quantidade: 98, // 100 - taxa 2% (fallback)
            saldoApos: 98,
          }),
        },
      };
      return cb(tx);
    }),
  } as any;
}

function buildService(prismaMock: any) {
  const eventMock = { emit: jest.fn() } as any;
  return new CooperTokenService(prismaMock, eventMock);
}

describe('CooperTokenService.processarPagamentoCompraPj — F2 Bloco 3', () => {
  describe('Skips defensivos', () => {
    it('compra nao encontrada → skipped="compra-nao-encontrada"', async () => {
      const prisma = buildPrisma({ compra: null });
      const service = buildService(prisma);
      const r = await service.processarPagamentoCompraPj(COMPRA_ID, EVENT_ID);
      expect(r.skipped).toBe('compra-nao-encontrada');
      expect(prisma.cooperTokenCompra.update).not.toHaveBeenCalled();
    });

    it('webhook duplicado (ultimoWebhookEventId === eventId) → skipped="webhook-duplicado"', async () => {
      const prisma = buildPrisma({
        compra: {
          id: COMPRA_ID,
          ultimoWebhookEventId: EVENT_ID,
          status: 'PAGO',
          compradorCooperadoId: COMPRADOR_PJ,
          cooperativaId: COOPERATIVA,
          quantidade: 100,
        },
      });
      const service = buildService(prisma);
      const r = await service.processarPagamentoCompraPj(COMPRA_ID, EVENT_ID);
      expect(r.skipped).toBe('webhook-duplicado');
      expect(prisma.cooperTokenCompra.update).not.toHaveBeenCalled();
      expect(prisma.cooperado.findUnique).not.toHaveBeenCalled();
    });

    it('compra ja PAGO (eventId novo) → skipped="status-PAGO"', async () => {
      const prisma = buildPrisma({
        compra: {
          id: COMPRA_ID,
          ultimoWebhookEventId: 'evento-anterior',
          status: 'PAGO',
          compradorCooperadoId: COMPRADOR_PJ,
          cooperativaId: COOPERATIVA,
          quantidade: 100,
        },
      });
      const service = buildService(prisma);
      const r = await service.processarPagamentoCompraPj(COMPRA_ID, EVENT_ID);
      expect(r.skipped).toBe('status-PAGO');
      expect(prisma.cooperTokenCompra.update).not.toHaveBeenCalled();
    });

    it('compra CANCELADO → skipped="status-CANCELADO"', async () => {
      const prisma = buildPrisma({
        compra: {
          id: COMPRA_ID,
          ultimoWebhookEventId: null,
          status: 'CANCELADO',
          compradorCooperadoId: COMPRADOR_PJ,
          cooperativaId: COOPERATIVA,
          quantidade: 100,
        },
      });
      const service = buildService(prisma);
      const r = await service.processarPagamentoCompraPj(COMPRA_ID, EVENT_ID);
      expect(r.skipped).toBe('status-CANCELADO');
    });

    it('compra legada (compradorCooperadoId null) → skipped="compra-legada-tenant"', async () => {
      const prisma = buildPrisma({
        compra: {
          id: COMPRA_ID,
          ultimoWebhookEventId: null,
          status: 'AGUARDANDO_PAGAMENTO',
          compradorCooperadoId: null, // caminho legado parceiro/comprar
          cooperativaId: COOPERATIVA,
          quantidade: 100,
        },
      });
      const service = buildService(prisma);
      const r = await service.processarPagamentoCompraPj(COMPRA_ID, EVENT_ID);
      expect(r.skipped).toBe('compra-legada-tenant');
      expect(prisma.cooperTokenCompra.update).not.toHaveBeenCalled();
    });
  });

  describe('Happy path — webhook valido confirma compra PJ', () => {
    it('PAYMENT_RECEIVED → compare-and-swap PAGO + dataPagamento + ultimoWebhookEventId + creditar() chamado', async () => {
      const prisma = buildPrisma({
        compra: {
          id: COMPRA_ID,
          ultimoWebhookEventId: null,
          status: 'AGUARDANDO_PAGAMENTO',
          compradorCooperadoId: COMPRADOR_PJ,
          cooperativaId: COOPERATIVA,
          quantidade: 100,
          valorTokenReais: 0.45,
        },
        cooperado: { id: COMPRADOR_PJ, status: 'ATIVO', cooperativaId: COOPERATIVA },
        swapCount: 1, // venceu a corrida
      });
      const service = buildService(prisma);

      const r = await service.processarPagamentoCompraPj(COMPRA_ID, EVENT_ID);

      // GAP 1 fix — updateMany compare-and-swap (where inclui status + cooperativaId)
      expect(prisma.cooperTokenCompra.updateMany).toHaveBeenCalledWith({
        where: {
          id: COMPRA_ID,
          cooperativaId: COOPERATIVA,
          status: 'AGUARDANDO_PAGAMENTO',
        },
        data: expect.objectContaining({
          status: 'PAGO',
          dataPagamento: expect.any(Date),
          ultimoWebhookEventId: EVENT_ID,
        }),
      });

      // creditar() foi chamado (via findUnique do cooperado + findFirst do ledger)
      expect(prisma.cooperado.findUnique).toHaveBeenCalledWith({
        where: { id: COMPRADOR_PJ },
        select: { id: true, status: true, cooperativaId: true },
      });
      // Idempotencia camada 2 — ledger.findFirst com referencia
      expect(prisma.cooperTokenLedger.findFirst).toHaveBeenCalledWith({
        where: {
          referenciaId: COMPRA_ID,
          referenciaTabela: 'CooperTokenCompra',
          cooperadoId: COMPRADOR_PJ,
          cooperativaId: COOPERATIVA,
        },
      });

      expect(r.creditado).toBe(true);
      expect(r.quantidadeLiquida).toBe(98); // 100 - taxa 2% fallback
    });

    it('idempotencia camada 2: ledger ja creditado pela ref → retorna existente sem update', async () => {
      const prisma = buildPrisma({
        compra: {
          id: COMPRA_ID,
          ultimoWebhookEventId: null,
          status: 'AGUARDANDO_PAGAMENTO',
          compradorCooperadoId: COMPRADOR_PJ,
          cooperativaId: COOPERATIVA,
          quantidade: 100,
          valorTokenReais: 0.45,
        },
        cooperado: { id: COMPRADOR_PJ, status: 'ATIVO', cooperativaId: COOPERATIVA },
        ledgerJaCreditado: {
          id: 'ledger-anterior',
          quantidade: 98,
        },
        swapCount: 1,
      });
      const service = buildService(prisma);

      const r = await service.processarPagamentoCompraPj(COMPRA_ID, EVENT_ID);

      expect(prisma.cooperTokenCompra.updateMany).toHaveBeenCalled();
      expect(prisma.$transaction).not.toHaveBeenCalled();
      expect(r.creditado).toBe(true);
      expect(r.quantidadeLiquida).toBe(98);
    });
  });

  // ── Fixes pós-review (11/06/2026) ──────────────────────────────────

  describe('GAP 1 — Compare-and-swap atomico (CONFIRMED + RECEIVED concorrentes)', () => {
    it('swapCount=0 (outro evento ja venceu) → skipped="corrida-perdida" + creditar NUNCA roda', async () => {
      const prisma = buildPrisma({
        compra: {
          id: COMPRA_ID,
          ultimoWebhookEventId: null,
          status: 'AGUARDANDO_PAGAMENTO',
          compradorCooperadoId: COMPRADOR_PJ,
          cooperativaId: COOPERATIVA,
          quantidade: 100,
          valorTokenReais: 0.45,
        },
        cooperado: { id: COMPRADOR_PJ, status: 'ATIVO', cooperativaId: COOPERATIVA },
        swapCount: 0, // outro webhook ja venceu
      });
      const service = buildService(prisma);

      const r = await service.processarPagamentoCompraPj(COMPRA_ID, EVENT_ID);

      // Compare-and-swap rodou
      expect(prisma.cooperTokenCompra.updateMany).toHaveBeenCalledWith({
        where: {
          id: COMPRA_ID,
          cooperativaId: COOPERATIVA,
          status: 'AGUARDANDO_PAGAMENTO',
        },
        data: expect.any(Object),
      });
      // Mas creditar() NAO foi tocado (cooperado.findUnique nem chamado)
      expect(prisma.cooperado.findUnique).not.toHaveBeenCalled();
      expect(prisma.$transaction).not.toHaveBeenCalled();
      expect(r.skipped).toBe('corrida-perdida');
    });

    it('dual-event CONFIRMED+RECEIVED do mesmo payment → so 1 vence (1o vez count=1; 2a vez count=0)', async () => {
      // Simula 2 chamadas sequenciais como se 2 webhooks chegassem.
      const compra = {
        id: COMPRA_ID,
        ultimoWebhookEventId: null,
        status: 'AGUARDANDO_PAGAMENTO',
        compradorCooperadoId: COMPRADOR_PJ,
        cooperativaId: COOPERATIVA,
        quantidade: 100,
        valorTokenReais: 0.45,
      };
      let chamada = 0;
      const prisma = {
        cooperTokenCompra: {
          findUnique: jest.fn().mockResolvedValue(compra),
          update: jest.fn(),
          updateMany: jest.fn(() => {
            chamada += 1;
            // 1a chamada: vence (count=1). 2a: ja era PAGO → count=0.
            return Promise.resolve({ count: chamada === 1 ? 1 : 0 });
          }),
        },
        cooperado: {
          findUnique: jest.fn().mockResolvedValue({ id: COMPRADOR_PJ, status: 'ATIVO', cooperativaId: COOPERATIVA }),
        },
        cooperTokenLedger: {
          findFirst: jest.fn().mockResolvedValue(null),
        },
        configCooperToken: { findUnique: jest.fn().mockResolvedValue(null) },
        $transaction: jest.fn(async (cb: any) => {
          const tx = {
            cooperTokenSaldo: {
              findUnique: jest.fn().mockResolvedValue(null),
              create: jest.fn().mockResolvedValue({}),
              update: jest.fn(),
            },
            cooperTokenLedger: {
              create: jest.fn().mockResolvedValue({ id: 'ledger-1', quantidade: 98, saldoApos: 98 }),
            },
          };
          return cb(tx);
        }),
      } as any;
      const service = buildService(prisma);

      const r1 = await service.processarPagamentoCompraPj(COMPRA_ID, 'PAYMENT_CONFIRMED_pay');
      const r2 = await service.processarPagamentoCompraPj(COMPRA_ID, 'PAYMENT_RECEIVED_pay');

      // 1o evento ganhou: creditou
      expect(r1.creditado).toBe(true);
      // 2o evento perdeu corrida: skip
      expect(r2.skipped).toBe('corrida-perdida');
      // $transaction (creditar) so rodou 1 vez
      expect(prisma.$transaction).toHaveBeenCalledTimes(1);
    });
  });

  describe('GAP 2 — Pago sem token (alerta loud, NUNCA silencioso)', () => {
    it('creditar() retorna null → status PAGO_CREDITO_PENDENTE + evento pendencia + alertaPendencia=true', async () => {
      const prisma = buildPrisma({
        compra: {
          id: COMPRA_ID,
          ultimoWebhookEventId: null,
          status: 'AGUARDANDO_PAGAMENTO',
          compradorCooperadoId: COMPRADOR_PJ,
          cooperativaId: COOPERATIVA,
          quantidade: 100,
          valorTokenReais: 0.45,
        },
        // Cooperado PENDENTE em creditar() → retorna null.
        cooperado: { id: COMPRADOR_PJ, status: 'PENDENTE', cooperativaId: COOPERATIVA },
        swapCount: 1,
      });
      const eventMock = { emit: jest.fn() } as any;
      const service = new CooperTokenService(prisma, eventMock);

      const r = await service.processarPagamentoCompraPj(COMPRA_ID, EVENT_ID);

      // Update compensatorio pra PAGO_CREDITO_PENDENTE (com cooperativaId)
      expect(prisma.cooperTokenCompra.updateMany).toHaveBeenCalledWith({
        where: { id: COMPRA_ID, cooperativaId: COOPERATIVA, status: 'PAGO' },
        data: { status: 'PAGO_CREDITO_PENDENTE' },
      });

      // Evento de pendencia emitido
      expect(eventMock.emit).toHaveBeenCalledWith(
        'cooper-token-compra-pj.credito-pendente',
        expect.objectContaining({
          compraId: COMPRA_ID,
          cooperativaId: COOPERATIVA,
          compradorCooperadoId: COMPRADOR_PJ,
          quantidade: 100,
          eventId: EVENT_ID,
        }),
      );

      expect(r.creditado).toBe(false);
      expect(r.alertaPendencia).toBe(true);
    });
  });

  describe('Defesa multi-tenant em creditar (cross-tenant bloqueado)', () => {
    it('cooperado.cooperativaId !== param.cooperativaId → creditar retorna null → status PAGO_CREDITO_PENDENTE', async () => {
      const prisma = buildPrisma({
        compra: {
          id: COMPRA_ID,
          ultimoWebhookEventId: null,
          status: 'AGUARDANDO_PAGAMENTO',
          compradorCooperadoId: COMPRADOR_PJ,
          cooperativaId: COOPERATIVA, // tenant A
          quantidade: 100,
          valorTokenReais: 0.45,
        },
        // Cooperado existe MAS pertence a OUTRO tenant (cross-tenant attempt)
        cooperado: { id: COMPRADOR_PJ, status: 'ATIVO', cooperativaId: 'tenant-OUTRO' },
        swapCount: 1,
      });
      const service = buildService(prisma);
      const r = await service.processarPagamentoCompraPj(COMPRA_ID, EVENT_ID);
      // Compare-and-swap rolou (camada 1 OK), mas creditar bloqueou cross-tenant
      expect(prisma.cooperTokenCompra.updateMany).toHaveBeenCalled();
      // E o update compensatorio (PAGO_CREDITO_PENDENTE) tambem rolou
      expect(r.creditado).toBe(false);
      expect(r.alertaPendencia).toBe(true);
    });
  });
});
