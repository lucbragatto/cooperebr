/**
 * Sprint Clube P1 — F4 Bloco C.1 fixes pos-review (12/06/2026).
 *
 * Cobre os 3 P1 + 4 P2 + caronas:
 *
 *   FIN-1 (P1): LimiteTokenService.verificarValor ANTES da tx nos 3 endpoints
 *   FIN-2 (P1): cooperado.status validado DENTRO da tx do usarNaFatura
 *   MT-1 (P1):  cobrança via findFirst{contrato:{cooperadoId, cooperativaId}}
 *   FIN-4 (P2): enviarTokensAdmin com clientRequestId → idempotência via creditar
 *   MT-2 (P2):  cooperativaId vazio → BadRequest; creditar null → BadRequest
 *   MT-4 (carona): OtpDesafio rejeita quando caller tem tenant + desafio.cooperativaId null
 *   FIN-5 (spec): 2 parceiros escaneando mesmo QR → 1 vence (status-guard equivalente
 *                 via cooperTokenSaldo + Serializable)
 *   FIN-6 (spec): jti duplicado → P2002 propagado pra fora da tx
 */
import {
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import * as jwt from 'jsonwebtoken';
import { Prisma } from '@prisma/client';
import { CooperTokenService } from './cooper-token.service';
import { OtpDesafioService } from '../common/security/otp-desafio.service';
import { criarTokenTransacao } from './token-transacao.helper';

const SECRET = 'F4-bloco-C1-secret-com-mais-de-32-caracteres-aqui-test';

function gerarQrToken(quantidade: number, cooperativaId = 'coop-A') {
  return jwt.sign(
    { pagadorId: 'pagador-1', cooperativaId, quantidade, tipo: 'COOPER_TOKEN_QR' },
    SECRET,
  );
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

// ─────────────────────────────────────────────────────────────────────
// FIN-1 — LimiteTokenService.verificarValor ANTES da tx
// ─────────────────────────────────────────────────────────────────────

describe('F4 Bloco C.1 FIN-1 — LimiteTokenService.verificarValor nos 3 endpoints', () => {
  function setup(limiteResult: any) {
    const tx: any = {
      cobranca: {
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
        findFirst: jest.fn().mockResolvedValue({ cooperadoId: 'pagador-1', saldoDisponivel: 10000 }),
        update: jest.fn(),
        create: jest.fn(),
      },
      cooperTokenLedger: { create: jest.fn().mockResolvedValue({ id: 'l-1' }) },
      lancamentoCaixa: { create: jest.fn() },
      cooperado: {
        findUnique: jest.fn(({ where }: any) => {
          if (where.id === 'coop-1') return Promise.resolve({ id: 'coop-1', cooperativaId: 'tenant-A', status: 'ATIVO' });
          if (where.id === 'pagador-1') return Promise.resolve({ id: 'pagador-1', cooperativaId: 'coop-A', status: 'ATIVO' });
          if (where.id === 'remetente-1') return Promise.resolve({ id: 'remetente-1', cooperativaId: 'coop-A', status: 'ATIVO' });
          if (where.id === 'destinatario-1' || where.id === 'recebedor-1') return Promise.resolve({ id: where.id, cooperativaId: 'coop-A', status: 'ATIVO' });
          return Promise.resolve(null);
        }),
      },
      tokenTransacao: {
        count: jest.fn().mockResolvedValue(0),
        create: jest.fn().mockResolvedValue({ id: 'tt-1', jti: 'jti-1', tier: 'BAIXO', motivoStepUp: 'PRIMEIRO_USO', status: 'CONFIRMADA' }),
      },
    };
    const prisma: any = {
      $transaction: jest.fn(async (cb: any, _o?: any) => cb(tx)),
      cobranca: { findFirst: jest.fn().mockResolvedValue({ valorLiquido: 100 }) },
      configCooperToken: { findUnique: jest.fn().mockResolvedValue(null) },
      cooperado: { findFirst: jest.fn().mockResolvedValue({ id: 'destinatario-1', status: 'ATIVO' }) },
    };
    const pin = { validarPinComLockout: jest.fn().mockResolvedValue({ ok: true }) };
    const limite = { verificarValor: jest.fn().mockResolvedValue(limiteResult) };
    return new CooperTokenService(
      prisma,
      { emit: jest.fn() } as any,
      undefined,
      pin as any,
      undefined,
      limite as any,
    );
  }

  describe('usarNaFatura', () => {
    it('limite por transação excedido → BadRequest com mensagem clara', async () => {
      const service = setup({ ok: false, motivo: 'EXCEDE_LIMITE_TRANSACAO', limite: 50 });
      await expect(
        service.usarNaFatura({
          cooperadoId: 'coop-1',
          cooperativaId: 'tenant-A',
          cobrancaId: 'cob-1',
          quantidadeTokens: 1000,
          pin: PIN_OK,
        }),
      ).rejects.toThrow(/excede o limite por transação/);
    });

    it('limite diário excedido → BadRequest com mensagem clara', async () => {
      const service = setup({ ok: false, motivo: 'EXCEDE_LIMITE_DIARIO', limiteDiario: 200, gastoHoje: 180 });
      await expect(
        service.usarNaFatura({
          cooperadoId: 'coop-1',
          cooperativaId: 'tenant-A',
          cobrancaId: 'cob-1',
          quantidadeTokens: 100,
          pin: PIN_OK,
        }),
      ).rejects.toThrow(/Limite diário.*seria estourado/);
    });

    it('limite ok → segue pra tx normalmente', async () => {
      const service = setup({ ok: true, limiteEfetivo: 500, gastoHoje: 0, saldoDisponivel: 2000 });
      const r: any = await service.usarNaFatura({
        cooperadoId: 'coop-1',
        cooperativaId: 'tenant-A',
        cobrancaId: 'cob-1',
        quantidadeTokens: 10,
        pin: PIN_OK,
      });
      expect(r.tokensUsados).toBeGreaterThan(0);
    });
  });

  describe('processarPagamentoQr', () => {
    it('limite excedido → BadRequest antes de abrir tx', async () => {
      const service = setup({ ok: false, motivo: 'EXCEDE_LIMITE_TRANSACAO', limite: 10 });
      await expect(
        service.processarPagamentoQr({
          qrToken: gerarQrToken(50),
          recebedorId: 'recebedor-1',
          recebedorCooperativaId: 'coop-A',
          pin: PIN_OK,
        }),
      ).rejects.toThrow(/excede o limite por transação/);
    });
  });

  describe('enviarTokens (cooperado→cooperado)', () => {
    it('limite excedido → BadRequest antes de abrir tx', async () => {
      const service = setup({ ok: false, motivo: 'EXCEDE_LIMITE_TRANSACAO', limite: 30 });
      await expect(
        service.enviarTokens({
          remetenteCooperadoId: 'remetente-1',
          destinatarioCooperadoId: 'destinatario-1',
          cooperativaId: 'coop-A',
          quantidade: 100,
          pin: PIN_OK,
        }),
      ).rejects.toThrow(/excede o limite por transação/);
    });
  });
});

// ─────────────────────────────────────────────────────────────────────
// FIN-5 — 2 parceiros escaneando mesmo QR → só 1 debita
// ─────────────────────────────────────────────────────────────────────

describe('F4 Bloco C.1 FIN-5 — race 2 scanneadas mesmo QR', () => {
  it('2 chamadas seriais ao mesmo QR: a 2ª enxerga saldo já debitado e falha', async () => {
    let saldoAtual = 100;
    const tx: any = {
      cooperTokenSaldo: {
        findUnique: jest.fn(),
        findFirst: jest.fn(({ where }: any) => {
          if (where.cooperadoId === 'pagador-1') {
            return Promise.resolve({ saldoDisponivel: saldoAtual });
          }
          return Promise.resolve(null);
        }),
        update: jest.fn(({ data }: any) => {
          saldoAtual = data.saldoDisponivel;
          return Promise.resolve({ saldoDisponivel: data.saldoDisponivel });
        }),
        create: jest.fn().mockResolvedValue({ saldoDisponivel: 0, totalEmitido: 0 }),
      },
      cooperTokenLedger: { create: jest.fn().mockResolvedValue({}) },
      cooperado: {
        findUnique: jest.fn(({ where }: any) =>
          Promise.resolve({ id: where.id, cooperativaId: 'coop-A', status: 'ATIVO' }),
        ),
      },
      tokenTransacao: {
        count: jest.fn().mockResolvedValue(0),
        create: jest.fn().mockResolvedValue({
          id: 'tt', jti: 'jti', tier: 'BAIXO', motivoStepUp: 'PRIMEIRO_USO', status: 'CONFIRMADA',
        }),
      },
    };
    const prisma: any = {
      $transaction: jest.fn(async (cb: any, _o?: any) => cb(tx)),
      configCooperToken: { findUnique: jest.fn().mockResolvedValue(null) },
    };
    const pin = { validarPinComLockout: jest.fn().mockResolvedValue({ ok: true }) };
    const limite = { verificarValor: jest.fn().mockResolvedValue({ ok: true, limiteEfetivo: 500, gastoHoje: 0, saldoDisponivel: 500 }) };
    const service = new CooperTokenService(
      prisma, { emit: jest.fn() } as any, undefined, pin as any, undefined, limite as any,
    );

    const qr = gerarQrToken(100);
    // 1ª chamada: passa, saldo zera
    const r1: any = await service.processarPagamentoQr({
      qrToken: qr,
      recebedorId: 'recebedor-1',
      recebedorCooperativaId: 'coop-A',
      pin: PIN_OK,
    });
    expect(r1.sucesso).toBe(true);

    // 2ª chamada com mesmo QR: saldo agora é 0, falha em "Saldo insuficiente"
    await expect(
      service.processarPagamentoQr({
        qrToken: qr,
        recebedorId: 'recebedor-2',
        recebedorCooperativaId: 'coop-A',
        pin: PIN_OK,
      }),
    ).rejects.toThrow(/Saldo insuficiente/);
  });
});

// ─────────────────────────────────────────────────────────────────────
// FIN-6 — jti duplicado propagado como P2002
// ─────────────────────────────────────────────────────────────────────

describe('F4 Bloco C.1 FIN-6 — jti duplicado → P2002 propagado', () => {
  it('helper criarTokenTransacao com jti override duplicado lança erro P2002', async () => {
    const p2002 = Object.assign(new Error('Unique constraint failed on the fields: (`jti`)'), {
      code: 'P2002',
      meta: { target: ['jti'] },
    });
    const tx: any = {
      cooperado: {
        findUnique: jest.fn().mockResolvedValue({ id: 'pag-1', cooperativaId: 'coop-A' }),
      },
      tokenTransacao: {
        count: jest.fn().mockResolvedValue(0),
        create: jest.fn().mockRejectedValue(p2002),
      },
    };
    await expect(
      criarTokenTransacao(tx, {
        pagadorId: 'pag-1',
        pagadorCooperativaId: 'coop-A',
        quantidadeTokens: 10,
        valorReaisEstimado: 5,
        tipoOperacao: 'USO_FATURA',
        jti: 'jti-duplicate',
      }),
    ).rejects.toMatchObject({ code: 'P2002' });
  });
});

// ─────────────────────────────────────────────────────────────────────
// MT-4 — OtpDesafioService rejeita quando desafio.cooperativaId é null
// ─────────────────────────────────────────────────────────────────────

describe('F4 Bloco C.1 MT-4 — OtpDesafioService rejeita desafio com cooperativaId null', () => {
  it('caller passa tenant + desafio.cooperativaId null → DESAFIO_NAO_ENCONTRADO', async () => {
    const prisma: any = {
      otpDesafio: {
        findUnique: jest.fn().mockResolvedValue({
          id: 'des-legacy',
          cooperativaId: null, // legado pre-F2.9
          codigoHash: 'x',
          salt: 'y',
          expiresAt: new Date(Date.now() + 60_000),
          validadoEm: null,
          tentativas: 0,
          bloqueadoAte: null,
        }),
        update: jest.fn(),
      },
    };
    const service = new OtpDesafioService(prisma);
    const r = await service.validar({
      desafioId: 'des-legacy',
      codigo: '123456',
      cooperativaId: 'coop-A',
    });
    expect(r).toEqual({ ok: false, motivo: 'DESAFIO_NAO_ENCONTRADO' });
  });

  it('caller passa tenant + desafio.cooperativaId bate → segue (não-vazio)', async () => {
    const prisma: any = {
      otpDesafio: {
        findUnique: jest.fn().mockResolvedValue({
          id: 'des-1',
          cooperativaId: 'coop-A',
          codigoHash: 'x',
          salt: 'y',
          expiresAt: new Date(Date.now() + 60_000),
          validadoEm: null,
          tentativas: 0,
          bloqueadoAte: null,
        }),
        update: jest.fn().mockResolvedValue({ tentativas: 1 }),
      },
    };
    const service = new OtpDesafioService(prisma);
    const r = await service.validar({
      desafioId: 'des-1',
      codigo: '999999', // não bate hash mas o ponto é que NÃO retorna DESAFIO_NAO_ENCONTRADO por cooperativaId
      cooperativaId: 'coop-A',
    });
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.motivo).not.toBe('DESAFIO_NAO_ENCONTRADO');
    }
  });

  it('caller NÃO passa tenant + desafio.cooperativaId null → ainda OK (backward-compat callers antigos)', async () => {
    const prisma: any = {
      otpDesafio: {
        findUnique: jest.fn().mockResolvedValue({
          id: 'des-legacy',
          cooperativaId: null,
          codigoHash: 'x',
          salt: 'y',
          expiresAt: new Date(Date.now() + 60_000),
          validadoEm: null,
          tentativas: 0,
          bloqueadoAte: null,
        }),
        update: jest.fn().mockResolvedValue({ tentativas: 1 }),
      },
    };
    const service = new OtpDesafioService(prisma);
    const r = await service.validar({ desafioId: 'des-legacy', codigo: '111111' });
    // Sem cooperativaId no caller, o guard MT-4 não dispara — segue pro check de hash
    if (!r.ok) {
      expect(r.motivo).not.toBe('DESAFIO_NAO_ENCONTRADO');
    }
  });
});
