/**
 * Sprint Convênio FAMÍLIA M49 (22/06/2026) — Fatia F (gate saque familiar).
 *
 * Cobre a 3ª via do gate em `solicitarResgate`: cooperada SEM UC PAGADORA
 * numa AutorizacaoTokenFamiliar ATIVA pode resgatar PIX SE:
 *   (1) `Cooperativa.tokenFamiliarSacavel === true` (admin liga, OFF default), E
 *   (2) gate produção: !isAmbienteReal() OU SAQUE_COLABORADOR_PRODUCAO_LIBERADO='true'.
 *
 * Paridade com D2: mesmo env-prod-gate (não duplica controle); flag tenant
 * nova (`tokenFamiliarSacavel`) coexiste com `saqueColaboradorAtivo` (D2)
 * sem conflito — ambas podem estar ON simultaneamente.
 *
 * Cenários cobertos:
 *  1. cooperada-comum, flag-familiar OFF, sem D2 → Forbidden (parecer
 *     mensagem genérica anti-enumeração).
 *  2. cooperada-comum, flag-familiar ON, NÃO é pagadora ativa → Forbidden.
 *  3. cooperada-comum, flag-familiar ON, É pagadora ativa, env-prod=ON → OK.
 *  4. cooperada-comum, flag-familiar ON, É pagadora ativa, AMBIENTE_REAL=true
 *     + env-prod=false → Forbidden (gate produção bloqueia).
 *  5. Estabelecimento bypassa (não consulta a flag familiar).
 *  6. Multi-tenant: AutorizacaoTokenFamiliar.findFirst usa cooperativaId.
 */
import { ForbiddenException } from '@nestjs/common';
import { CooperTokenService } from './cooper-token.service';

const PAGADORA = 'coop-pf-pagadora';
const COOP = 'coop-A';

interface SetupOpts {
  tokenFamiliarSacavel?: boolean;
  saqueColaboradorAtivo?: boolean;
  ehEstabelecimento?: boolean;
  /** Quando true, findFirst retorna autorização ativa; quando false, null. */
  pagadoraTemAutorizacaoAtiva?: boolean;
}

function setup(opts: SetupOpts = {}) {
  const ehEstab = opts.ehEstabelecimento ?? false;
  const flagFamiliar = opts.tokenFamiliarSacavel ?? false;
  const flagColab = opts.saqueColaboradorAtivo ?? false;
  const pagadoraAtiva = opts.pagadoraTemAutorizacaoAtiva ?? false;

  const txFindSaldo = jest.fn().mockResolvedValue({
    cooperadoId: PAGADORA,
    saldoDisponivel: 100,
    saldoBloqueadoResgate: 0,
  });
  const txCreateRecibo = jest.fn().mockResolvedValue({
    id: 'recibo-1',
    numeroRecibo: 'RES-2026-00001',
    status: 'PENDENTE_APROVACAO_COOP',
    cooperativaId: COOP,
    cooperadoEstabelecimentoId: PAGADORA,
    valorBrutoTokens: 10,
    valorLiquidoTokens: 10,
    valorBrutoReais: 4.5,
    valorLiquidoReais: 4.5,
    pixChave: '+5527981341348',
    pixTipo: 'TELEFONE',
  });

  const tx: any = {
    cooperTokenSaldo: {
      findUnique: txFindSaldo,
      update: jest.fn().mockResolvedValue({}),
      updateMany: jest.fn().mockResolvedValue({ count: 1 }),
    },
    cooperTokenLedger: { create: jest.fn().mockResolvedValue({ id: 'ledger-1' }) },
    resgateRecibo: {
      create: txCreateRecibo,
      update: jest.fn().mockResolvedValue({}),
      updateMany: jest.fn().mockResolvedValue({ count: 1 }),
    },
    resgateReciboCounter: {
      upsert: jest.fn().mockResolvedValue({}),
      update: jest.fn().mockResolvedValue({ proximoNumero: 2 }),
    },
    disclaimerSaque: {
      findUnique: jest.fn().mockResolvedValue({
        id: 'disclaimer-ativo-1',
        versao: 'v1-2026-06-17',
        ativo: true,
        cooperativaId: null,
      }),
    },
  };

  const autorizacaoFindFirst = jest
    .fn()
    .mockResolvedValue(pagadoraAtiva ? { id: 'aut-1' } : null);

  const prisma: any = {
    $transaction: jest.fn(async (cb: any) => cb(tx)),
    cooperado: {
      findFirst: jest.fn().mockResolvedValue({
        id: PAGADORA,
        nomeCompleto: 'Maria Silva (pagadora)',
        status: 'ATIVO',
        ehEstabelecimento: ehEstab,
        pixChave: '+5527981341348',
        pixTipo: 'TELEFONE',
      }),
    },
    cooperativa: {
      findUnique: jest.fn().mockResolvedValue({
        saqueColaboradorAtivo: flagColab,
        tokenFamiliarSacavel: flagFamiliar,
      }),
    },
    autorizacaoTokenFamiliar: {
      findFirst: autorizacaoFindFirst,
    },
    cooperTokenSaldo: { findUnique: txFindSaldo },
    cooperTokenLedger: {
      findMany: jest
        .fn()
        .mockResolvedValue([
          { tipo: 'DESCONTO_FATURA', operacao: 'CREDITO', quantidade: 100 },
        ]),
    },
    resgateRecibo: {
      findUnique: jest.fn().mockResolvedValue(null),
      findFirst: jest.fn().mockResolvedValue(null),
      updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      update: jest.fn().mockResolvedValue({}),
    },
    configCooperToken: { findUnique: jest.fn().mockResolvedValue(null) },
  };

  const pin = { validarPinComLockout: jest.fn().mockResolvedValue({ ok: true }) };
  const limite = {
    verificarValor: jest
      .fn()
      .mockResolvedValue({ ok: true, limiteEfetivo: 5000, gastoHoje: 0, saldoDisponivel: 5000 }),
  };
  const otp = { validarOuLancar: jest.fn().mockResolvedValue(undefined) };
  const pixOut = {
    transferir: jest
      .fn()
      .mockResolvedValue({ asaasTransferId: 'asaas-tx-1', status: 'PENDING', raw: null }),
  };
  const tokenContabil = {
    lancarResgatePix: jest.fn().mockResolvedValue({ id: 'lanc-1' }),
  };
  const disclaimerSaque = {
    getAtivo: jest.fn().mockResolvedValue({
      id: 'disclaimer-ativo-1',
      versao: 'v1-2026-06-17',
      texto: 'texto disclaimer v1',
      cooperativaId: null,
      ativo: true,
    }),
  };

  const service = new CooperTokenService(
    prisma,
    { emit: jest.fn() } as any,
    undefined,
    pin as any,
    otp as any,
    limite as any,
    pixOut as any,
    tokenContabil as any,
    disclaimerSaque as any,
  );

  return { service, prisma, autorizacaoFindFirst };
}

const baseInput = {
  estabelecimentoCooperadoId: PAGADORA,
  cooperativaId: COOP,
  quantidade: 10,
  pin: '123456',
  clientRequestId: 'uuid-m49-12345678-test-1234-9999-aaaabbbbcccc',
  disclaimerAceito: true,
  disclaimerSaqueId: 'disclaimer-ativo-1',
};

describe('M49 Fatia F — Gate saque familiar (cooperada SEM UC pagadora)', () => {
  const ENV_BACKUP = { ...process.env };
  afterEach(() => {
    process.env = { ...ENV_BACKUP };
  });

  it('flag-familiar OFF + sem D2 → Forbidden (gate fechado)', async () => {
    process.env.SAQUE_COLABORADOR_PRODUCAO_LIBERADO = 'true';
    const { service } = setup({
      ehEstabelecimento: false,
      tokenFamiliarSacavel: false,
      saqueColaboradorAtivo: false,
    });
    await expect(service.solicitarResgate(baseInput)).rejects.toBeInstanceOf(
      ForbiddenException,
    );
  });

  it('flag-familiar ON + NÃO é pagadora ativa → Forbidden', async () => {
    process.env.SAQUE_COLABORADOR_PRODUCAO_LIBERADO = 'true';
    const { service, autorizacaoFindFirst } = setup({
      ehEstabelecimento: false,
      tokenFamiliarSacavel: true,
      pagadoraTemAutorizacaoAtiva: false,
    });
    await expect(service.solicitarResgate(baseInput)).rejects.toBeInstanceOf(
      ForbiddenException,
    );
    expect(autorizacaoFindFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          cooperadoPagadorId: PAGADORA,
          cooperativaId: COOP,
          ativo: true,
        }),
      }),
    );
  });

  it('flag-familiar ON + É pagadora ativa + ambiente NÃO-real → OK', async () => {
    delete process.env.AMBIENTE_REAL;
    process.env.SAQUE_COLABORADOR_PRODUCAO_LIBERADO = 'false';
    const { service } = setup({
      ehEstabelecimento: false,
      tokenFamiliarSacavel: true,
      pagadoraTemAutorizacaoAtiva: true,
    });
    const r = await service.solicitarResgate(baseInput);
    expect(r.recibo).toBeDefined();
  });

  it('flag-familiar ON + pagadora ativa + AMBIENTE_REAL=true + env-prod=false → Forbidden', async () => {
    process.env.AMBIENTE_REAL = 'true';
    process.env.SAQUE_COLABORADOR_PRODUCAO_LIBERADO = 'false';
    const { service } = setup({
      ehEstabelecimento: false,
      tokenFamiliarSacavel: true,
      pagadoraTemAutorizacaoAtiva: true,
    });
    await expect(service.solicitarResgate(baseInput)).rejects.toBeInstanceOf(
      ForbiddenException,
    );
  });

  it('estabelecimento bypassa flag familiar (não chama findFirst da autorização)', async () => {
    const { service, autorizacaoFindFirst } = setup({
      ehEstabelecimento: true,
      tokenFamiliarSacavel: false,
    });
    const r = await service.solicitarResgate(baseInput);
    expect(r.recibo).toBeDefined();
    expect(autorizacaoFindFirst).not.toHaveBeenCalled();
  });

  it('multi-tenant: findFirst da autorização SEMPRE filtra cooperativaId', async () => {
    process.env.SAQUE_COLABORADOR_PRODUCAO_LIBERADO = 'true';
    const { service, autorizacaoFindFirst } = setup({
      ehEstabelecimento: false,
      tokenFamiliarSacavel: true,
      pagadoraTemAutorizacaoAtiva: true,
    });
    await service.solicitarResgate(baseInput);
    expect(autorizacaoFindFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          cooperativaId: COOP,
          ativo: true,
        }),
      }),
    );
  });

  it('flag-familiar OFF + flag-colab ON + cooperado-comum + env-prod=true → OK pelo gate D2', async () => {
    process.env.SAQUE_COLABORADOR_PRODUCAO_LIBERADO = 'true';
    const { service } = setup({
      ehEstabelecimento: false,
      tokenFamiliarSacavel: false,
      saqueColaboradorAtivo: true,
    });
    const r = await service.solicitarResgate(baseInput);
    expect(r.recibo).toBeDefined();
  });
});
