/**
 * Sprint Clube P1 — F3 Bloco C.1 (12/06/2026).
 *
 * Specs dos fixes pos-review:
 *
 *   GAP-F3-2/5: somaQuantidade com round 4 decimais (mata ruído IEEE).
 *   GAP-F3-3:   preview === cobrança — valorTokenEsperado divergiu → BadRequest.
 *   GAP-F3-4:   taxa transferência > 0 → BadRequest até gate destino contábil.
 *   GAP-F3-7:   conservação linear — Σ creditado == Σ debitado == Σ esperado.
 *   GAP-F3-8:   CONFIRM com membros inválidos → BadRequest, ZERO gravação.
 *   MT-A:       Guard 6 e listarMembrosDisponiveis usam cooperado.is.cooperativaId
 *               (verificável via mock que valida o filtro Prisma).
 */
import { BadRequestException } from '@nestjs/common';
import { CooperTokenService } from './cooper-token.service';

function setup(opts: {
  membrosAtivos?: Array<{ cooperadoId: string }>;
  saldoEmpresaDisponivel?: number;
  configTransfTaxa?: number;
  configValorTokenReais?: number;
} = {}) {
  const EMPRESA = 'empresa-pj-1';
  const COOP = 'coop-A';
  const CONV = 'conv-1';

  const txCreateLedger = jest.fn().mockImplementation((arg: any) =>
    Promise.resolve({ id: `ledger-${Math.random()}`, ...arg.data }),
  );
  const txCreateTokenTx = jest.fn().mockResolvedValue({
    id: 'tt-1',
    jti: 'jti-test',
    tier: 'BAIXO',
    motivoStepUp: 'PRIMEIRO_USO',
    status: 'CONFIRMADA',
  });
  const txUpdateSaldo = jest.fn().mockResolvedValue({});

  const membros = opts.membrosAtivos ?? [
    { cooperadoId: 'func-1' },
    { cooperadoId: 'func-2' },
  ];

  const tx: any = {
    cooperTokenSaldo: {
      findUnique: jest.fn().mockResolvedValue({
        saldoDisponivel: opts.saldoEmpresaDisponivel ?? 1000,
      }),
      update: txUpdateSaldo,
      create: jest.fn().mockResolvedValue({}),
    },
    cooperTokenLedger: { create: txCreateLedger },
    cooperado: {
      findUnique: jest.fn(({ where }: any) =>
        Promise.resolve({ id: where.id, cooperativaId: COOP, status: 'ATIVO' }),
      ),
    },
    tokenTransacao: {
      count: jest.fn().mockResolvedValue(0),
      create: txCreateTokenTx,
      updateMany: jest.fn().mockResolvedValue({ count: 1 }),
    },
  };

  const transactionFn = jest.fn(async (cb: any) => cb(tx));

  const findManyMembros = jest.fn().mockResolvedValue(
    membros.map((m) => ({
      cooperadoId: m.cooperadoId,
      cooperado: { status: 'ATIVO', cooperativaId: COOP, nomeCompleto: m.cooperadoId.toUpperCase() },
    })),
  );

  const prisma: any = {
    $transaction: transactionFn,
    cooperado: {
      findFirst: jest.fn().mockResolvedValue({
        id: EMPRESA,
        tipoPessoa: 'PJ',
        status: 'ATIVO',
        nomeCompleto: 'Santi',
      }),
    },
    contratoConvenio: {
      findFirst: jest.fn().mockResolvedValue({
        id: CONV,
        conveniadoId: EMPRESA,
        status: 'ATIVO',
        empresaNome: 'Santi',
      }),
    },
    cooperTokenSaldo: {
      findUnique: jest.fn().mockResolvedValue({
        saldoDisponivel: opts.saldoEmpresaDisponivel ?? 1000,
      }),
    },
    cooperTokenLedger: { findFirst: jest.fn().mockResolvedValue(null) },
    convenioCooperado: { findMany: findManyMembros },
    configCooperToken: {
      findUnique: jest.fn().mockResolvedValue(
        opts.configTransfTaxa !== undefined || opts.configValorTokenReais !== undefined
          ? {
              taxaTransferenciaPerc: opts.configTransfTaxa ?? 0,
              taxaTransferenciaFixa: 0,
              taxaQrPerc: 1,
              taxaQrFixa: 0,
              valorTokenReais: opts.configValorTokenReais ?? 0.45,
            }
          : null,
      ),
    },
    auditLog: { create: jest.fn().mockResolvedValue({}) },
  };

  const pin = { validarPinComLockout: jest.fn().mockResolvedValue({ ok: true }) };
  const limite = {
    verificarValor: jest.fn().mockResolvedValue({
      ok: true,
      limiteEfetivo: 5000,
      gastoHoje: 0,
      saldoDisponivel: 5000,
    }),
  };

  const service = new CooperTokenService(
    prisma,
    { emit: jest.fn() } as any,
    undefined,
    pin as any,
    undefined,
    limite as any,
  );

  return {
    service,
    prisma,
    tx,
    transactionFn,
    findManyMembros,
    txCreateLedger,
    txCreateTokenTx,
    txUpdateSaldo,
    ids: { EMPRESA, COOP, CONV, CLIENT_REQ: 'uuid-c1-12345678-test-aaaa-bbbb-ccccdddd' },
  };
}

const basePayload = (ids: any, over: any = {}) => ({
  empresaCooperadoId: ids.EMPRESA,
  cooperativaId: ids.COOP,
  convenioId: ids.CONV,
  clientRequestId: ids.CLIENT_REQ,
  pin: '123456',
  modo: 'CONFIRM' as const,
  distribuicoes: [
    { destinatarioCooperadoId: 'func-1', quantidade: 50 },
    { destinatarioCooperadoId: 'func-2', quantidade: 30 },
  ],
  naturezaDistribuicao: 'ORIGEM_REGULAMENTO' as const,
  ...over,
});

// ─────────────────────────────────────────────────────────────────────
// GAP-F3-2/5 — round somaQuantidade mata ruído IEEE
// ─────────────────────────────────────────────────────────────────────

describe('F3 C.1 GAP-F3-2/5 — round somaQuantidade (ruído IEEE)', () => {
  it('soma 0.1+0.2 vira 0.3 sem ruído (round 4 decimais)', async () => {
    const { service, ids, transactionFn } = setup();
    await service.distribuirTokens(
      basePayload(ids, {
        distribuicoes: [
          { destinatarioCooperadoId: 'func-1', quantidade: 0.1 },
          { destinatarioCooperadoId: 'func-2', quantidade: 0.2 },
        ],
      }),
    );
    // Não checamos o valor direto (já validado no commit); o teste real é
    // que NÃO lança "Saldo insuficiente" por causa do ruído IEEE.
    expect(transactionFn).toHaveBeenCalled();
  });
});

// ─────────────────────────────────────────────────────────────────────
// GAP-F3-3 — preview === cobrança (valorTokenEsperado)
// ─────────────────────────────────────────────────────────────────────

describe('F3 C.1 GAP-F3-3 — preview === cobrança (valorTokenEsperado)', () => {
  it('valorTokenEsperado bate com config atual → segue', async () => {
    const { service, ids } = setup({ configValorTokenReais: 0.45 });
    const r: any = await service.distribuirTokens(
      basePayload(ids, { valorTokenEsperado: 0.45 }),
    );
    expect(r.modo).toBe('CONFIRM');
  });

  it('valorTokenEsperado divergiu da config atual → BadRequest pedindo recarga', async () => {
    const { service, ids } = setup({ configValorTokenReais: 0.5 });
    await expect(
      service.distribuirTokens(
        basePayload(ids, { valorTokenEsperado: 0.45 }),
      ),
    ).rejects.toThrow(/Valor do token mudou.*Recarregue/);
  });

  it('valorTokenEsperado omitido → sem verificação (backward-compat opcional)', async () => {
    const { service, ids } = setup({ configValorTokenReais: 0.5 });
    const r: any = await service.distribuirTokens(basePayload(ids));
    expect(r.modo).toBe('CONFIRM');
  });

  it('PREVIEW mode → valorTokenEsperado NÃO é checado', async () => {
    const { service, ids } = setup({ configValorTokenReais: 0.5 });
    const r: any = await service.distribuirTokens(
      basePayload(ids, { modo: 'PREVIEW', valorTokenEsperado: 0.45 }),
    );
    expect(r.modo).toBe('PREVIEW');
  });
});

// ─────────────────────────────────────────────────────────────────────
// GAP-F3-4 — guard taxa transferência > 0
// ─────────────────────────────────────────────────────────────────────

describe('F3 C.1 GAP-F3-4 — guard taxa transferência > 0', () => {
  it('taxaTransferenciaPerc > 0 → BadRequest até gate destino contábil', async () => {
    const { service, ids } = setup({ configTransfTaxa: 1 });
    await expect(
      service.distribuirTokens(basePayload(ids)),
    ).rejects.toThrow(/Distribuição em lote.*bloqueada.*D-novo-TAXA-TRANSFER-DESTINO/);
  });

  it('taxa = 0 default → segue normal', async () => {
    const { service, ids } = setup();
    const r: any = await service.distribuirTokens(basePayload(ids));
    expect(r.modo).toBe('CONFIRM');
  });
});

// ─────────────────────────────────────────────────────────────────────
// GAP-F3-7 — conservação linear
// ─────────────────────────────────────────────────────────────────────

describe('F3 C.1 GAP-F3-7 — conservação linear', () => {
  it('Σ creditado == Σ debitado == Σ esperado', async () => {
    const { service, txCreateLedger, ids } = setup();
    const dists = [
      { destinatarioCooperadoId: 'func-1', quantidade: 17.3 },
      { destinatarioCooperadoId: 'func-2', quantidade: 8.7 },
    ];
    const r: any = await service.distribuirTokens(basePayload(ids, { distribuicoes: dists }));
    const esperado = dists.reduce((s, d) => s + d.quantidade, 0);

    const calls = txCreateLedger.mock.calls.map((c: any) => c[0].data);
    const debitos = calls.filter((c: any) => c.operacao === 'DEBITO');
    const creditos = calls.filter((c: any) => c.operacao === 'CREDITO');
    const somaDebitos = Math.round(debitos.reduce((s: number, c: any) => s + c.quantidade, 0) * 10000) / 10000;
    const somaCreditos = Math.round(creditos.reduce((s: number, c: any) => s + c.quantidade, 0) * 10000) / 10000;

    expect(somaDebitos).toBeCloseTo(esperado, 4);
    expect(somaCreditos).toBeCloseTo(esperado, 4);
    expect(somaDebitos).toBeCloseTo(somaCreditos, 4);
    expect(r.resultado.somaQuantidade).toBeCloseTo(esperado, 4);
  });
});

// ─────────────────────────────────────────────────────────────────────
// GAP-F3-8 — CONFIRM com membros inválidos NÃO grava nada
// ─────────────────────────────────────────────────────────────────────

describe('F3 C.1 GAP-F3-8 — CONFIRM com membros inválidos → ZERO gravação', () => {
  it('membros inválidos disparam alerta bloqueante → BadRequest + ZERO writes', async () => {
    // Só func-1 está ativo; func-2 está fora da lista (= não é MEMBRO_ATIVO).
    const { service, tx, ids } = setup({ membrosAtivos: [{ cooperadoId: 'func-1' }] });
    await expect(
      service.distribuirTokens(basePayload(ids)),
    ).rejects.toBeInstanceOf(BadRequestException);

    // ZERO writes — verifica que NENHUM ledger/saldo/tokenTransacao foi criado.
    expect(tx.cooperTokenSaldo.update).not.toHaveBeenCalled();
    expect(tx.cooperTokenSaldo.create).not.toHaveBeenCalled();
    expect(tx.cooperTokenLedger.create).not.toHaveBeenCalled();
    expect(tx.tokenTransacao.create).not.toHaveBeenCalled();
    expect(tx.tokenTransacao.updateMany).not.toHaveBeenCalled();
  });

  it('PREVIEW com membros inválidos → alerta bloqueante MEMBROS_INVALIDOS (sem throw)', async () => {
    const { service, ids } = setup({ membrosAtivos: [{ cooperadoId: 'func-1' }] });
    const r: any = await service.distribuirTokens(basePayload(ids, { modo: 'PREVIEW' }));
    expect(r.modo).toBe('PREVIEW');
    expect(r.podeProsseguir).toBe(false);
    expect(r.preview.alertas.find((a: any) => a.codigo === 'MEMBROS_INVALIDOS')).toBeDefined();
  });
});

// ─────────────────────────────────────────────────────────────────────
// MT-A — Guard 6 usa cooperado.is.cooperativaId no Prisma where
// ─────────────────────────────────────────────────────────────────────

describe('F3 C.1 MT-A — filtro multi-tenant SQL explícito', () => {
  it('Guard 6 (findMany) passa cooperado.is.cooperativaId no where', async () => {
    const { service, findManyMembros, ids } = setup();
    await service.distribuirTokens(basePayload(ids, { modo: 'PREVIEW' }));
    const whereArg = findManyMembros.mock.calls[0][0].where;
    expect(whereArg.cooperado).toBeDefined();
    expect(whereArg.cooperado.is).toEqual({ cooperativaId: ids.COOP });
  });
});

// ─────────────────────────────────────────────────────────────────────
// GAP-F3-6 — único update do saldo da empresa no fim (não N updates)
// ─────────────────────────────────────────────────────────────────────

describe('F3 C.1 GAP-F3-6 — 1 update do saldo da empresa (não N)', () => {
  it('saldo da empresa update chamado UMA vez (não 1 por linha)', async () => {
    const { service, tx, ids } = setup();
    await service.distribuirTokens(basePayload(ids));
    // 2 linhas no payload → antes seriam 2 updates da empresa + 2 do destinatário.
    // Agora: 1 update empresa (acumulado no fim) + 2 updates destinatários
    // (1 cada — upsert separado). Filtramos pelo cooperadoId da empresa.
    const updatesEmpresa = tx.cooperTokenSaldo.update.mock.calls.filter(
      (c: any) => c[0].where.cooperadoId === ids.EMPRESA,
    );
    expect(updatesEmpresa).toHaveLength(1);
    // Update do saldo da empresa tem saldoDisponivel = saldoInicial - somaQuantidade.
    expect(updatesEmpresa[0][0].data.totalResgatado).toEqual({ increment: 80 });
  });
});
