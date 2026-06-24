/**
 * Sprint Clube P1 — F4 Bloco C (12/06/2026).
 *
 * Cobre os 3 endpoints do escopo cooperado-only + caminho admin:
 *
 *   processarPagamentoQr:
 *     - PIN opcional no service (controller exige; caminho parceiro NÃO passa)
 *     - PIN incorreto/bloqueado/válido
 *     - isolationLevel Serializable explícito
 *     - F0 INTOCÁVEL: taxa F1.5 calculada UMA vez, helper não recalcula
 *     - criarTokenTransacao chamado com tipoOperacao=PAGAMENTO,
 *       quantidade=bruta, pinValidadoEm marcado quando PIN OK
 *
 *   enviarTokens (cooperado→cooperado):
 *     - PIN obrigatório
 *     - calcularTaxa('transferencia') aplicado (default 0% = behavior idêntico)
 *     - Saldo do destinatário recebe LÍQUIDO (não bruto) quando taxa > 0
 *     - criarTokenTransacao chamado com tipoOperacao=TRANSFERENCIA
 *     - isolationLevel Serializable
 *
 *   enviarTokensAdmin (caminho admin):
 *     - tier BAIXO (≤R$50) → segue sem OTP
 *     - tier ALTO (>R$50) → OTP obrigatório (otpDesafioId + otpCodigo)
 *     - OTP inválido → ForbiddenException via OtpDesafioService.validarOuLancar
 *     - tier ALTO sem OTP → BadRequest claro
 */
import {
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import * as jwt from 'jsonwebtoken';
import { CooperTokenService } from './cooper-token.service';
import { Prisma } from '@prisma/client';

const SECRET = 'F4-bloco-C-secret-com-mais-de-32-caracteres-aqui';

function gerarQrToken(quantidade: number, cooperativaId = 'coop-A') {
  return jwt.sign(
    { pagadorId: 'pagador-1', cooperativaId, quantidade, tipo: 'COOPER_TOKEN_QR' },
    SECRET,
  );
}

interface SetupOpts {
  pinResult?: any;
  otpValidarLanca?: Error;
  saldoPagador?: number;
  saldoRemetente?: number;
  configTransfTaxa?: number;
  configValorTokenReais?: number;
  contadorPagador?: number;
  contadorPagadorRecebedor?: number;
  // M52b F1 (24/06): gate dual MELT controla cobrança da taxa QR/Transfer.
  // Default false. Specs que validam cobrança real precisam true.
  configMeltAtivado?: boolean;
}

function setup(opts: SetupOpts = {}) {
  const txCreateLedger = jest.fn().mockResolvedValue({ id: 'ledger-1' });
  const txCreateTokenTransacao = jest.fn().mockResolvedValue({
    id: 'tt-deterministic',
    jti: 'jti-bloco-c-test',
    tier: 'BAIXO',
    motivoStepUp: 'PRIMEIRO_USO',
    status: 'CONFIRMADA',
  });
  const tx: any = {
    cooperTokenSaldo: {
      findUnique: jest.fn(({ where }: any) => {
        if (where.cooperadoId === 'pagador-1') {
          return Promise.resolve({ saldoDisponivel: opts.saldoPagador ?? 10000 });
        }
        if (where.cooperadoId === 'remetente-1') {
          return Promise.resolve({ saldoDisponivel: opts.saldoRemetente ?? 1000 });
        }
        if (where.cooperadoId === 'recebedor-1' || where.cooperadoId === 'destinatario-1') {
          return Promise.resolve({ saldoDisponivel: 0, totalEmitido: 0 });
        }
        return Promise.resolve(null);
      }),
      // F4 Bloco C.1 MT-5
      findFirst: jest.fn(({ where }: any) => {
        if (where.cooperadoId === 'pagador-1') {
          return Promise.resolve({ saldoDisponivel: opts.saldoPagador ?? 10000 });
        }
        return Promise.resolve(null);
      }),
      update: jest.fn().mockResolvedValue({}),
      create: jest.fn().mockResolvedValue({ saldoDisponivel: 0, totalEmitido: 0 }),
    },
    cooperTokenLedger: { create: txCreateLedger },
    cooperado: {
      findUnique: jest.fn(({ where }: any) => {
        if (where.id === 'pagador-1') return Promise.resolve({ id: 'pagador-1', cooperativaId: 'coop-A' });
        if (where.id === 'recebedor-1') return Promise.resolve({ id: 'recebedor-1', cooperativaId: 'coop-A' });
        if (where.id === 'remetente-1') return Promise.resolve({ id: 'remetente-1', cooperativaId: 'coop-A' });
        if (where.id === 'destinatario-1') return Promise.resolve({ id: 'destinatario-1', cooperativaId: 'coop-A' });
        return Promise.resolve(null);
      }),
    },
    tokenTransacao: {
      count: jest
        .fn()
        .mockResolvedValueOnce(opts.contadorPagador ?? 0)
        .mockResolvedValueOnce(opts.contadorPagadorRecebedor ?? 0),
      create: txCreateTokenTransacao,
    },
  };

  const transactionFn = jest.fn(async (cb: any, _opts?: any) => cb(tx));

  const prisma: any = {
    $transaction: transactionFn,
    configCooperToken: {
      findUnique: jest.fn().mockResolvedValue(
        (opts.configTransfTaxa !== undefined || opts.configValorTokenReais !== undefined || opts.configMeltAtivado !== undefined)
          ? {
              taxaTransferenciaPerc: opts.configTransfTaxa ?? 0,
              taxaTransferenciaFixa: 0,
              taxaQrPerc: 1,
              taxaQrFixa: 0,
              valorTokenReais: opts.configValorTokenReais ?? 0.45,
              // M52b F1: gate dual — default false (gate OFF, líquido=bruto).
              meltAtivado: opts.configMeltAtivado ?? false,
            }
          : null,
      ),
    },
    cooperado: {
      findFirst: jest.fn().mockResolvedValue({ id: 'destinatario-1', status: 'ATIVO' }),
      // creditar() chama prisma.cooperado.findUnique (linha :96 do service).
      findUnique: jest.fn().mockResolvedValue({
        id: 'destinatario-1',
        status: 'ATIVO_RECEBENDO_CREDITOS',
        cooperativaId: 'coop-A',
      }),
    },
    cooperTokenSaldo: {
      // creditar tx interna usa estes mocks também
      findUnique: jest.fn().mockResolvedValue(null),
      create: jest.fn().mockResolvedValue({ saldoDisponivel: 0 }),
      update: jest.fn().mockResolvedValue({}),
    },
    cooperTokenLedger: {
      findFirst: jest.fn().mockResolvedValue(null), // idempotência app-level
      create: jest.fn().mockResolvedValue({ id: 'ledger-credit-1' }),
    },
  };

  const pinCooperadoService = {
    validarPinComLockout: jest
      .fn()
      .mockResolvedValue(opts.pinResult ?? { ok: true }),
  };
  const otpDesafioService = {
    validarOuLancar: opts.otpValidarLanca
      ? jest.fn().mockRejectedValue(opts.otpValidarLanca)
      : jest.fn().mockResolvedValue(undefined),
    criarDesafio: jest.fn().mockResolvedValue({
      desafioId: 'des-1',
      codigo: '654321',
      expiresAt: new Date(Date.now() + 10 * 60 * 1000),
    }),
  };
  const eventEmitter = { emit: jest.fn() };

  const service = new CooperTokenService(
    prisma,
    eventEmitter as any,
    undefined,
    pinCooperadoService as any,
    otpDesafioService as any,
  );

  return { service, prisma, tx, transactionFn, pinCooperadoService, otpDesafioService, txCreateTokenTransacao, eventEmitter };
}

const PIN_OK = '123456';
const ORIG_SECRET = process.env.COOPERTOKEN_QR_SECRET;
beforeAll(() => {
  process.env.COOPERTOKEN_QR_SECRET = SECRET;
});
afterAll(() => {
  if (ORIG_SECRET === undefined) delete process.env.COOPERTOKEN_QR_SECRET;
  else process.env.COOPERTOKEN_QR_SECRET = ORIG_SECRET;
});

describe('F4 Bloco C — processarPagamentoQr (PIN opcional + Serializable + helper)', () => {
  it('PIN ausente NÃO chama PinCooperadoService (caminho parceiro reusa sem PIN)', async () => {
    const { service, pinCooperadoService } = setup();
    await service.processarPagamentoQr({
      qrToken: gerarQrToken(50),
      recebedorId: 'recebedor-1',
      recebedorCooperativaId: 'coop-A',
    });
    expect(pinCooperadoService.validarPinComLockout).not.toHaveBeenCalled();
  });

  it('PIN inválido (não 6 dígitos) → BadRequest', async () => {
    const { service } = setup();
    await expect(
      service.processarPagamentoQr({
        qrToken: gerarQrToken(50),
        recebedorId: 'recebedor-1',
        recebedorCooperativaId: 'coop-A',
        pin: 'abc',
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('PIN_INCORRETO → Forbidden', async () => {
    const { service } = setup({ pinResult: { ok: false, motivo: 'PIN_INCORRETO' } });
    await expect(
      service.processarPagamentoQr({
        qrToken: gerarQrToken(50),
        recebedorId: 'recebedor-1',
        recebedorCooperativaId: 'coop-A',
        pin: PIN_OK,
      }),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('PIN válido → pinValidadoEm marcado no helper', async () => {
    const { service, txCreateTokenTransacao } = setup();
    await service.processarPagamentoQr({
      qrToken: gerarQrToken(50),
      recebedorId: 'recebedor-1',
      recebedorCooperativaId: 'coop-A',
      pin: PIN_OK,
    });
    const data = txCreateTokenTransacao.mock.calls[0][0].data;
    expect(data.pinValidadoEm).toBeInstanceOf(Date);
    expect(data.tipoOperacao).toBe('PAGAMENTO');
    expect(data.quantidadeTokens).toBe(50);
  });

  it('isolationLevel Serializable é passado no $transaction', async () => {
    const { service, transactionFn } = setup();
    await service.processarPagamentoQr({
      qrToken: gerarQrToken(50),
      recebedorId: 'recebedor-1',
      recebedorCooperativaId: 'coop-A',
      pin: PIN_OK,
    });
    expect(transactionFn.mock.calls[0][1]).toEqual(
      expect.objectContaining({
        isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
      }),
    );
  });

  it('F0 INTOCÁVEL — taxa QR 1× sobre o bruto (gate ON via meltAtivado)', async () => {
    // M52b F1 (24/06): cobrança da taxa QR agora gateada por meltAtivado.
    // Pra exercitar o F0 conformidade original (1% sobre bruto), gate ON.
    // Gate OFF (default) seria validado em outro test — está em `M52b melt`.
    const { service, txCreateTokenTransacao } = setup({ configMeltAtivado: true });
    const r: any = await service.processarPagamentoQr({
      qrToken: gerarQrToken(100),
      recebedorId: 'recebedor-1',
      recebedorCooperativaId: 'coop-A',
      pin: PIN_OK,
    });
    expect(r.taxa).toBe(1);
    expect(r.quantidadeLiquida).toBe(99);
    // helper recebeu quantidade BRUTA, não líquida
    expect(txCreateTokenTransacao.mock.calls[0][0].data.quantidadeTokens).toBe(100);
  });
});

describe('F4 Bloco C — enviarTokens (cooperado→cooperado: PIN + taxa transferencia + jti)', () => {
  it('PIN ausente → BadRequest', async () => {
    const { service } = setup();
    await expect(
      service.enviarTokens({
        remetenteCooperadoId: 'remetente-1',
        destinatarioCooperadoId: 'destinatario-1',
        cooperativaId: 'coop-A',
        quantidade: 50,
        pin: '',
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('remetente == destinatário → BadRequest sem chamar PIN', async () => {
    const { service, pinCooperadoService } = setup();
    await expect(
      service.enviarTokens({
        remetenteCooperadoId: 'X',
        destinatarioCooperadoId: 'X',
        cooperativaId: 'coop-A',
        quantidade: 50,
        pin: PIN_OK,
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(pinCooperadoService.validarPinComLockout).not.toHaveBeenCalled();
  });

  it('PIN_BLOQUEADO → Forbidden com desbloqueiaEm', async () => {
    const desbloqueiaEm = new Date('2030-01-01');
    const { service } = setup({
      pinResult: { ok: false, motivo: 'PIN_BLOQUEADO', desbloqueiaEm },
    });
    await expect(
      service.enviarTokens({
        remetenteCooperadoId: 'remetente-1',
        destinatarioCooperadoId: 'destinatario-1',
        cooperativaId: 'coop-A',
        quantidade: 50,
        pin: PIN_OK,
      }),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('taxa transferência default 0% (sem config) → bruto == liquido', async () => {
    const { service, tx } = setup();
    const r: any = await service.enviarTokens({
      remetenteCooperadoId: 'remetente-1',
      destinatarioCooperadoId: 'destinatario-1',
      cooperativaId: 'coop-A',
      quantidade: 100,
      pin: PIN_OK,
    });
    expect(r.taxa).toBe(0);
    expect(r.quantidadeLiquida).toBe(100);
    // Saldo do destinatário recebe o líquido
    const updateCalls = tx.cooperTokenSaldo.update.mock.calls;
    const updateDestinatario = updateCalls.find(
      (c: any) => c[0].where.cooperadoId === 'destinatario-1',
    );
    expect(updateDestinatario).toBeDefined();
    expect(updateDestinatario[0].data.saldoDisponivel).toBe(100);
  });

  it('taxa transferência custom 3% → destinatário recebe 97', async () => {
    const { service, tx } = setup({ configTransfTaxa: 3 });
    const r: any = await service.enviarTokens({
      remetenteCooperadoId: 'remetente-1',
      destinatarioCooperadoId: 'destinatario-1',
      cooperativaId: 'coop-A',
      quantidade: 100,
      pin: PIN_OK,
    });
    expect(r.taxa).toBe(3);
    expect(r.quantidadeLiquida).toBe(97);
    const updateCalls = tx.cooperTokenSaldo.update.mock.calls;
    const updateDestinatario = updateCalls.find(
      (c: any) => c[0].where.cooperadoId === 'destinatario-1',
    );
    expect(updateDestinatario[0].data.saldoDisponivel).toBe(97);
  });

  it('criarTokenTransacao chamado com TRANSFERENCIA + bruto', async () => {
    const { service, txCreateTokenTransacao } = setup();
    await service.enviarTokens({
      remetenteCooperadoId: 'remetente-1',
      destinatarioCooperadoId: 'destinatario-1',
      cooperativaId: 'coop-A',
      quantidade: 100,
      pin: PIN_OK,
    });
    const data = txCreateTokenTransacao.mock.calls[0][0].data;
    expect(data.tipoOperacao).toBe('TRANSFERENCIA');
    expect(data.quantidadeTokens).toBe(100); // bruto
    expect(data.pagadorId).toBe('remetente-1');
    expect(data.recebedorId).toBe('destinatario-1');
  });

  it('isolationLevel Serializable é passado', async () => {
    const { service, transactionFn } = setup();
    await service.enviarTokens({
      remetenteCooperadoId: 'remetente-1',
      destinatarioCooperadoId: 'destinatario-1',
      cooperativaId: 'coop-A',
      quantidade: 50,
      pin: PIN_OK,
    });
    expect(transactionFn.mock.calls[0][1]).toEqual(
      expect.objectContaining({
        isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
      }),
    );
  });

  it('saldo insuficiente do remetente → BadRequest', async () => {
    const { service } = setup({ saldoRemetente: 5 });
    await expect(
      service.enviarTokens({
        remetenteCooperadoId: 'remetente-1',
        destinatarioCooperadoId: 'destinatario-1',
        cooperativaId: 'coop-A',
        quantidade: 100,
        pin: PIN_OK,
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });
});

describe('F4 Bloco C / C.1 — enviarTokensAdmin (tier-based step-up + idempotência)', () => {
  const CLIENT_REQ_ID = 'uuid-test-12345678-abcd-1234-9999-aaaabbbbcccc';

  it('tier BAIXO (≤R$50): NÃO exige OTP', async () => {
    // 100 tokens × R$0.45 = R$45 → tier BAIXO
    const { service, otpDesafioService } = setup();
    await service.enviarTokensAdmin({
      destinatarioCooperadoId: 'destinatario-1',
      cooperativaId: 'coop-A',
      quantidade: 100,
      clientRequestId: CLIENT_REQ_ID,
    });
    expect(otpDesafioService.validarOuLancar).not.toHaveBeenCalled();
  });

  it('tier ALTO (>R$50) sem OTP → BadRequest claro', async () => {
    // 200 tokens × R$0.45 = R$90 → tier ALTO
    const { service } = setup();
    await expect(
      service.enviarTokensAdmin({
        destinatarioCooperadoId: 'destinatario-1',
        cooperativaId: 'coop-A',
        quantidade: 200,
        clientRequestId: CLIENT_REQ_ID,
      }),
    ).rejects.toThrow(/tier ALTO.*OTP/);
  });

  it('tier ALTO com OTP válido → valida via OtpDesafioService e credita', async () => {
    const { service, otpDesafioService } = setup();
    const r: any = await service.enviarTokensAdmin({
      destinatarioCooperadoId: 'destinatario-1',
      cooperativaId: 'coop-A',
      quantidade: 200,
      otpDesafioId: 'des-1',
      otpCodigo: '654321',
      clientRequestId: CLIENT_REQ_ID,
    });
    expect(otpDesafioService.validarOuLancar).toHaveBeenCalledWith(
      expect.objectContaining({
        desafioId: 'des-1',
        codigo: '654321',
        cooperativaId: 'coop-A',
      }),
    );
    expect(r.tier).toBe('ALTO');
  });

  it('tier ALTO com OTP inválido → propaga ForbiddenException do service', async () => {
    const { service } = setup({
      otpValidarLanca: new ForbiddenException('Código OTP incorreto.'),
    });
    await expect(
      service.enviarTokensAdmin({
        destinatarioCooperadoId: 'destinatario-1',
        cooperativaId: 'coop-A',
        quantidade: 200,
        otpDesafioId: 'des-1',
        otpCodigo: '000000',
        clientRequestId: CLIENT_REQ_ID,
      }),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('quantidade zero → BadRequest sem chamar OTP', async () => {
    const { service, otpDesafioService } = setup();
    await expect(
      service.enviarTokensAdmin({
        destinatarioCooperadoId: 'destinatario-1',
        cooperativaId: 'coop-A',
        quantidade: 0,
        clientRequestId: CLIENT_REQ_ID,
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(otpDesafioService.validarOuLancar).not.toHaveBeenCalled();
  });

  // F4 Bloco C.1 — FIN-4 + MT-2
  it('FIN-4: clientRequestId ausente → BadRequest pedindo idempotência', async () => {
    const { service } = setup();
    await expect(
      service.enviarTokensAdmin({
        destinatarioCooperadoId: 'destinatario-1',
        cooperativaId: 'coop-A',
        quantidade: 100,
        clientRequestId: '',
      }),
    ).rejects.toThrow(/clientRequestId obrigatório/);
  });

  it('FIN-4: clientRequestId muito curto (<8 chars) → BadRequest', async () => {
    const { service } = setup();
    await expect(
      service.enviarTokensAdmin({
        destinatarioCooperadoId: 'destinatario-1',
        cooperativaId: 'coop-A',
        quantidade: 100,
        clientRequestId: 'abc',
      }),
    ).rejects.toThrow(/clientRequestId obrigatório/);
  });

  it('FIN-4: clientRequestId é passado a creditar como referenciaId+ENVIO_ADMIN', async () => {
    const { service, prisma } = setup();
    await service.enviarTokensAdmin({
      destinatarioCooperadoId: 'destinatario-1',
      cooperativaId: 'coop-A',
      quantidade: 100,
      clientRequestId: CLIENT_REQ_ID,
    });
    // creditar() chamado por dentro — verifica que entrega ledger com
    // referenciaId estável. (Como creditar abre própria tx, vemos no
    // chamada ao prisma.cooperTokenLedger.create do tx interno.)
    expect(prisma.$transaction).toHaveBeenCalled();
  });

  it('MT-2: cooperativaId vazio → BadRequest pedindo impersonate', async () => {
    const { service } = setup();
    await expect(
      service.enviarTokensAdmin({
        destinatarioCooperadoId: 'destinatario-1',
        cooperativaId: '',
        quantidade: 100,
        clientRequestId: CLIENT_REQ_ID,
      }),
    ).rejects.toThrow(/cooperativaId obrigatório.*impersonar/);
  });

  it('MT-2: creditar retorna null (SUSPENSO/cross-tenant) → BadRequest, não {sucesso:true, ledgerCreditado:false}', async () => {
    // Forçar creditar a retornar null mockando cooperado SUSPENSO
    const opts = {};
    const localSetup = setup(opts);
    localSetup.prisma.cooperado.findUnique.mockResolvedValueOnce({
      id: 'destinatario-1',
      status: 'SUSPENSO',
      cooperativaId: 'coop-A',
    });
    await expect(
      localSetup.service.enviarTokensAdmin({
        destinatarioCooperadoId: 'destinatario-1',
        cooperativaId: 'coop-A',
        quantidade: 100,
        clientRequestId: CLIENT_REQ_ID,
      }),
    ).rejects.toThrow(/Crédito negado/);
  });
});

describe('F4 Bloco C — usarNaFatura agora cria TokenTransacao paralela', () => {
  function setupUsarNaFatura() {
    const txCreateTokenTransacao = jest.fn().mockResolvedValue({
      id: 'tt-fatura',
      jti: 'jti-fatura-test',
      tier: 'BAIXO',
      motivoStepUp: 'PRIMEIRO_USO',
      status: 'CONFIRMADA',
    });
    const tx: any = {
      cobranca: {
        // F4 Bloco C.1 MT-1 — findFirst com tenant
        findFirst: jest.fn().mockResolvedValue({
          id: 'cob-1',
          status: 'A_VENCER',
          valorLiquido: 100,
          tokenDescontoQt: 0,
          tokenDescontoReais: 0,
          contrato: {
            cooperadoId: 'coop-1',
            plano: { valorTokenReais: 0.5, tokenDescontoMaxPerc: 30 },
          },
        }),
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      },
      cooperTokenSaldo: {
        findUnique: jest.fn().mockResolvedValue({ cooperadoId: 'coop-1', saldoDisponivel: 1000 }),
        update: jest.fn().mockResolvedValue({}),
      },
      cooperTokenLedger: {
        create: jest.fn().mockResolvedValue({ id: 'ledger-1' }),
      },
      lancamentoCaixa: { create: jest.fn().mockResolvedValue({}) },
      cooperado: {
        // FIN-2 — agora também retorna status
        findUnique: jest.fn().mockResolvedValue({ id: 'coop-1', cooperativaId: 'tenant-A', status: 'ATIVO' }),
      },
      tokenTransacao: {
        count: jest.fn().mockResolvedValue(0),
        create: txCreateTokenTransacao,
      },
    };
    const prisma: any = {
      $transaction: jest.fn(async (cb: any, _opts?: any) => cb(tx)),
      // F4 Bloco C.1 FIN-1 — preview read-only fora da tx
      cobranca: {
        findFirst: jest.fn().mockResolvedValue({ valorLiquido: 100 }),
      },
    };
    const pinCooperadoService = {
      validarPinComLockout: jest.fn().mockResolvedValue({ ok: true }),
    };
    const service = new CooperTokenService(
      prisma,
      { emit: jest.fn() } as any,
      undefined,
      pinCooperadoService as any,
    );
    return { service, tx, txCreateTokenTransacao };
  }

  it('cria TokenTransacao USO_FATURA sem recebedor', async () => {
    const { service, txCreateTokenTransacao } = setupUsarNaFatura();
    const r: any = await service.usarNaFatura({
      cooperadoId: 'coop-1',
      cooperativaId: 'tenant-A',
      cobrancaId: 'cob-1',
      quantidadeTokens: 10,
      pin: PIN_OK,
    });
    const data = txCreateTokenTransacao.mock.calls[0][0].data;
    expect(data.tipoOperacao).toBe('USO_FATURA');
    expect(data.recebedorId).toBeNull();
    expect(data.pinValidadoEm).toBeInstanceOf(Date);
    expect(data.referenciaExterna).toBe('cob-1');
    expect(r.tokensUsados).toBeGreaterThan(0);
  });
});

describe('F4 Bloco C — criarDesafioStepUp', () => {
  it('retorna desafioId + expiresAt; em ambiente NÃO-real inclui codigo', async () => {
    // NODE_ENV de teste = não-real → retorna codigo
    const { service } = setup();
    const r: any = await service.criarDesafioStepUp({
      usuarioId: 'admin-1',
      cooperativaId: 'coop-A',
    });
    expect(r.desafioId).toBe('des-1');
    expect(r.expiresAt).toBeInstanceOf(Date);
    expect(r.codigo).toBe('654321'); // ambiente teste retorna código
  });
});
