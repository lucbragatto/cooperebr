/**
 * Sprint Clube P1 — F6 Bloco C.4 P0-B (14/06/2026).
 *
 * Specs do branch TRANSFER_* no AsaasService.processarWebhook (PIX-out
 * do resgate F6).
 *
 * Foco:
 *  - Roteamento por event.startsWith('TRANSFER_').
 *  - Resolução de tenant via recibo (anti-fraude cross-tenant).
 *  - Auth cruzada: token de cooperativa X NÃO processa TRANSFER de Y.
 *  - Mapeamento de eventos:
 *     DONE/CONFIRMED → sucesso=true
 *     FAILED/CANCELLED → sucesso=false + motivoFalha
 *     CREATED/PENDING/outros → skipped='evento-intermediario'
 *  - Emit pra 'cooper-token-resgate.transfer' com payload correto.
 *  - transfer ausente / recibo não-encontrado → skipped sem erro.
 */
import { UnauthorizedException } from '@nestjs/common';
import { AsaasService } from './asaas.service';

const COOP_A = 'coop-A';
const COOP_B = 'coop-B';

function setup(opts: {
  tokenValido?: boolean;
  configCooperativaId?: string;
  recibo?: any;
} = {}) {
  const findManyConfig = jest.fn().mockResolvedValue(
    opts.tokenValido === false
      ? []
      : [
          {
            id: 'cfg-1',
            cooperativaId: opts.configCooperativaId ?? COOP_A,
            webhookToken: 'TOKEN-VALIDO-1234',
          },
        ],
  );
  const findFirstRecibo = jest.fn().mockResolvedValue(
    opts.recibo === undefined
      ? {
          id: 'rec-1',
          cooperativaId: COOP_A,
          numeroRecibo: 'RES-2026-00001',
          status: 'APROVADO_PIX_DISPARADO',
        }
      : opts.recibo,
  );

  const prisma: any = {
    asaasConfig: { findMany: findManyConfig },
    asaasCobranca: { findFirst: jest.fn().mockResolvedValue(null), update: jest.fn() },
    cooperTokenCompra: { findFirst: jest.fn().mockResolvedValue(null) },
    cobranca: { update: jest.fn() },
    resgateRecibo: { findFirst: findFirstRecibo },
  };
  const eventEmitter: any = { emit: jest.fn() };

  // AsaasService construtor (verificar signature antes — usa este shape no
  // resto do projeto). Os outros deps são undefined porque essas branches
  // não tocam HTTP nem AsaasConfig service.
  // AsaasService constructor: (prisma, eventEmitter, credentialsEncryptor).
  // O TRANSFER_* não toca credentialsEncryptor — mock undefined OK.
  const sut = new AsaasService(prisma, eventEmitter, undefined as any);
  return { sut, prisma, eventEmitter, findFirstRecibo };
}

describe('AsaasService.processarWebhook — TRANSFER_* (F6 P0-B)', () => {
  // Token mock que bate com o do setup (timing-safe compare).
  const TOKEN = 'TOKEN-VALIDO-1234';

  // ── Auth ──────────────────────────────────────────────────────────────
  it('token ausente → UnauthorizedException', async () => {
    const { sut } = setup();
    await expect(
      sut.processarWebhook(
        { event: 'TRANSFER_DONE', transfer: { id: 't-1' } },
        '',
      ),
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('token inválido (não bate com nenhuma config) → UnauthorizedException', async () => {
    const { sut } = setup({ tokenValido: false });
    await expect(
      sut.processarWebhook(
        { event: 'TRANSFER_DONE', transfer: { id: 't-1' } },
        'TOKEN-ERRADO-9999',
      ),
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });

  // ── Roteamento ────────────────────────────────────────────────────────
  it('event=TRANSFER_DONE roteia pra branch TRANSFER e busca recibo', async () => {
    const { sut, findFirstRecibo } = setup();
    await sut.processarWebhook(
      { event: 'TRANSFER_DONE', transfer: { id: 't-asaas-1' } },
      TOKEN,
    );
    expect(findFirstRecibo).toHaveBeenCalledWith({
      where: { asaasTransferId: 't-asaas-1' },
      select: expect.objectContaining({ cooperativaId: true }),
    });
  });

  it('event=PAYMENT_* NÃO roteia pra branch TRANSFER (resgate)', async () => {
    const { sut, findFirstRecibo } = setup();
    await sut.processarWebhook(
      { event: 'PAYMENT_RECEIVED', payment: { id: 'p-1' } },
      TOKEN,
    );
    expect(findFirstRecibo).not.toHaveBeenCalled();
  });

  // ── Auth cruzada (D-novo-ASAAS-WEBHOOK-AUTH fechado de carona) ────────
  it('token de coop X tentando processar TRANSFER de coop Y → UnauthorizedException', async () => {
    const { sut } = setup({
      configCooperativaId: COOP_A,
      recibo: {
        id: 'rec-Y',
        cooperativaId: COOP_B, // ≠ token
        numeroRecibo: 'RES-2026-00099',
        status: 'APROVADO_PIX_DISPARADO',
      },
    });
    await expect(
      sut.processarWebhook(
        { event: 'TRANSFER_DONE', transfer: { id: 't-Y' } },
        TOKEN,
      ),
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });

  // ── Eventos / mapeamento ──────────────────────────────────────────────
  it('TRANSFER_DONE → emit sucesso=true sem motivoFalha', async () => {
    const { sut, eventEmitter } = setup();
    await sut.processarWebhook(
      { event: 'TRANSFER_DONE', transfer: { id: 't-1' } },
      TOKEN,
    );
    expect(eventEmitter.emit).toHaveBeenCalledWith(
      'cooper-token-resgate.transfer',
      expect.objectContaining({
        asaasTransferId: 't-1',
        eventId: 'TRANSFER_DONE_t-1',
        sucesso: true,
        cooperativaId: COOP_A,
      }),
    );
  });

  it('TRANSFER_CONFIRMED → emit sucesso=true', async () => {
    const { sut, eventEmitter } = setup();
    await sut.processarWebhook(
      { event: 'TRANSFER_CONFIRMED', transfer: { id: 't-2' } },
      TOKEN,
    );
    const call = eventEmitter.emit.mock.calls[0];
    expect(call[1].sucesso).toBe(true);
  });

  it('TRANSFER_FAILED → emit sucesso=false + motivoFalha (failReason)', async () => {
    const { sut, eventEmitter } = setup();
    await sut.processarWebhook(
      {
        event: 'TRANSFER_FAILED',
        transfer: { id: 't-3', failReason: 'Saldo insuficiente Asaas' },
      },
      TOKEN,
    );
    expect(eventEmitter.emit).toHaveBeenCalledWith(
      'cooper-token-resgate.transfer',
      expect.objectContaining({
        sucesso: false,
        motivoFalha: 'Saldo insuficiente Asaas',
      }),
    );
  });

  it('TRANSFER_CANCELLED sem failReason → motivoFalha fallback', async () => {
    const { sut, eventEmitter } = setup();
    await sut.processarWebhook(
      { event: 'TRANSFER_CANCELLED', transfer: { id: 't-4' } },
      TOKEN,
    );
    expect(eventEmitter.emit).toHaveBeenCalledWith(
      'cooper-token-resgate.transfer',
      expect.objectContaining({
        sucesso: false,
        motivoFalha: 'Asaas reportou TRANSFER_CANCELLED',
      }),
    );
  });

  it('TRANSFER_PENDING (intermediário) → skipped sem emit', async () => {
    const { sut, eventEmitter } = setup();
    const r = await sut.processarWebhook(
      { event: 'TRANSFER_PENDING', transfer: { id: 't-5' } },
      TOKEN,
    );
    expect(r).toEqual({ received: true, skipped: 'evento-intermediario' });
    expect(eventEmitter.emit).not.toHaveBeenCalled();
  });

  it('TRANSFER_CREATED (intermediário) → skipped sem emit', async () => {
    const { sut, eventEmitter } = setup();
    await sut.processarWebhook(
      { event: 'TRANSFER_CREATED', transfer: { id: 't-6' } },
      TOKEN,
    );
    expect(eventEmitter.emit).not.toHaveBeenCalled();
  });

  // ── Edge cases ────────────────────────────────────────────────────────
  it('event=TRANSFER_DONE sem transfer.id → skipped="sem-transfer-id" sem erro', async () => {
    const { sut, eventEmitter } = setup();
    const r = await sut.processarWebhook(
      { event: 'TRANSFER_DONE', transfer: {} },
      TOKEN,
    );
    expect(r).toEqual({ received: true, skipped: 'sem-transfer-id' });
    expect(eventEmitter.emit).not.toHaveBeenCalled();
  });

  it('recibo não encontrado → skipped="recibo-nao-encontrado" sem erro (janela de race ok)', async () => {
    const { sut, eventEmitter } = setup({ recibo: null });
    const r = await sut.processarWebhook(
      { event: 'TRANSFER_DONE', transfer: { id: 't-orfao' } },
      TOKEN,
    );
    expect(r).toEqual({ received: true, skipped: 'recibo-nao-encontrado' });
    expect(eventEmitter.emit).not.toHaveBeenCalled();
  });
});
