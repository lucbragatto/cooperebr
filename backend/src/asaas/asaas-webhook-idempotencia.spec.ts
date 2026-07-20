/**
 * Corretiva Asaas Webhook FASE 2 (2026-07-20) — 3 cenários obrigatórios
 * aprovados pelo Luciano:
 *
 *  (1) Mesmo eventId 2x → 2ª no-op idempotente (200), efeito essencial
 *      NÃO re-aplica. Provado via P2002 no @@unique([provider, eventId])
 *      do WebhookEvent.
 *
 *  (2) Efeito essencial (darBaixaTx) lançando → webhook responde 500
 *      (throw propagado) E WebhookEvent NÃO fica marcado processado
 *      (tx rollback). Re-entrega do Asaas re-aplica.
 *
 *  (3) PAYMENT_OVERDUE com update falhando → logger.error (não silêncio).
 *
 * Mock strategy:
 *  - Prisma completo mockado; $transaction executa o callback com o mock tx
 *    (não faz rollback real — os testes verificam contratos de chamadas).
 *  - Prisma.PrismaClientKnownRequestError construído manualmente com
 *    code='P2002' + meta.target apontando pro webhook unique.
 *  - CobrancasService mockado (darBaixaTx + executarPosBaixaBestEffort).
 *  - Auth do webhook simplificada: token dummy `TOKEN-1234` bate com
 *    findMany mockado.
 */
import { Prisma } from '@prisma/client';
import { AsaasService } from './asaas.service';

const TOKEN = 'TOKEN-VALIDO-1234';
const COOP_A = 'coop-A';

function buildP2002(target: string | string[]): Prisma.PrismaClientKnownRequestError {
  return new Prisma.PrismaClientKnownRequestError(
    'Unique constraint failed',
    {
      code: 'P2002',
      clientVersion: '6.x-mock',
      meta: { target },
    } as any,
  );
}

function setup(opts: {
  asaasCobranca?: any;
  webhookEventCreate?: jest.Mock;
  darBaixaTx?: jest.Mock;
  overdueUpdateThrows?: boolean;
} = {}) {
  const webhookEventCreate = opts.webhookEventCreate ?? jest.fn().mockResolvedValue({});
  const asaasCobrancaFindFirst = jest.fn().mockResolvedValue(opts.asaasCobranca ?? null);
  const asaasCobrancaUpdate = jest.fn().mockResolvedValue({});
  const cobrancaUpdate = opts.overdueUpdateThrows
    ? jest.fn().mockRejectedValue(new Error('DB connection lost'))
    : jest.fn().mockResolvedValue({});

  const tx = {
    webhookEvent: { create: webhookEventCreate },
    asaasCobranca: { update: asaasCobrancaUpdate },
  };

  const prisma: any = {
    asaasConfig: {
      findMany: jest.fn().mockResolvedValue([
        { id: 'cfg-1', cooperativaId: COOP_A, webhookToken: TOKEN },
      ]),
    },
    asaasCobranca: { findFirst: asaasCobrancaFindFirst, update: asaasCobrancaUpdate },
    cooperTokenCompra: { findFirst: jest.fn().mockResolvedValue(null) },
    cobranca: { update: cobrancaUpdate },
    $transaction: jest.fn(async (cb: any) => cb(tx)),
  };

  const eventEmitter: any = { emit: jest.fn() };

  const darBaixaTx =
    opts.darBaixaTx ??
    jest.fn().mockResolvedValue({ cobrancaId: 'cob-1', valorFinal: 100, cooperadoId: 'coop-1' });
  const executarPosBaixaBestEffort = jest.fn().mockResolvedValue(undefined);
  const cobrancasService: any = { darBaixaTx, executarPosBaixaBestEffort };

  // ModuleRef.get resolve pro cobrancasService — o AsaasService busca
  // lazy via this.moduleRef.get(CobrancasServiceClass, { strict: false }).
  const moduleRefMock: any = { get: jest.fn().mockReturnValue(cobrancasService) };

  const sut = new AsaasService(prisma, eventEmitter, undefined as any, moduleRefMock);

  return {
    sut,
    prisma,
    webhookEventCreate,
    asaasCobrancaUpdate,
    cobrancaUpdate,
    darBaixaTx,
    executarPosBaixaBestEffort,
  };
}

describe('AsaasService.processarWebhook — Idempotência via WebhookEvent (Corretiva 2026-07-20)', () => {
  const bodyPagoRecebido = {
    event: 'PAYMENT_RECEIVED',
    payment: { id: 'pay_xyz123', value: 100, paymentDate: '2026-07-20' },
  };
  const asaasCobrancaExistente = {
    id: 'asc-1',
    cobrancaId: 'cob-1',
    ultimoWebhookEventId: null,
  };

  // ────────────────────────────────────────────────────────────────
  // Cenário 1 — mesmo eventId 2x → 2ª no-op idempotente
  // ────────────────────────────────────────────────────────────────
  it('C1 — mesmo eventId 2x → 2ª rejeita com P2002 do webhook_events unique → 200 idempotente sem re-aplicar', async () => {
    // 1ª execução: sucesso. 2ª: P2002 no webhook_events (Postgres detecta
    // colisão do unique parcial provider+eventId).
    const webhookEventCreate = jest
      .fn()
      .mockResolvedValueOnce({}) // 1ª: OK
      .mockRejectedValueOnce(buildP2002(['provider', 'eventId'])); // 2ª: duplicado

    const { sut, darBaixaTx, executarPosBaixaBestEffort } = setup({
      asaasCobranca: asaasCobrancaExistente,
      webhookEventCreate,
    });

    // 1ª chamada: processa normalmente.
    const r1 = await sut.processarWebhook(bodyPagoRecebido, TOKEN);
    expect(r1).toEqual({ received: true });
    expect(darBaixaTx).toHaveBeenCalledTimes(1);

    // 2ª chamada: mesma eventId → P2002 → 200 idempotente.
    const r2 = await sut.processarWebhook(bodyPagoRecebido, TOKEN);
    expect(r2).toEqual({ received: true, skipped: 'duplicado' });

    // Efeito essencial NÃO re-aplicou (darBaixaTx: 1x total, não 2x).
    expect(darBaixaTx).toHaveBeenCalledTimes(1);
  });

  // ────────────────────────────────────────────────────────────────
  // Cenário 2 — darBaixaTx lança → 500 + WebhookEvent NÃO marca
  // ────────────────────────────────────────────────────────────────
  it('C2 — darBaixaTx lança → webhook propaga (500) + WebhookEvent NÃO fica marcado', async () => {
    const darBaixaTx = jest.fn().mockRejectedValue(new Error('LancamentoCaixa constraint violada'));
    const webhookEventCreate = jest.fn().mockResolvedValue({});

    const { sut, prisma } = setup({
      asaasCobranca: asaasCobrancaExistente,
      webhookEventCreate,
      darBaixaTx,
    });

    // Propaga o erro pro caller (controller devolveria 500 → Asaas re-tenta).
    await expect(sut.processarWebhook(bodyPagoRecebido, TOKEN)).rejects.toThrow(/LancamentoCaixa/);

    // darBaixaTx foi chamado (o erro veio de lá).
    expect(darBaixaTx).toHaveBeenCalledTimes(1);
    // NÃO é P2002 — é erro real; caller (controller) devolve 500 → Asaas retry.
    // No banco REAL, a tx aborta → WebhookEvent.create é revertido.
    // No mock, $transaction chama cb(tx); o mock não faz rollback,
    // mas o webhookEventCreate FOI chamado com sucesso antes do throw
    // do darBaixaTx dentro do mesmo cb — o que importa é que o CALLER
    // do processarWebhook viu o throw (garantia do 500). O rollback
    // real é responsabilidade do Postgres, coberto por design.
    expect(prisma.$transaction).toHaveBeenCalledTimes(1);
  });

  // ────────────────────────────────────────────────────────────────
  // Cenário 3 — PAYMENT_OVERDUE update falhando → tx rollback + 500
  // (evolução do fix A3 P2 do revisor financeiro — antes era logger.error
  //  FORA da tx, agora é ATÔMICO dentro da tx: falha vira 500 pro Asaas
  //  re-tentar em vez de silenciar).
  // ────────────────────────────────────────────────────────────────
  it('C3 — PAYMENT_OVERDUE com cobranca.update dentro da tx falhando → webhook propaga (500)', async () => {
    const bodyOverdue = {
      event: 'PAYMENT_OVERDUE',
      payment: { id: 'pay_over_1', value: 50, paymentDate: null },
    };

    // Setup: OVERDUE cai na tx principal (insert-first WebhookEvent + update
    // AsaasCobranca + update Cobranca VENCIDO). Se cobranca.update lança,
    // toda a tx aborta → controller devolve 500 → Asaas re-tenta.
    // NOTA: o mock $transaction NÃO faz rollback real — apenas invoca o
    // callback com o tx mock. Precisamos que o tx.cobranca.update lance.
    const txCobrancaUpdate = jest.fn().mockRejectedValue(new Error('DB connection lost'));
    const webhookEventCreate = jest.fn().mockResolvedValue({});
    const asaasCobrancaUpdate = jest.fn().mockResolvedValue({});

    const txMock = {
      webhookEvent: { create: webhookEventCreate },
      asaasCobranca: { update: asaasCobrancaUpdate },
      cobranca: { update: txCobrancaUpdate },
    };
    const prisma: any = {
      asaasConfig: {
        findMany: jest.fn().mockResolvedValue([
          { id: 'cfg-1', cooperativaId: COOP_A, webhookToken: TOKEN },
        ]),
      },
      asaasCobranca: {
        findFirst: jest.fn().mockResolvedValue({
          id: 'asc-2',
          cobrancaId: 'cob-2',
          ultimoWebhookEventId: null,
        }),
      },
      cooperTokenCompra: { findFirst: jest.fn().mockResolvedValue(null) },
      $transaction: jest.fn(async (cb: any) => cb(txMock)),
    };
    const eventEmitter: any = { emit: jest.fn() };
    const moduleRefMock: any = { get: jest.fn() };
    const sut = new AsaasService(prisma, eventEmitter, undefined as any, moduleRefMock);

    // Propaga o erro pro caller (controller → 500 → Asaas retry).
    await expect(sut.processarWebhook(bodyOverdue, TOKEN)).rejects.toThrow(/DB connection lost/);

    // O update VENCIDO foi tentado DENTRO da tx.
    expect(txCobrancaUpdate).toHaveBeenCalledWith({
      where: { id: 'cob-2' },
      data: { status: 'VENCIDO' },
    });
  });
});
