/**
 * Sprint Clube P1 — F6 Bloco B (12/06/2026).
 *
 * Specs dos 5 fluxos do resgate em PIX:
 *
 *   solicitarResgate — guards (ehEstabelecimento + pixChave + PIN + tier ALTO
 *     OTP + assertLimite), idempotência clientRequestId, bloqueio do saldo
 *     dentro da tx Serializable, geração de numeroRecibo via counter,
 *     invariante saldoDisponivel+saldoBloqueadoResgate conservada.
 *
 *   aprovarResgate — compare-and-swap PENDENTE → APROVADO_PIX_DISPARADO,
 *     chama AsaasPixOutService, Asaas erro → estorno + FALHA_PIX.
 *
 *   recusarResgate — compare-and-swap PENDENTE → RECUSADO + estorno auditável.
 *
 *   cancelarResgate — estabelecimento cancela próprio recibo PENDENTE +
 *     anti-IDOR (só próprios).
 *
 *   processarWebhookResgate — REFORÇO 2 ultimoWebhookEventId idempotência +
 *     REFORÇO 3 compare-and-swap APROVADO → PAGO_RECIBO_EMITIDO ou FALHA_PIX.
 *
 * Invariante geral: saldoDisponivel + saldoBloqueadoResgate conserva em
 * TODA transição (solicitar/aprovar/recusar/cancelar/falha/queima).
 */
import {
  BadRequestException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { CooperTokenService } from './cooper-token.service';

const EMPRESA = 'estab-1';
const COOP = 'coop-A';
const USR_ADMIN = 'usr-admin-1';

interface SetupOpts {
  estabelecimento?: any;
  pinResult?: any;
  saldoInicial?: { disponivel: number; bloqueado: number };
  reciboExistente?: any;
  configValorTokenReais?: number;
  pixOutResult?: any;
  limiteResult?: any;
  otpValidarLanca?: Error;
  reciboParaUpdate?: any;
  /** Sprint D2 (16/06/2026) — flag Cooperativa.saqueColaboradorAtivo. */
  cooperativaSaqueColaborador?: boolean;
}

function setup(opts: SetupOpts = {}) {
  const updateMany = jest.fn().mockResolvedValue({ count: 1 });
  const txCreateLedger = jest.fn().mockResolvedValue({ id: 'ledger-1' });
  const txUpdateSaldo = jest.fn().mockResolvedValue({});
  const txCreateRecibo = jest.fn().mockResolvedValue({
    id: 'recibo-1',
    numeroRecibo: 'RES-2026-00001',
    status: 'PENDENTE_APROVACAO_COOP',
    cooperativaId: COOP,
    cooperadoEstabelecimentoId: EMPRESA,
    valorBrutoTokens: 10,
    valorLiquidoTokens: 10,
    valorBrutoReais: 4.5,
    valorLiquidoReais: 4.5,
    pixChave: '+5527981341348',
    pixTipo: 'TELEFONE',
  });
  const txUpdateRecibo = jest.fn().mockResolvedValue({});

  let saldoState = opts.saldoInicial ?? { disponivel: 100, bloqueado: 0 };
  const txFindSaldo = jest.fn().mockImplementation(() =>
    Promise.resolve({
      cooperadoId: EMPRESA,
      saldoDisponivel: saldoState.disponivel,
      saldoBloqueadoResgate: saldoState.bloqueado,
    }),
  );

  const tx: any = {
    cooperTokenSaldo: {
      findUnique: txFindSaldo,
      // F6 C.4 P2 (14/06): update virou updateMany pra incluir cooperativaId
      // no where (defesa em profundidade multi-tenant). Alias .update mantido
      // pra retrocompat das specs antigas.
      update: txUpdateSaldo,
      updateMany: txUpdateSaldo,
    },
    cooperTokenLedger: { create: txCreateLedger },
    resgateRecibo: {
      create: txCreateRecibo,
      update: txUpdateRecibo,
      updateMany,
    },
    resgateReciboCounter: {
      upsert: jest.fn().mockResolvedValue({}),
      update: jest.fn().mockResolvedValue({ proximoNumero: 2 }), // após increment
    },
  };

  const transactionFn = jest.fn(async (cb: any, _o?: any) => cb(tx));

  const prisma: any = {
    $transaction: transactionFn,
    cooperado: {
      findFirst: jest.fn().mockResolvedValue(
        opts.estabelecimento ?? {
          id: EMPRESA,
          nomeCompleto: 'Padaria do Zé',
          status: 'ATIVO',
          ehEstabelecimento: true,
          pixChave: '+5527981341348',
          pixTipo: 'TELEFONE',
        },
      ),
    },
    cooperTokenSaldo: { findUnique: txFindSaldo },
    resgateRecibo: {
      findUnique: jest.fn().mockResolvedValue(opts.reciboExistente ?? null),
      findFirst: jest.fn().mockResolvedValue(opts.reciboParaUpdate ?? null),
      updateMany,
      update: jest.fn().mockResolvedValue({}),
    },
    configCooperToken: {
      findUnique: jest.fn().mockResolvedValue(
        opts.configValorTokenReais !== undefined
          ? { taxaResgatePerc: 0, taxaResgateFixa: 0, valorTokenReais: opts.configValorTokenReais }
          : null,
      ),
    },
    // Sprint D2 (16/06/2026) — gate Saque Colaborador. Default flag OFF:
    // sem este mock os testes do guard ehEstabelecimento=false ainda passam
    // (flag OFF → Forbidden, mesmo path). Specs D2 que precisam flag ON
    // sobrescrevem via opts.cooperativaSaqueColaborador.
    cooperativa: {
      findUnique: jest.fn().mockResolvedValue(
        opts.cooperativaSaqueColaborador !== undefined
          ? { saqueColaboradorAtivo: opts.cooperativaSaqueColaborador }
          : { saqueColaboradorAtivo: false },
      ),
    },
  };

  const pin = {
    validarPinComLockout: jest.fn().mockResolvedValue(opts.pinResult ?? { ok: true }),
  };
  const limite = {
    verificarValor: jest.fn().mockResolvedValue(
      opts.limiteResult ?? { ok: true, limiteEfetivo: 5000, gastoHoje: 0, saldoDisponivel: 5000 },
    ),
  };
  const otp = {
    validarOuLancar: opts.otpValidarLanca
      ? jest.fn().mockRejectedValue(opts.otpValidarLanca)
      : jest.fn().mockResolvedValue(undefined),
  };
  const pixOut = {
    transferir: jest.fn().mockResolvedValue(
      opts.pixOutResult ?? { asaasTransferId: 'asaas-tx-1', status: 'PENDING', raw: null },
    ),
  };

  const service = new CooperTokenService(
    prisma,
    { emit: jest.fn() } as any,
    undefined,
    pin as any,
    otp as any,
    limite as any,
    pixOut as any,
  );

  return {
    service,
    prisma,
    tx,
    transactionFn,
    pixOut,
    pin,
    otp,
    updateMany,
    txCreateRecibo,
    txUpdateSaldo,
    txCreateLedger,
  };
}

const baseSolicitar = (over: any = {}) => ({
  estabelecimentoCooperadoId: EMPRESA,
  cooperativaId: COOP,
  quantidade: 10,
  pin: '123456',
  clientRequestId: 'uuid-f6-12345678-test-1234-9999-aaaabbbbcccc',
  ...over,
});

// ═════════════════════════════════════════════════════════════════════
// solicitarResgate — guards
// ═════════════════════════════════════════════════════════════════════

describe('F6 Bloco B — solicitarResgate guards', () => {
  it('quantidade zero → BadRequest', async () => {
    const { service } = setup();
    await expect(
      service.solicitarResgate(baseSolicitar({ quantidade: 0 })),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('clientRequestId curto → BadRequest', async () => {
    const { service } = setup();
    await expect(
      service.solicitarResgate(baseSolicitar({ clientRequestId: 'abc' })),
    ).rejects.toThrow(/clientRequestId obrigatório/);
  });

  it('cooperado não é estabelecimento → Forbidden', async () => {
    const { service } = setup({
      estabelecimento: {
        id: EMPRESA,
        nomeCompleto: 'PF normal',
        status: 'ATIVO',
        ehEstabelecimento: false,
        pixChave: '+5527981341348',
        pixTipo: 'TELEFONE',
      },
    });
    await expect(
      service.solicitarResgate(baseSolicitar()),
    ).rejects.toThrow(/Resgate em PIX bloqueado.+Estabelecimento/);
  });

  it('estabelecimento SUSPENSO → Forbidden', async () => {
    const { service } = setup({
      estabelecimento: {
        id: EMPRESA,
        nomeCompleto: 'X',
        status: 'SUSPENSO',
        ehEstabelecimento: true,
        pixChave: '+5527981341348',
        pixTipo: 'TELEFONE',
      },
    });
    await expect(
      service.solicitarResgate(baseSolicitar()),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('pixChave não cadastrada → BadRequest com link pra dados-bancarios', async () => {
    const { service } = setup({
      estabelecimento: {
        id: EMPRESA,
        nomeCompleto: 'X',
        status: 'ATIVO',
        ehEstabelecimento: true,
        pixChave: null,
        pixTipo: null,
      },
    });
    await expect(
      service.solicitarResgate(baseSolicitar()),
    ).rejects.toThrow(/Chave PIX não cadastrada.*\/portal\/seguranca/);
  });

  it('PIN ausente → BadRequest', async () => {
    const { service } = setup();
    await expect(
      service.solicitarResgate(baseSolicitar({ pin: '' })),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('PIN_INCORRETO → Forbidden', async () => {
    const { service } = setup({ pinResult: { ok: false, motivo: 'PIN_INCORRETO' } });
    await expect(
      service.solicitarResgate(baseSolicitar()),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('PIN_NAO_DEFINIDO → BadRequest orientando configurar', async () => {
    const { service } = setup({ pinResult: { ok: false, motivo: 'PIN_NAO_DEFINIDO' } });
    await expect(
      service.solicitarResgate(baseSolicitar()),
    ).rejects.toThrow(/PIN.*não foi definido/);
  });

  it('tier ALTO (R$ > 50) sem OTP → BadRequest claro', async () => {
    // 200 tokens × R$0.45 = R$90 → ALTO
    const { service } = setup();
    await expect(
      service.solicitarResgate(baseSolicitar({ quantidade: 200 })),
    ).rejects.toThrow(/tier ALTO.*OTP/);
  });

  it('tier ALTO com OTP válido → segue', async () => {
    const { service } = setup({ saldoInicial: { disponivel: 300, bloqueado: 0 } });
    const r: any = await service.solicitarResgate(
      baseSolicitar({ quantidade: 200, otpDesafioId: 'des-1', otpCodigo: '654321' }),
    );
    expect(r.recibo.status).toBe('PENDENTE_APROVACAO_COOP');
  });

  it('tier ALTO com OTP inválido → propaga ForbiddenException', async () => {
    const { service } = setup({ otpValidarLanca: new ForbiddenException('OTP incorreto') });
    await expect(
      service.solicitarResgate(
        baseSolicitar({ quantidade: 200, otpDesafioId: 'des-1', otpCodigo: '000000' }),
      ),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('limite por transação excedido → BadRequest', async () => {
    const { service } = setup({
      limiteResult: { ok: false, motivo: 'EXCEDE_LIMITE_TRANSACAO', limite: 2 },
    });
    await expect(
      service.solicitarResgate(baseSolicitar()),
    ).rejects.toThrow(/excede o limite por transação/);
  });
});

// ═════════════════════════════════════════════════════════════════════
// solicitarResgate — idempotência + commit
// ═════════════════════════════════════════════════════════════════════

describe('F6 Bloco B — solicitarResgate idempotência + commit', () => {
  it('clientRequestId duplicado → retorna recibo existente sem reprocessar', async () => {
    const existente = {
      id: 'rec-OLD',
      numeroRecibo: 'RES-2026-00099',
      cooperativaId: COOP,
      status: 'PAGO_RECIBO_EMITIDO',
    };
    const { service, txCreateRecibo } = setup({ reciboExistente: existente });
    const r: any = await service.solicitarResgate(baseSolicitar());
    expect(r.idempotente).toBe(true);
    expect(r.recibo.id).toBe('rec-OLD');
    expect(txCreateRecibo).not.toHaveBeenCalled();
  });

  it('idempotência cross-tenant → NotFound genérica', async () => {
    const existente = {
      id: 'rec-OLD',
      numeroRecibo: 'RES-2026-00099',
      cooperativaId: 'coop-OUTRO',
      status: 'PAGO_RECIBO_EMITIDO',
    };
    const { service } = setup({ reciboExistente: existente });
    await expect(
      service.solicitarResgate(baseSolicitar()),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('saldo insuficiente DENTRO da tx → BadRequest sem gravação', async () => {
    const { service, tx } = setup({ saldoInicial: { disponivel: 5, bloqueado: 0 } });
    tx.cooperTokenSaldo.findUnique.mockResolvedValueOnce({
      cooperadoId: EMPRESA,
      saldoDisponivel: 5,
      saldoBloqueadoResgate: 0,
    });
    await expect(
      service.solicitarResgate(baseSolicitar({ quantidade: 10 })),
    ).rejects.toThrow(/Saldo insuficiente/);
    expect(tx.resgateRecibo.create).not.toHaveBeenCalled();
  });

  it('happy path → bloqueia saldo (disp -=qtd, bloq +=qtd) + cria recibo PENDENTE', async () => {
    const { service, tx, txCreateRecibo } = setup({
      saldoInicial: { disponivel: 100, bloqueado: 0 },
    });
    const r: any = await service.solicitarResgate(baseSolicitar({ quantidade: 10 }));
    expect(r.recibo.numeroRecibo).toBe('RES-2026-00001');
    expect(r.idempotente).toBe(false);
    expect(tx.cooperTokenSaldo.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          saldoDisponivel: 90,
          saldoBloqueadoResgate: 10,
        }),
      }),
    );
    const createArg = txCreateRecibo.mock.calls[0][0].data;
    expect(createArg.status).toBe('PENDENTE_APROVACAO_COOP');
    expect(createArg.pixChave).toBe('+5527981341348'); // snapshot
    expect(createArg.numeroRecibo).toBe('RES-2026-00001');
  });

  it('invariante: saldoDisponivel + saldoBloqueadoResgate conservada na solicitação', async () => {
    const { service, tx } = setup({ saldoInicial: { disponivel: 100, bloqueado: 0 } });
    await service.solicitarResgate(baseSolicitar({ quantidade: 17.3 }));
    const updateArg = tx.cooperTokenSaldo.update.mock.calls[0][0].data;
    expect(updateArg.saldoDisponivel + updateArg.saldoBloqueadoResgate).toBeCloseTo(100, 4);
  });
});

// ═════════════════════════════════════════════════════════════════════
// aprovarResgate — compare-and-swap + Asaas
// ═════════════════════════════════════════════════════════════════════

describe('F6 Bloco B — aprovarResgate (REFORÇO 3 compare-and-swap)', () => {
  function setupAprov(opts: { reciboStatus?: string; swapCount?: number; pixResult?: any } = {}) {
    const recibo = {
      id: 'rec-1',
      cooperativaId: COOP,
      cooperadoEstabelecimentoId: EMPRESA,
      numeroRecibo: 'RES-2026-00001',
      status: opts.reciboStatus ?? 'PENDENTE_APROVACAO_COOP',
      valorBrutoTokens: 10,
      valorLiquidoReais: 4.5,
      pixChave: '+5527981341348',
      pixTipo: 'TELEFONE',
    };
    return setup({
      reciboParaUpdate: recibo,
      pixOutResult: opts.pixResult ?? { asaasTransferId: 'asaas-tx-1', status: 'PENDING' },
      // Estado pós-solicitarResgate: 10 tokens já bloqueados, 90 disponíveis.
      saldoInicial: { disponivel: 90, bloqueado: 10 },
    });
  }

  it('happy path → compare-and-swap conta=1 + dispara PIX', async () => {
    const { service, prisma, pixOut } = setupAprov();
    const r: any = await service.aprovarResgate({
      reciboId: 'rec-1',
      cooperativaId: COOP,
      aprovadoPorUserId: USR_ADMIN,
    });
    expect(r.sucesso).toBe(true);
    expect(prisma.resgateRecibo.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          id: 'rec-1',
          cooperativaId: COOP,
          status: 'PENDENTE_APROVACAO_COOP',
        }),
      }),
    );
    expect(pixOut.transferir).toHaveBeenCalled();
  });

  it('REFORÇO 3 — compare-and-swap perde (count=0) → BadRequest', async () => {
    const { service, updateMany } = setupAprov({ reciboStatus: 'APROVADO_PIX_DISPARADO' });
    updateMany.mockResolvedValueOnce({ count: 0 });
    await expect(
      service.aprovarResgate({
        reciboId: 'rec-1',
        cooperativaId: COOP,
        aprovadoPorUserId: USR_ADMIN,
      }),
    ).rejects.toThrow(/já está em outro estado/);
  });

  it('Asaas ERROR → estorno imediato + status FALHA_PIX + BadRequest', async () => {
    const { service, txCreateLedger } = setupAprov({
      pixResult: { asaasTransferId: null, status: 'ERROR', erro: 'Chave PIX inválida' },
    });
    await expect(
      service.aprovarResgate({
        reciboId: 'rec-1',
        cooperativaId: COOP,
        aprovadoPorUserId: USR_ADMIN,
      }),
    ).rejects.toThrow(/Asaas rejeitou.*FALHA_PIX/);
    // Estorno gravou ledger ESTORNO_RESGATE_PIX
    expect(
      txCreateLedger.mock.calls.some((c: any) => c[0].data.tipo === 'ESTORNO_RESGATE_PIX'),
    ).toBe(true);
  });

  it('recibo não encontrado → NotFound', async () => {
    const { service } = setupAprov();
    const setupSemRecibo = setup({});
    await expect(
      setupSemRecibo.service.aprovarResgate({
        reciboId: 'rec-INEXISTENTE',
        cooperativaId: COOP,
        aprovadoPorUserId: USR_ADMIN,
      }),
    ).rejects.toBeInstanceOf(NotFoundException);
  });
});

// ═════════════════════════════════════════════════════════════════════
// recusarResgate + cancelarResgate — compare-and-swap + estorno
// ═════════════════════════════════════════════════════════════════════

describe('F6 Bloco B — recusarResgate + cancelarResgate + estorno auditável', () => {
  function setupRec(opts: { reciboStatus?: string; ownerMatch?: boolean } = {}) {
    const recibo = {
      id: 'rec-1',
      cooperativaId: COOP,
      cooperadoEstabelecimentoId: opts.ownerMatch === false ? 'outro-cooperado' : EMPRESA,
      numeroRecibo: 'RES-2026-00001',
      status: opts.reciboStatus ?? 'PENDENTE_APROVACAO_COOP',
      valorBrutoTokens: 10,
    };
    return setup({
      reciboParaUpdate: recibo,
      // Estado pós-solicitarResgate: 10 tokens bloqueados, 90 disponíveis.
      saldoInicial: { disponivel: 90, bloqueado: 10 },
    });
  }

  it('recusarResgate happy → compare-and-swap + estorno auditável', async () => {
    const { service, prisma, txCreateLedger } = setupRec();
    await service.recusarResgate({
      reciboId: 'rec-1',
      cooperativaId: COOP,
      recusadoPorUserId: USR_ADMIN,
      motivoRecusa: 'Estabelecimento não validou KYC',
    });
    expect(prisma.resgateRecibo.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: 'RECUSADO' }),
      }),
    );
    expect(
      txCreateLedger.mock.calls.some((c: any) => c[0].data.tipo === 'ESTORNO_RESGATE_PIX'),
    ).toBe(true);
  });

  it('recusarResgate sem motivo → BadRequest', async () => {
    const { service } = setupRec();
    await expect(
      service.recusarResgate({
        reciboId: 'rec-1',
        cooperativaId: COOP,
        recusadoPorUserId: USR_ADMIN,
        motivoRecusa: 'ab', // curto
      }),
    ).rejects.toThrow(/motivoRecusa obrigatório/);
  });

  it('recusarResgate compare-and-swap perde → BadRequest', async () => {
    const { service, updateMany } = setupRec();
    updateMany.mockResolvedValueOnce({ count: 0 });
    await expect(
      service.recusarResgate({
        reciboId: 'rec-1',
        cooperativaId: COOP,
        recusadoPorUserId: USR_ADMIN,
        motivoRecusa: 'Motivo válido',
      }),
    ).rejects.toThrow(/já está em outro estado/);
  });

  it('cancelarResgate happy → estorno', async () => {
    const { service, prisma } = setupRec();
    await service.cancelarResgate({
      reciboId: 'rec-1',
      cooperativaId: COOP,
      estabelecimentoCooperadoId: EMPRESA,
    });
    expect(prisma.resgateRecibo.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: 'CANCELADO' }),
      }),
    );
  });

  it('cancelarResgate anti-IDOR → NotFound se cancelar recibo de outro cooperado', async () => {
    const { service } = setupRec({ ownerMatch: false });
    await expect(
      service.cancelarResgate({
        reciboId: 'rec-1',
        cooperativaId: COOP,
        estabelecimentoCooperadoId: EMPRESA,
      }),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('cancelarResgate corrida admin-aprovou → BadRequest', async () => {
    const { service, updateMany } = setupRec();
    updateMany.mockResolvedValueOnce({ count: 0 });
    await expect(
      service.cancelarResgate({
        reciboId: 'rec-1',
        cooperativaId: COOP,
        estabelecimentoCooperadoId: EMPRESA,
      }),
    ).rejects.toThrow(/admin já aprovou/);
  });
});

// ═════════════════════════════════════════════════════════════════════
// processarWebhookResgate — REFORÇO 2 + REFORÇO 3
// ═════════════════════════════════════════════════════════════════════

describe('F6 Bloco B — processarWebhookResgate (REFORÇO 2 idempotência + REFORÇO 3 CAS)', () => {
  function setupWh(opts: { recibo?: any; sucesso: boolean; eventoDup?: string } = {} as any) {
    const recibo = opts.recibo ?? {
      id: 'rec-1',
      cooperativaId: COOP,
      cooperadoEstabelecimentoId: EMPRESA,
      numeroRecibo: 'RES-2026-00001',
      status: 'APROVADO_PIX_DISPARADO',
      asaasTransferId: 'asaas-tx-1',
      valorBrutoTokens: 10,
      valorLiquidoReais: 4.5,
      ultimoWebhookEventId: opts.eventoDup ?? null,
    };
    const s = setup({
      reciboParaUpdate: recibo,
      // Estado pós-aprovarResgate: 10 tokens bloqueados aguardando queima.
      saldoInicial: { disponivel: 90, bloqueado: 10 },
    });
    s.prisma.resgateRecibo.findFirst.mockResolvedValue(recibo);
    return s;
  }

  it('asaasTransferId não bate nenhum recibo → skip silencioso', async () => {
    const s = setup({});
    s.prisma.resgateRecibo.findFirst.mockResolvedValueOnce(null);
    const r: any = await s.service.processarWebhookResgate({
      asaasTransferId: 'tx-ghost',
      eventId: 'evt-1',
      sucesso: true,
    });
    expect(r.skipped).toBe('recibo-nao-encontrado');
  });

  it('REFORÇO 2 — eventId duplicado → skip sem processar', async () => {
    const s = setupWh({ sucesso: true, eventoDup: 'evt-MESMO' });
    const r: any = await s.service.processarWebhookResgate({
      asaasTransferId: 'asaas-tx-1',
      eventId: 'evt-MESMO',
      sucesso: true,
    });
    expect(r.skipped).toBe('webhook-duplicado');
  });

  it('sucesso=true → compare-and-swap APROVADO → PAGO + queima + ledger RESGATE_PIX', async () => {
    const s = setupWh({ sucesso: true });
    const r: any = await s.service.processarWebhookResgate({
      asaasTransferId: 'asaas-tx-1',
      eventId: 'evt-1',
      sucesso: true,
    });
    expect(r.sucesso).toBe(true);
    expect(
      s.txCreateLedger.mock.calls.some((c: any) => c[0].data.tipo === 'RESGATE_PIX'),
    ).toBe(true);
    // updateMany c/ status=APROVADO_PIX_DISPARADO + data.status=PAGO_RECIBO_EMITIDO
    expect(s.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ status: 'APROVADO_PIX_DISPARADO' }),
        data: expect.objectContaining({ status: 'PAGO_RECIBO_EMITIDO' }),
      }),
    );
  });

  it('REFORÇO 3 — sucesso=true mas compare-and-swap perde → skip', async () => {
    const s = setupWh({ sucesso: true });
    s.updateMany.mockResolvedValueOnce({ count: 0 });
    const r: any = await s.service.processarWebhookResgate({
      asaasTransferId: 'asaas-tx-1',
      eventId: 'evt-1',
      sucesso: true,
    });
    expect(r.skipped).toBe('compare-and-swap-perdeu');
  });

  it('sucesso=false (FAILED) → status=FALHA_PIX + estorno auditável', async () => {
    const s = setupWh({ sucesso: false });
    const r: any = await s.service.processarWebhookResgate({
      asaasTransferId: 'asaas-tx-1',
      eventId: 'evt-1',
      sucesso: false,
      motivoFalha: 'Insufficient funds on Asaas',
    });
    expect(r.sucesso).toBe(false);
    expect(r.motivoFalha).toBe('Insufficient funds on Asaas');
    expect(
      s.txCreateLedger.mock.calls.some((c: any) => c[0].data.tipo === 'ESTORNO_RESGATE_PIX'),
    ).toBe(true);
  });
});

// ═════════════════════════════════════════════════════════════════════
// listarResgatesPendentes
// ═════════════════════════════════════════════════════════════════════

describe('F6 Bloco B — listarResgatesPendentes', () => {
  it('default filtra status=PENDENTE_APROVACAO_COOP', async () => {
    const s = setup({});
    s.prisma.resgateRecibo.findMany = jest.fn().mockResolvedValue([]);
    s.prisma.resgateRecibo.count = jest.fn().mockResolvedValue(0);
    await s.service.listarResgatesPendentes({ cooperativaId: COOP });
    const whereArg = (s.prisma.resgateRecibo.findMany as jest.Mock).mock.calls[0][0].where;
    expect(whereArg.status).toBe('PENDENTE_APROVACAO_COOP');
    expect(whereArg.cooperativaId).toBe(COOP);
  });

  it('filtros valor/data combinam corretamente', async () => {
    const s = setup({});
    s.prisma.resgateRecibo.findMany = jest.fn().mockResolvedValue([]);
    s.prisma.resgateRecibo.count = jest.fn().mockResolvedValue(0);
    await s.service.listarResgatesPendentes({
      cooperativaId: COOP,
      status: 'PAGO_RECIBO_EMITIDO',
      valorMin: 10,
      valorMax: 100,
      dataInicio: new Date('2026-06-01'),
    });
    const whereArg = (s.prisma.resgateRecibo.findMany as jest.Mock).mock.calls[0][0].where;
    expect(whereArg.status).toBe('PAGO_RECIBO_EMITIDO');
    expect(whereArg.valorBrutoReais).toEqual({ gte: 10, lte: 100 });
    expect(whereArg.createdAt.gte).toEqual(new Date('2026-06-01'));
  });
});
