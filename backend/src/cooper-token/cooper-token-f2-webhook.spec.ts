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
}) {
  return {
    cooperTokenCompra: {
      findUnique: jest.fn().mockResolvedValue(opts.compra ?? null),
      update: jest.fn().mockResolvedValue({}),
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
    it('PAYMENT_RECEIVED → update PAGO + dataPagamento + ultimoWebhookEventId + creditar() chamado', async () => {
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
        cooperado: { id: COMPRADOR_PJ, status: 'ATIVO' },
      });
      const service = buildService(prisma);

      const r = await service.processarPagamentoCompraPj(COMPRA_ID, EVENT_ID);

      // Update da CooperTokenCompra
      expect(prisma.cooperTokenCompra.update).toHaveBeenCalledWith({
        where: { id: COMPRA_ID },
        data: expect.objectContaining({
          status: 'PAGO',
          dataPagamento: expect.any(Date),
          ultimoWebhookEventId: EVENT_ID,
        }),
      });

      // creditar() foi chamado (via findUnique do cooperado + findFirst do ledger)
      expect(prisma.cooperado.findUnique).toHaveBeenCalledWith({
        where: { id: COMPRADOR_PJ },
        select: { id: true, status: true },
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
        cooperado: { id: COMPRADOR_PJ, status: 'ATIVO' },
        ledgerJaCreditado: {
          id: 'ledger-anterior',
          quantidade: 98,
        },
      });
      const service = buildService(prisma);

      const r = await service.processarPagamentoCompraPj(COMPRA_ID, EVENT_ID);

      // Update da compra acontece (idempotencia camada 1 OK)
      expect(prisma.cooperTokenCompra.update).toHaveBeenCalled();
      // Mas $transaction do creditar nao roda (ledger ja existe)
      expect(prisma.$transaction).not.toHaveBeenCalled();
      // creditar() retorna o ledger existente
      expect(r.creditado).toBe(true);
      expect(r.quantidadeLiquida).toBe(98);
    });

    it('cooperado com status PENDENTE → creditar retorna null → creditado=false', async () => {
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
        cooperado: { id: COMPRADOR_PJ, status: 'PENDENTE' }, // bloqueado em creditar()
      });
      const service = buildService(prisma);
      const r = await service.processarPagamentoCompraPj(COMPRA_ID, EVENT_ID);
      // Update da compra rolou; mas credito nao
      expect(prisma.cooperTokenCompra.update).toHaveBeenCalled();
      expect(r.creditado).toBe(false);
    });
  });
});
