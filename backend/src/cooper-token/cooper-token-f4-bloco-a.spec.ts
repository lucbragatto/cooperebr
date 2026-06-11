/**
 * Sprint Clube P1 — F4 Bloco A (12/06/2026).
 *
 * Cobre usarNaFatura com PIN + Serializable + status-guard:
 *
 *   PIN — ausente/inválido/bloqueado/incorreto/válido.
 *   Status-guard idempotente — cobrança vira PAGA durante tx → BadRequest
 *     (mata D-novo-F4-RACE: overwrite silencioso de cobrança paga).
 *   isolationLevel: Serializable — opção da tx é passada ao Prisma.
 *   Clamp duplo — quantidade × tetoPlano (descontoMaxPerc) × saldo.
 *   Evento RESGATADO — emitido APÓS commit (fora da tx).
 */
import {
  BadRequestException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { CooperTokenService } from './cooper-token.service';
import { Prisma } from '@prisma/client';

interface SetupOpts {
  pinResult?: any;
  saldoDisponivel?: number;
  cobrancaStatus?: string;
  cobrancaContratoCooperadoId?: string;
  cobrancaValorLiquido?: number;
  planoValorTokenReais?: number;
  planoMaxPerc?: number;
  updateManyCount?: number;
}

function setup(opts: SetupOpts = {}) {
  const cooperadoId = 'coop-1';
  const cooperativaId = 'tenant-A';
  const cobrancaId = 'cob-1';

  const cobrancaPreviewFindFirst = jest.fn().mockResolvedValue({
    valorLiquido: opts.cobrancaValorLiquido ?? 100,
  });
  const tx: any = {
    cobranca: {
      // F4 Bloco C.1 MT-1 — cobrança via findFirst com filtro
      // contrato:{cooperadoId, cooperativaId} dentro da tx.
      findFirst: jest.fn().mockResolvedValue({
        id: cobrancaId,
        status: opts.cobrancaStatus ?? 'A_VENCER',
        valorLiquido: opts.cobrancaValorLiquido ?? 100,
        tokenDescontoQt: 0,
        tokenDescontoReais: 0,
        contrato: {
          cooperadoId: opts.cobrancaContratoCooperadoId ?? cooperadoId,
          plano: {
            valorTokenReais: opts.planoValorTokenReais ?? 0.5,
            tokenDescontoMaxPerc: opts.planoMaxPerc ?? 30,
          },
        },
      }),
      updateMany: jest
        .fn()
        .mockResolvedValue({ count: opts.updateManyCount ?? 1 }),
    },
    cooperTokenSaldo: {
      findUnique: jest.fn().mockResolvedValue(
        opts.saldoDisponivel !== undefined
          ? { cooperadoId, saldoDisponivel: opts.saldoDisponivel }
          : { cooperadoId, saldoDisponivel: 1000 },
      ),
      update: jest.fn().mockResolvedValue({}),
    },
    cooperTokenLedger: {
      create: jest.fn().mockResolvedValue({ id: 'ledger-1' }),
    },
    lancamentoCaixa: { create: jest.fn().mockResolvedValue({}) },
    // F4 Bloco C — criarTokenTransacao chama tx.cooperado.findUnique (guard
    // multi-tenant) + tx.tokenTransacao.count (motivoStepUp) + .create.
    // F4 Bloco C.1 FIN-2 — também usado pra ler status dentro da tx.
    cooperado: {
      findUnique: jest
        .fn()
        .mockResolvedValue({ id: cooperadoId, cooperativaId, status: 'ATIVO' }),
    },
    tokenTransacao: {
      count: jest.fn().mockResolvedValue(0),
      create: jest.fn().mockResolvedValue({
        id: 'tt-1',
        jti: 'jti-test-deterministic',
        tier: 'BAIXO',
        motivoStepUp: 'PRIMEIRO_USO',
        status: 'CONFIRMADA',
      }),
    },
  };

  const transactionFn = jest.fn(async (cb: any, _opts?: any) => cb(tx));

  const prisma: any = {
    $transaction: transactionFn,
    // F4 Bloco C.1 FIN-1 — preview read-only fora da tx pra obter valorLiquido.
    cobranca: {
      findFirst: cobrancaPreviewFindFirst,
    },
  };

  const pinCooperadoService = {
    validarPinComLockout: jest
      .fn()
      .mockResolvedValue(opts.pinResult ?? { ok: true }),
  };

  const eventEmitter = { emit: jest.fn() };

  const service = new CooperTokenService(
    prisma,
    eventEmitter as any,
    undefined,
    pinCooperadoService as any,
  );

  return {
    service,
    tx,
    prisma,
    transactionFn,
    pinCooperadoService,
    eventEmitter,
    ids: { cooperadoId, cooperativaId, cobrancaId },
  };
}

const PIN_OK = '123456';

describe('F4 Bloco A — usarNaFatura PIN + Serializable + status-guard', () => {
  describe('PIN', () => {
    it('rejeita PIN ausente com BadRequest', async () => {
      const { service, ids } = setup();
      await expect(
        service.usarNaFatura({
          ...ids,
          quantidadeTokens: 10,
          pin: '',
        }),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('rejeita PIN com formato inválido (não 6 dígitos)', async () => {
      const { service, ids } = setup();
      await expect(
        service.usarNaFatura({
          ...ids,
          quantidadeTokens: 10,
          pin: '12abc6',
        }),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('PIN_NAO_DEFINIDO → BadRequest com mensagem orientando configurar', async () => {
      const { service, ids } = setup({
        pinResult: { ok: false, motivo: 'PIN_NAO_DEFINIDO' },
      });
      await expect(
        service.usarNaFatura({ ...ids, quantidadeTokens: 10, pin: PIN_OK }),
      ).rejects.toThrow(/PIN ainda não foi definido/);
    });

    it('PIN_BLOQUEADO → ForbiddenException com data de desbloqueio', async () => {
      const desbloqueiaEm = new Date('2030-01-01');
      const { service, ids } = setup({
        pinResult: { ok: false, motivo: 'PIN_BLOQUEADO', desbloqueiaEm },
      });
      await expect(
        service.usarNaFatura({ ...ids, quantidadeTokens: 10, pin: PIN_OK }),
      ).rejects.toBeInstanceOf(ForbiddenException);
    });

    it('PIN_INCORRETO → ForbiddenException', async () => {
      const { service, ids } = setup({
        pinResult: { ok: false, motivo: 'PIN_INCORRETO' },
      });
      await expect(
        service.usarNaFatura({ ...ids, quantidadeTokens: 10, pin: PIN_OK }),
      ).rejects.toBeInstanceOf(ForbiddenException);
    });

    it('PIN válido chama validarPinComLockout com cooperadoId+cooperativaId+pin', async () => {
      const { service, pinCooperadoService, ids } = setup();
      await service.usarNaFatura({
        ...ids,
        quantidadeTokens: 10,
        pin: PIN_OK,
      });
      expect(pinCooperadoService.validarPinComLockout).toHaveBeenCalledWith({
        cooperadoId: ids.cooperadoId,
        cooperativaId: ids.cooperativaId,
        pin: PIN_OK,
      });
    });
  });

  describe('Tx Serializable', () => {
    it('passa isolationLevel: Serializable ao $transaction', async () => {
      const { service, transactionFn, ids } = setup();
      await service.usarNaFatura({
        ...ids,
        quantidadeTokens: 10,
        pin: PIN_OK,
      });
      const txOpts = transactionFn.mock.calls[0][1];
      expect(txOpts).toEqual(
        expect.objectContaining({
          isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
        }),
      );
    });
  });

  describe('Status-guard idempotente (D-novo-F4-RACE)', () => {
    it('cobrança PAGA antes da tx → BadRequest', async () => {
      const { service, ids } = setup({ cobrancaStatus: 'PAGA' });
      await expect(
        service.usarNaFatura({
          ...ids,
          quantidadeTokens: 10,
          pin: PIN_OK,
        }),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('cobrança mudou DURANTE a tx (updateMany count=0) → BadRequest sem overwrite', async () => {
      const { service, tx, ids } = setup({ updateManyCount: 0 });
      await expect(
        service.usarNaFatura({
          ...ids,
          quantidadeTokens: 10,
          pin: PIN_OK,
        }),
      ).rejects.toThrow(/mudou de status/);
      // updateMany foi chamado mas count=0 — verifica que o filtro de status
      // foi passado (status-guard ativo).
      const updateArgs = tx.cobranca.updateMany.mock.calls[0][0];
      expect(updateArgs.where.status).toEqual({
        in: ['A_VENCER', 'VENCIDO'],
      });
    });

    it('F4 Bloco C.1 FIN-2: cooperado SUSPENSO dentro da tx → Forbidden', async () => {
      const { service, tx, ids } = setup();
      // Status SUSPENSO no snapshot dentro da tx
      tx.cooperado.findUnique.mockResolvedValueOnce({
        id: ids.cooperadoId,
        cooperativaId: ids.cooperativaId,
        status: 'SUSPENSO',
      });
      await expect(
        service.usarNaFatura({
          ...ids,
          quantidadeTokens: 10,
          pin: PIN_OK,
        }),
      ).rejects.toThrow(/SUSPENSO|não permite gastar/);
    });

    it('cobrança VENCIDO também é permitida', async () => {
      const { service, ids } = setup({ cobrancaStatus: 'VENCIDO' });
      const r = await service.usarNaFatura({
        ...ids,
        quantidadeTokens: 10,
        pin: PIN_OK,
      });
      expect(r.tokensUsados).toBeGreaterThan(0);
    });
  });

  describe('Ownership multi-tenant (Bloco C.1 MT-1)', () => {
    it('cobrança de outro cooperado → NotFound genérica (não revela)', async () => {
      // F4 Bloco C.1 MT-1: findFirst com filtro contrato:{cooperadoId, cooperativaId}
      // não bate → null → NotFound. Não dá pra distinguir "não existe" de
      // "existe em outro tenant" — exatamente o objetivo do hardening.
      const { service, tx, ids } = setup();
      tx.cobranca.findFirst.mockResolvedValueOnce(null);
      await expect(
        service.usarNaFatura({
          ...ids,
          quantidadeTokens: 10,
          pin: PIN_OK,
        }),
      ).rejects.toBeInstanceOf(NotFoundException);
    });

    it('cobrança inexistente → NotFound (findFirst dentro da tx)', async () => {
      const { service, tx, ids } = setup();
      tx.cobranca.findFirst.mockResolvedValueOnce(null);
      await expect(
        service.usarNaFatura({
          ...ids,
          quantidadeTokens: 10,
          pin: PIN_OK,
        }),
      ).rejects.toBeInstanceOf(NotFoundException);
    });
  });

  describe('Clamp triplo (quantidade × tetoPlano × saldo)', () => {
    it('clamp pelo tetoPlano (descontoMaxPerc=30 → 30% de R$100 = 60 tokens @ 0.5)', async () => {
      // Pedi 200 tokens mas plano só permite 30% × 100 / 0.5 = 60 tokens.
      const { service, tx, ids } = setup({
        cobrancaValorLiquido: 100,
        planoMaxPerc: 30,
        planoValorTokenReais: 0.5,
        saldoDisponivel: 1000,
      });
      const r = await service.usarNaFatura({
        ...ids,
        quantidadeTokens: 200,
        pin: PIN_OK,
      });
      expect(r.tokensUsados).toBe(60);
      expect(r.desconto).toBe(30);
      // valor original 100 - desconto 30 = 70
      expect(r.novoValor).toBe(70);
      // Ledger.quantidade == tokens debitados
      expect(tx.cooperTokenLedger.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ quantidade: 60 }),
        }),
      );
    });

    it('clamp pelo saldo (saldo 5 < tetoPlano 60 < pedido 200)', async () => {
      const { service, ids } = setup({
        cobrancaValorLiquido: 100,
        planoMaxPerc: 30,
        planoValorTokenReais: 0.5,
        saldoDisponivel: 5,
      });
      const r = await service.usarNaFatura({
        ...ids,
        quantidadeTokens: 200,
        pin: PIN_OK,
      });
      expect(r.tokensUsados).toBe(5);
    });

    it('saldo zero → BadRequest', async () => {
      const { service, ids } = setup({ saldoDisponivel: 0 });
      await expect(
        service.usarNaFatura({
          ...ids,
          quantidadeTokens: 10,
          pin: PIN_OK,
        }),
      ).rejects.toBeInstanceOf(BadRequestException);
    });
  });

  describe('Happy path completo', () => {
    it('emite evento RESGATADO APÓS commit', async () => {
      const { service, eventEmitter, transactionFn, ids } = setup();
      await service.usarNaFatura({
        ...ids,
        quantidadeTokens: 10,
        pin: PIN_OK,
      });
      expect(transactionFn).toHaveBeenCalled();
      expect(eventEmitter.emit).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          cooperativaId: ids.cooperativaId,
          cooperadoId: ids.cooperadoId,
        }),
      );
    });

    it('saldo é debitado pelo tokensEfetivos (não pelo pedido se clamp foi aplicado)', async () => {
      const { service, tx, ids } = setup({
        cobrancaValorLiquido: 100,
        planoMaxPerc: 30,
        planoValorTokenReais: 0.5,
        saldoDisponivel: 1000,
      });
      await service.usarNaFatura({
        ...ids,
        quantidadeTokens: 200,
        pin: PIN_OK,
      });
      // saldo 1000 - 60 efetivos = 940
      expect(tx.cooperTokenSaldo.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ saldoDisponivel: 940 }),
        }),
      );
    });
  });
});
