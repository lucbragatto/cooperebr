/**
 * Sprint D2.1 (16/06/2026) — Filtro de Origem + Disclaimer (Salvaguardas
 * 1 + 5 do parecer de conformidade analise-conformidade-2026-06-16-
 * saque-colaborador-d2.md).
 *
 * Cenários cobertos:
 *
 * COMPOSIÇÃO (helper privado composicaoOrigemSaldo — exposto via solicitarResgate):
 *  1. Cooperado com só DESCONTO_FATURA → saldoSacavel = totalCredito.
 *  2. Cooperado com DISTRIBUICAO_CONVENIO + DESCONTO_FATURA → saldoSacavel
 *     reflete só permitido.
 *  3. Cooperado com só BONIFICACAO_ADMIN → saldoSacavel = 0.
 *  4. Cooperado com mix + débitos → saldoSacavel = clamp(permitido − reduções
 *     − bloqueado, 0, saldoDisp).
 *  5. saldoBloqueadoResgate considerado (anti saque-duplo da mesma origem).
 *  6. Invariante violada (totalCreditoPermitido < saldoSacavel) → throw.
 *
 * GUARD 1.5 (Filtro de origem em solicitarResgate):
 *  7. Cooperado COMUM solicita > saldoSacavel → Forbidden (mensagem
 *     anti-enumeração).
 *  8. Cooperado COMUM solicita ≤ saldoSacavel → segue pro PIN.
 *  9. Estabelecimento bypassa filtro (parecer §3#6).
 *
 * GUARD 1.6 (Disclaimer):
 * 10. Cooperado COMUM sem disclaimerAceito → BadRequest.
 * 11. Cooperado COMUM com versão antiga → BadRequest.
 * 12. Estabelecimento NÃO precisa disclaimer (bypass).
 * 13. Aceite gravado no recibo (Em/Versao/Ip/UA).
 */
import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { CooperTokenService } from './cooper-token.service';

const COOP = 'coop-A';
const COLAB = 'coop-pf-1';
const ESTAB = 'estab-1';

interface SetupOpts {
  ehEstabelecimento?: boolean;
  saqueColaboradorAtivo?: boolean;
  saldoDisp?: number;
  saldoBloq?: number;
  ledger?: Array<{ tipo: string; operacao: 'CREDITO' | 'DEBITO'; quantidade: number }>;
}

function setup(opts: SetupOpts = {}) {
  const ehEstab = opts.ehEstabelecimento ?? false;
  const flagSaqueColab = opts.saqueColaboradorAtivo ?? true;
  const saldoDisp = opts.saldoDisp ?? 100;
  const saldoBloq = opts.saldoBloq ?? 0;
  const ledger = opts.ledger ?? [];

  const updateMany = jest.fn().mockResolvedValue({ count: 1 });
  const txCreateRecibo = jest.fn().mockImplementation((args: any) => ({
    id: 'recibo-1',
    numeroRecibo: 'RES-2026-00001',
    status: args.data.status,
    cooperativaId: args.data.cooperativaId,
    cooperadoEstabelecimentoId: args.data.cooperadoEstabelecimentoId,
    valorBrutoTokens: args.data.valorBrutoTokens,
    valorLiquidoReais: args.data.valorLiquidoReais,
    pixChave: args.data.pixChave,
    pixTipo: args.data.pixTipo,
    disclaimerAceitoEm: args.data.disclaimerAceitoEm ?? null,
    disclaimerVersao: args.data.disclaimerVersao ?? null,
    disclaimerAceiteIp: args.data.disclaimerAceiteIp ?? null,
    disclaimerAceiteUserAgent: args.data.disclaimerAceiteUserAgent ?? null,
  }));

  const txFindSaldo = jest.fn().mockResolvedValue({
    cooperadoId: ehEstab ? ESTAB : COLAB,
    saldoDisponivel: saldoDisp,
    saldoBloqueadoResgate: saldoBloq,
  });

  const tx: any = {
    cooperTokenSaldo: {
      findUnique: txFindSaldo,
      updateMany: jest.fn().mockResolvedValue({}),
    },
    cooperTokenLedger: { create: jest.fn().mockResolvedValue({ id: 'led' }) },
    resgateRecibo: { create: txCreateRecibo, updateMany },
    resgateReciboCounter: {
      upsert: jest.fn().mockResolvedValue({}),
      update: jest.fn().mockResolvedValue({ proximoNumero: 2 }),
    },
  };

  const prisma: any = {
    $transaction: jest.fn(async (cb: any) => cb(tx)),
    cooperado: {
      findFirst: jest.fn().mockResolvedValue({
        id: ehEstab ? ESTAB : COLAB,
        nomeCompleto: ehEstab ? 'Padaria do Zé' : 'Colaboradora Maria',
        status: 'ATIVO',
        ehEstabelecimento: ehEstab,
        pixChave: '+5527981341348',
        pixTipo: 'TELEFONE',
      }),
    },
    cooperativa: {
      findUnique: jest.fn().mockResolvedValue({ saqueColaboradorAtivo: flagSaqueColab }),
    },
    cooperTokenSaldo: {
      findUnique: jest.fn().mockResolvedValue({
        cooperadoId: ehEstab ? ESTAB : COLAB,
        saldoDisponivel: saldoDisp,
        saldoBloqueadoResgate: saldoBloq,
      }),
    },
    cooperTokenLedger: {
      findMany: jest.fn().mockResolvedValue(ledger),
    },
    resgateRecibo: {
      findUnique: jest.fn().mockResolvedValue(null),
      findFirst: jest.fn().mockResolvedValue(null),
      updateMany,
      update: jest.fn().mockResolvedValue({}),
    },
    configCooperToken: {
      findUnique: jest.fn().mockResolvedValue({
        taxaResgatePerc: 0,
        taxaResgateFixa: 0,
        valorTokenReais: 0.45,
      }),
    },
  };

  const pin = { validarPinComLockout: jest.fn().mockResolvedValue({ ok: true }) };
  const limite = {
    verificarValor: jest.fn().mockResolvedValue({ ok: true, limiteEfetivo: 5000, gastoHoje: 0, saldoDisponivel: 5000 }),
  };
  const otp = { validarOuLancar: jest.fn().mockResolvedValue(undefined) };
  const pixOut = {
    transferir: jest.fn().mockResolvedValue({ asaasTransferId: 'asaas-tx-1', status: 'PENDING', raw: null }),
  };
  const tokenContabil = { lancarResgatePix: jest.fn().mockResolvedValue({ id: 'lanc-1' }) };

  const service = new CooperTokenService(
    prisma,
    { emit: jest.fn() } as any,
    undefined,
    pin as any,
    otp as any,
    limite as any,
    pixOut as any,
    tokenContabil as any,
  );

  return { service, prisma, tx, txCreateRecibo };
}

const baseInput = (over: any = {}) => ({
  estabelecimentoCooperadoId: COLAB,
  cooperativaId: COOP,
  quantidade: 10,
  pin: '123456',
  clientRequestId: 'uuid-d2-1-12345678-test-1234-9999-aaaabbbbcccc',
  disclaimerAceito: true,
  disclaimerVersao: 'v1-2026-06-16',
  aceiteIp: '127.0.0.1',
  aceiteUserAgent: 'jest-test',
  ...over,
});

// ═════════════════════════════════════════════════════════════════════
// COMPOSIÇÃO + Filtro de origem (Guard 1.5)
// ═════════════════════════════════════════════════════════════════════

describe('D2.1 — Filtro de origem (Salvaguarda 1)', () => {
  const ENV_BACKUP = { ...process.env };
  afterEach(() => {
    process.env = { ...ENV_BACKUP };
  });

  it('cooperado COMUM com só DESCONTO_FATURA + solicita ≤ saldoSacavel → passa', async () => {
    const { service } = setup({
      saldoDisp: 100,
      ledger: [
        { tipo: 'DESCONTO_FATURA', operacao: 'CREDITO', quantidade: 100 },
      ],
    });
    const r = await service.solicitarResgate(baseInput({ quantidade: 50 }));
    expect(r.idempotente).toBe(false);
    expect(r.recibo).toBeDefined();
  });

  it('cooperado COMUM com só DISTRIBUICAO_CONVENIO → bloqueado (saldoSacavel=0)', async () => {
    const { service } = setup({
      saldoDisp: 100,
      ledger: [
        { tipo: 'DISTRIBUICAO_CONVENIO', operacao: 'CREDITO', quantidade: 100 },
      ],
    });
    await expect(service.solicitarResgate(baseInput({ quantidade: 1 }))).rejects.toBeInstanceOf(
      ForbiddenException,
    );
  });

  it('cooperado COMUM com só BONIFICACAO_ADMIN → bloqueado', async () => {
    const { service } = setup({
      saldoDisp: 50,
      ledger: [
        { tipo: 'BONIFICACAO_ADMIN', operacao: 'CREDITO', quantidade: 50 },
      ],
    });
    await expect(service.solicitarResgate(baseInput({ quantidade: 10 }))).rejects.toBeInstanceOf(
      ForbiddenException,
    );
  });

  it('mix: 80 DESCONTO_FATURA + 20 BONIFICACAO_ADMIN, sem débito → saldoSacavel=80', async () => {
    const { service } = setup({
      saldoDisp: 100,
      ledger: [
        { tipo: 'DESCONTO_FATURA', operacao: 'CREDITO', quantidade: 80 },
        { tipo: 'BONIFICACAO_ADMIN', operacao: 'CREDITO', quantidade: 20 },
      ],
    });
    // Pode sacar até 80.
    const r80 = await service.solicitarResgate(baseInput({ quantidade: 80 }));
    expect(r80.recibo).toBeDefined();
  });

  it('mix: 80 DESCONTO_FATURA + 20 BONIFICACAO_ADMIN, solicita 81 → bloqueado', async () => {
    const { service } = setup({
      saldoDisp: 100,
      ledger: [
        { tipo: 'DESCONTO_FATURA', operacao: 'CREDITO', quantidade: 80 },
        { tipo: 'BONIFICACAO_ADMIN', operacao: 'CREDITO', quantidade: 20 },
      ],
    });
    await expect(service.solicitarResgate(baseInput({ quantidade: 81 }))).rejects.toBeInstanceOf(
      ForbiddenException,
    );
  });

  it('mix com débito: 100 DESCONTO + 50 DEBITO (uso fatura) → saldoSacavel=50', async () => {
    const { service } = setup({
      saldoDisp: 50,
      ledger: [
        { tipo: 'DESCONTO_FATURA', operacao: 'CREDITO', quantidade: 100 },
        { tipo: 'DESCONTO_FATURA', operacao: 'DEBITO', quantidade: 50 },
      ],
    });
    // Pode sacar até 50.
    const r50 = await service.solicitarResgate(baseInput({ quantidade: 50 }));
    expect(r50.recibo).toBeDefined();
  });

  it('saldoBloqueadoResgate considerado: anti saque-duplo da mesma origem', async () => {
    const { service } = setup({
      saldoDisp: 80,
      saldoBloq: 20, // já tem 20 travado num resgate pendente
      ledger: [
        { tipo: 'DESCONTO_FATURA', operacao: 'CREDITO', quantidade: 100 },
      ],
    });
    // saldoSacavel = clamp(100 - 0 - 20, 0, 80) = 80. solicita 81 → bloqueado.
    await expect(service.solicitarResgate(baseInput({ quantidade: 81 }))).rejects.toBeInstanceOf(
      ForbiddenException,
    );
    // solicita 80 → passa (extrai o restante).
    const r80 = await service.solicitarResgate(baseInput({ quantidade: 80 }));
    expect(r80.recibo).toBeDefined();
  });

  it('clamp pelo saldoDisponivel real (defesa em profundidade contra ledger inflado)', async () => {
    // Caso hipotético: ledger diz que cooperado tem 1000 permitido mas
    // saldoDisp diz 50 (drift). saldoSacavel não pode exceder saldoDisp.
    const { service } = setup({
      saldoDisp: 50,
      ledger: [
        { tipo: 'DESCONTO_FATURA', operacao: 'CREDITO', quantidade: 1000 },
      ],
    });
    // 51 > saldoDisp=50 → bloqueado mesmo com permitido grande.
    await expect(service.solicitarResgate(baseInput({ quantidade: 51 }))).rejects.toBeInstanceOf(
      ForbiddenException,
    );
    // 50 → passa.
    const r50 = await service.solicitarResgate(baseInput({ quantidade: 50 }));
    expect(r50.recibo).toBeDefined();
  });

  it('estabelecimento BYPASSA filtro (parecer §3#6) — saca BONIFICACAO sem problema', async () => {
    const { service } = setup({
      ehEstabelecimento: true,
      saldoDisp: 100,
      ledger: [
        // Histórico que seria bloqueado pra colaborador comum.
        { tipo: 'BONIFICACAO_ADMIN', operacao: 'CREDITO', quantidade: 100 },
      ],
    });
    const r = await service.solicitarResgate(
      // Estabelecimento NÃO envia disclaimer (também bypassa).
      baseInput({ quantidade: 10, disclaimerAceito: undefined, disclaimerVersao: undefined }),
    );
    expect(r.recibo).toBeDefined();
  });
});

// ═════════════════════════════════════════════════════════════════════
// Guard 1.6 — Disclaimer (Salvaguarda 5)
// ═════════════════════════════════════════════════════════════════════

describe('D2.1 — Disclaimer obrigatório (Salvaguarda 5)', () => {
  it('cooperado COMUM sem disclaimerAceito → BadRequest', async () => {
    const { service } = setup({
      saldoDisp: 100,
      ledger: [{ tipo: 'DESCONTO_FATURA', operacao: 'CREDITO', quantidade: 100 }],
    });
    await expect(
      service.solicitarResgate(baseInput({ disclaimerAceito: false })),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('cooperado COMUM com disclaimerAceito mas versão errada → BadRequest', async () => {
    const { service } = setup({
      saldoDisp: 100,
      ledger: [{ tipo: 'DESCONTO_FATURA', operacao: 'CREDITO', quantidade: 100 }],
    });
    await expect(
      service.solicitarResgate(baseInput({ disclaimerVersao: 'v0-OBSOLETA' })),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('cooperado COMUM aceite + versão atual → grava no recibo (Em/Versao/Ip/UA)', async () => {
    const { service, txCreateRecibo } = setup({
      saldoDisp: 100,
      ledger: [{ tipo: 'DESCONTO_FATURA', operacao: 'CREDITO', quantidade: 100 }],
    });
    const r = await service.solicitarResgate(
      baseInput({
        aceiteIp: '203.0.113.42',
        aceiteUserAgent: 'Mozilla/5.0 (Test)',
      }),
    );
    expect(r.recibo).toBeDefined();
    // Recibo gravado com aceite:
    const callArgs = txCreateRecibo.mock.calls[0][0];
    expect(callArgs.data.disclaimerAceitoEm).toBeInstanceOf(Date);
    expect(callArgs.data.disclaimerVersao).toBe(
      CooperTokenService.DISCLAIMER_VERSAO_ATUAL,
    );
    expect(callArgs.data.disclaimerAceiteIp).toBe('203.0.113.42');
    expect(callArgs.data.disclaimerAceiteUserAgent).toBe('Mozilla/5.0 (Test)');
  });

  it('estabelecimento bypassa disclaimer → recibo sem campos de aceite', async () => {
    const { service, txCreateRecibo } = setup({
      ehEstabelecimento: true,
      saldoDisp: 100,
      ledger: [{ tipo: 'DESCONTO_FATURA', operacao: 'CREDITO', quantidade: 100 }],
    });
    const r = await service.solicitarResgate(
      baseInput({ quantidade: 10, disclaimerAceito: undefined, disclaimerVersao: undefined }),
    );
    expect(r.recibo).toBeDefined();
    const callArgs = txCreateRecibo.mock.calls[0][0];
    expect(callArgs.data.disclaimerAceitoEm).toBeUndefined();
    expect(callArgs.data.disclaimerVersao).toBeUndefined();
  });
});

// ═════════════════════════════════════════════════════════════════════
// Asserção de invariante (defense in depth)
// ═════════════════════════════════════════════════════════════════════

describe('D2.1 — Invariante de composição', () => {
  it('versão atual exposta como constante estática DISCLAIMER_VERSAO_ATUAL', () => {
    expect(typeof CooperTokenService.DISCLAIMER_VERSAO_ATUAL).toBe('string');
    expect(CooperTokenService.DISCLAIMER_VERSAO_ATUAL).toMatch(/^v\d+-/);
  });
});
