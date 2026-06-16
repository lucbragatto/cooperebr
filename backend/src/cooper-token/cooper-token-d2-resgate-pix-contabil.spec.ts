/**
 * Sprint D2 (16/06/2026) — Bloco (c) D-RESGATE-PIX-SEM-CAIXA P1.
 *
 * Specs do lançamento contábil D Passivo / C Caixa no webhook PAGO:
 *   1. webhook PAGO → tokenContabilService.lancarResgatePix chamado
 *      com valor liquidoReais + descricao + cooperadoId.
 *   2. tokenContabilService AUSENTE → throw (Asaas re-envia).
 *   3. contábil falha pós-saída-de-caixa → status degrada pra
 *      PAGO_CREDITO_PENDENTE + motivoFalha (NUNCA perde lançamento).
 *   4. CAS perde (recibo já em outro estado) → contábil NÃO chamado.
 *
 * Estratégia mock: replicar o setup mínimo do F6 Bloco B pra
 * processarWebhookResgate em isolamento.
 */
import { CooperTokenService } from './cooper-token.service';

const EMPRESA = 'estab-1';
const COOP = 'coop-A';

interface SetupOpts {
  reciboParaUpdate?: any;
  lancarResgatePixMock?: jest.Mock;
  tokenContabilUndefined?: boolean;
  swapCount?: number;
  updateManyStatusCalls?: jest.Mock;
}

function setupWebhook(opts: SetupOpts = {}) {
  const reciboBase = opts.reciboParaUpdate ?? {
    id: 'recibo-1',
    numeroRecibo: 'RES-2026-00001',
    status: 'APROVADO_PIX_DISPARADO',
    cooperativaId: COOP,
    cooperadoEstabelecimentoId: EMPRESA,
    valorBrutoTokens: 10,
    valorLiquidoTokens: 10,
    valorBrutoReais: 4.5,
    valorLiquidoReais: 4.5,
    pixChave: '+5527981341348',
    pixTipo: 'TELEFONE',
    asaasTransferId: 'asaas-tx-1',
    ultimoWebhookEventId: null,
  };

  const txUpdateSaldoStatusFn = jest
    .fn()
    .mockResolvedValue({ count: opts.swapCount ?? 1 });
  const updateManyStatus =
    opts.updateManyStatusCalls ?? jest.fn().mockResolvedValue({ count: 1 });

  const tx: any = {
    cooperTokenSaldo: {
      findUnique: jest.fn().mockResolvedValue({
        cooperadoId: EMPRESA,
        saldoDisponivel: 90,
        saldoBloqueadoResgate: 10,
      }),
      updateMany: jest.fn().mockResolvedValue({}),
    },
    cooperTokenLedger: { create: jest.fn().mockResolvedValue({ id: 'ledger-1' }) },
    resgateRecibo: {
      updateMany: txUpdateSaldoStatusFn,
    },
  };

  const prisma: any = {
    $transaction: jest.fn(async (cb: any) => cb(tx)),
    resgateRecibo: {
      // findFirst recebe { where: { asaasTransferId, cooperativaId } } no caller
      // (Sprint D2 P2 fix). Mock retorna o recibo só se o tenant bater.
      findFirst: jest.fn().mockImplementation((args: any) => {
        if (
          args?.where?.cooperativaId &&
          args.where.cooperativaId !== reciboBase.cooperativaId
        ) {
          return Promise.resolve(null);
        }
        return Promise.resolve(reciboBase);
      }),
      updateMany: updateManyStatus,
    },
  };

  const tokenContabil = opts.tokenContabilUndefined
    ? undefined
    : {
        lancarResgatePix:
          opts.lancarResgatePixMock ??
          jest.fn().mockResolvedValue({ id: 'lanc-1' }),
      };

  const service = new CooperTokenService(
    prisma,
    { emit: jest.fn() } as any,
    undefined,
    undefined,
    undefined,
    undefined,
    undefined,
    tokenContabil as any,
  );

  return { service, prisma, tokenContabil, updateManyStatus };
}

const baseWebhook = (over: Partial<Parameters<CooperTokenService['processarWebhookResgate']>[0]> = {}) => ({
  asaasTransferId: 'asaas-tx-1',
  eventId: 'evt-1',
  sucesso: true,
  // P2 reviewer multi-tenant Sprint D2 (16/06): cooperativaIdEsperada
  // tornado OBRIGATÓRIO no caminho do webhook (anti-IDOR cross-tenant).
  cooperativaIdEsperada: COOP,
  ...over,
});

describe('D2 Bloco (c) — D-RESGATE-PIX-SEM-CAIXA contábil pós-tx', () => {
  // ───────────────────────────────────────────────────────────────────
  // 1. happy path — lancarResgatePix chamado com payload correto
  // ───────────────────────────────────────────────────────────────────
  it('webhook PAGO → tokenContabilService.lancarResgatePix invocado com payload correto', async () => {
    const { service, tokenContabil } = setupWebhook();
    const r = await service.processarWebhookResgate(baseWebhook());
    expect(r.sucesso).toBe(true);
    expect(tokenContabil!.lancarResgatePix).toHaveBeenCalledTimes(1);
    // P1 reviewer (16/06): assinatura sem `tx` — payload é o único argumento.
    const [payload] = tokenContabil!.lancarResgatePix.mock.calls[0];
    expect(payload).toMatchObject({
      cooperativaId: COOP,
      cooperadoId: EMPRESA,
      valor: 4.5,
      descricao: 'Resgate RES-2026-00001',
      referenciaId: 'recibo-1',
      referenciaTabela: 'ResgateRecibo',
    });
    expect(payload.observacoes).toContain('Recibo RES-2026-00001');
    expect(payload.observacoes).toContain('asaas-tx-1');
  });

  // ───────────────────────────────────────────────────────────────────
  // 2. tokenContabilService AUSENTE → fail-fast (Asaas re-envia)
  // ───────────────────────────────────────────────────────────────────
  it('tokenContabilService AUSENTE → throw ANTES da tx (Asaas re-envia)', async () => {
    const { service } = setupWebhook({ tokenContabilUndefined: true });
    await expect(service.processarWebhookResgate(baseWebhook())).rejects.toThrow(
      /tokenContabilService obrigatório/,
    );
  });

  // ───────────────────────────────────────────────────────────────────
  // 3. contábil falha pós-saída-de-caixa → PAGO_CREDITO_PENDENTE
  // ───────────────────────────────────────────────────────────────────
  it('contábil falha pós-saída-de-caixa → status PAGO_CREDITO_PENDENTE + motivoFalha (NÃO faz throw)', async () => {
    const lancarMock = jest
      .fn()
      .mockRejectedValue(new Error('conta 5.1.02 não encontrada (bug)'));
    const updateManyStatusFn = jest.fn().mockResolvedValue({ count: 1 });
    const { service } = setupWebhook({
      lancarResgatePixMock: lancarMock,
      updateManyStatusCalls: updateManyStatusFn,
    });
    const r = await service.processarWebhookResgate(baseWebhook());
    // Não falha — PIX já saiu, retorno mostra sucesso.
    expect(r.sucesso).toBe(true);
    expect(lancarMock).toHaveBeenCalledTimes(1);
    // updateMany do prisma (fora da tx) marcou status PAGO_CREDITO_PENDENTE.
    expect(updateManyStatusFn).toHaveBeenCalled();
    const callArgs = updateManyStatusFn.mock.calls[0][0];
    expect(callArgs.where.id).toBe('recibo-1');
    expect(callArgs.where.cooperativaId).toBe(COOP);
    expect(callArgs.where.status).toBe('PAGO_RECIBO_EMITIDO');
    expect(callArgs.data.status).toBe('PAGO_CREDITO_PENDENTE');
    expect(callArgs.data.motivoFalha).toContain('Contábil pendente');
    expect(callArgs.data.motivoFalha).toContain('5.1.02');
  });

  // ───────────────────────────────────────────────────────────────────
  // 4. CAS perde (recibo já em outro estado) → contábil NÃO chamado
  // ───────────────────────────────────────────────────────────────────
  it('CAS swap perde → contábil NÃO é chamado', async () => {
    const lancarMock = jest.fn();
    const { service } = setupWebhook({
      swapCount: 0,
      lancarResgatePixMock: lancarMock,
      reciboParaUpdate: {
        id: 'recibo-1',
        numeroRecibo: 'RES-2026-00001',
        status: 'CANCELADO', // mudou antes do webhook
        cooperativaId: COOP,
        cooperadoEstabelecimentoId: EMPRESA,
        valorBrutoTokens: 10,
        valorLiquidoTokens: 10,
        valorBrutoReais: 4.5,
        valorLiquidoReais: 4.5,
        pixChave: '+5527981341348',
        pixTipo: 'TELEFONE',
        asaasTransferId: 'asaas-tx-1',
        ultimoWebhookEventId: null,
      },
    });
    const r = await service.processarWebhookResgate(baseWebhook());
    expect((r as any).skipped).toBe('compare-and-swap-perdeu');
    expect(lancarMock).not.toHaveBeenCalled();
  });
});
