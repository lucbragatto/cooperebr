/**
 * Sprint Convênio FAMÍLIA M49 (22/06/2026) — Fatia D.
 *
 * Cobre o caminho FAMILIAR de `usarNaFatura`:
 *
 *   - titularCooperadoId === cooperadoId pagador → BadRequest (não-self).
 *   - Sem AutorizacaoTokenFamiliar ativa → ForbiddenException.
 *   - Cross-tenant esposa→outroTenant.marido → ForbiddenException (mesmo
 *     comportamento, autorização não acha).
 *   - Self atual preservado (sem titularCooperadoId → continua como antes,
 *     emite RESGATADO; idempotência F4 Bloco A não regrida).
 *   - Happy path familiar → cobrança do TITULAR usada como alvo da query;
 *     saldo/PIN/limite do PAGADOR; contadores da autorização atualizados;
 *     AuditLog forense criado; evento RESGATADO_FAMILIAR emitido (com
 *     ambos IDs); evento RESGATADO legado NÃO emitido.
 *
 * Reusa shape do setup do F4 Bloco A (mesmo service, mesmo PrismaMock),
 * só amplia com mocks específicos da AutorizacaoTokenFamiliar + AuditLog.
 */
import {
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { CooperTokenService } from './cooper-token.service';
import { COOPER_TOKEN_EVENTS } from './cooper-token.events';

interface SetupOpts {
  /** Autorização ativa retornada pelo findFirst (null → bloqueia). */
  autorizacaoAtiva?: {
    id: string;
    totalAbatesCount: number;
  } | null;
  cobrancaContratoCooperadoId?: string;
  /** Para o cenário self preservado. */
  isFamiliar?: boolean;
}

function setup(opts: SetupOpts = {}) {
  const cooperadoPagadorId = 'coop-pagador';
  const cooperadoTitularId = 'coop-titular';
  const cooperativaId = 'tenant-A';
  const cobrancaId = 'cob-1';

  const tx: any = {
    cobranca: {
      findFirst: jest.fn().mockResolvedValue({
        id: cobrancaId,
        status: 'A_VENCER',
        valorLiquido: 100,
        tokenDescontoQt: 0,
        tokenDescontoReais: 0,
        contrato: {
          cooperadoId:
            opts.cobrancaContratoCooperadoId ??
            (opts.isFamiliar === false ? cooperadoPagadorId : cooperadoTitularId),
          plano: {
            valorTokenReais: 0.5,
            tokenDescontoMaxPerc: 30,
          },
        },
      }),
      updateMany: jest.fn().mockResolvedValue({ count: 1 }),
    },
    cooperTokenSaldo: {
      findUnique: jest
        .fn()
        .mockResolvedValue({ cooperadoId: cooperadoPagadorId, saldoDisponivel: 1000 }),
      update: jest.fn().mockResolvedValue({}),
    },
    cooperTokenLedger: {
      create: jest.fn().mockResolvedValue({ id: 'ledger-1' }),
    },
    lancamentoCaixa: { create: jest.fn().mockResolvedValue({}) },
    cooperado: {
      findUnique: jest
        .fn()
        .mockResolvedValue({ id: cooperadoPagadorId, cooperativaId, status: 'ATIVO' }),
    },
    tokenTransacao: {
      count: jest.fn().mockResolvedValue(0),
      create: jest.fn().mockResolvedValue({
        id: 'tt-1',
        jti: 'jti-1',
        tier: 'BAIXO',
        motivoStepUp: 'PRIMEIRO_USO',
        status: 'CONFIRMADA',
      }),
    },
  };

  const transactionFn = jest.fn(async (cb: any, _opts?: any) => cb(tx));

  const autorizacaoFindFirst = jest.fn().mockResolvedValue(
    opts.autorizacaoAtiva === undefined
      ? { id: 'aut-1', totalAbatesCount: 0 }
      : opts.autorizacaoAtiva,
  );
  const autorizacaoUpdateMany = jest.fn().mockResolvedValue({ count: 1 });

  const auditLogCreate = jest.fn().mockResolvedValue({});

  const prisma: any = {
    $transaction: transactionFn,
    cobranca: {
      findFirst: jest.fn().mockResolvedValue({ valorLiquido: 100 }),
    },
    autorizacaoTokenFamiliar: {
      findFirst: autorizacaoFindFirst,
      updateMany: autorizacaoUpdateMany,
    },
    auditLog: { create: auditLogCreate },
  };

  const pinCooperadoService = {
    validarPinComLockout: jest.fn().mockResolvedValue({ ok: true }),
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
    autorizacaoFindFirst,
    autorizacaoUpdateMany,
    auditLogCreate,
    ids: { cooperadoPagadorId, cooperadoTitularId, cooperativaId, cobrancaId },
  };
}

const PIN_OK = '123456';

describe('M49 Fatia D — usarNaFatura FAMILIAR', () => {
  describe('Pré-validações', () => {
    it('titularCooperadoId === cooperadoId pagador → BadRequest (não-self)', async () => {
      const { service, ids } = setup();
      await expect(
        service.usarNaFatura({
          cooperadoId: ids.cooperadoPagadorId,
          cooperativaId: ids.cooperativaId,
          cobrancaId: ids.cobrancaId,
          quantidadeTokens: 10,
          pin: PIN_OK,
          titularCooperadoId: ids.cooperadoPagadorId,
        }),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('Sem AutorizacaoTokenFamiliar ativa → ForbiddenException', async () => {
      const { service, ids } = setup({ autorizacaoAtiva: null });
      await expect(
        service.usarNaFatura({
          cooperadoId: ids.cooperadoPagadorId,
          cooperativaId: ids.cooperativaId,
          cobrancaId: ids.cobrancaId,
          quantidadeTokens: 10,
          pin: PIN_OK,
          titularCooperadoId: ids.cooperadoTitularId,
        }),
      ).rejects.toBeInstanceOf(ForbiddenException);
    });

    it('Cross-tenant titular pertence a outro tenant → findFirst com cooperativaId não acha → ForbiddenException', async () => {
      const { service, autorizacaoFindFirst, ids } = setup({ autorizacaoAtiva: null });
      await expect(
        service.usarNaFatura({
          cooperadoId: ids.cooperadoPagadorId,
          cooperativaId: ids.cooperativaId,
          cobrancaId: ids.cobrancaId,
          quantidadeTokens: 10,
          pin: PIN_OK,
          titularCooperadoId: 'coop-titular-outro-tenant',
        }),
      ).rejects.toBeInstanceOf(ForbiddenException);
      // findFirst recebeu cooperativaId do PAGADOR (JWT) — defesa M45.
      expect(autorizacaoFindFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            cooperadoPagadorId: ids.cooperadoPagadorId,
            cooperadoTitularId: 'coop-titular-outro-tenant',
            cooperativaId: ids.cooperativaId,
            ativo: true,
          }),
        }),
      );
    });

    it('PIN/saldo/limite SEMPRE do PAGADOR (mesmo em familiar)', async () => {
      const { service, pinCooperadoService, ids } = setup();
      await service.usarNaFatura({
        cooperadoId: ids.cooperadoPagadorId,
        cooperativaId: ids.cooperativaId,
        cobrancaId: ids.cobrancaId,
        quantidadeTokens: 10,
        pin: PIN_OK,
        titularCooperadoId: ids.cooperadoTitularId,
      });
      // PIN validado contra PAGADOR, não TITULAR.
      expect(pinCooperadoService.validarPinComLockout).toHaveBeenCalledWith({
        cooperadoId: ids.cooperadoPagadorId,
        cooperativaId: ids.cooperativaId,
        pin: PIN_OK,
      });
    });
  });

  describe('Cobrança do TITULAR', () => {
    it('preview cobranca.findFirst usa contrato.cooperadoId=titular (não pagador)', async () => {
      const { service, prisma, ids } = setup();
      await service.usarNaFatura({
        cooperadoId: ids.cooperadoPagadorId,
        cooperativaId: ids.cooperativaId,
        cobrancaId: ids.cobrancaId,
        quantidadeTokens: 10,
        pin: PIN_OK,
        titularCooperadoId: ids.cooperadoTitularId,
      });
      expect(prisma.cobranca.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            id: ids.cobrancaId,
            contrato: expect.objectContaining({
              cooperadoId: ids.cooperadoTitularId,
              cooperativaId: ids.cooperativaId,
            }),
          }),
        }),
      );
    });

    it('dentro da tx, cobranca.findFirst também usa contrato.cooperadoId=titular', async () => {
      const { service, tx, ids } = setup();
      await service.usarNaFatura({
        cooperadoId: ids.cooperadoPagadorId,
        cooperativaId: ids.cooperativaId,
        cobrancaId: ids.cobrancaId,
        quantidadeTokens: 10,
        pin: PIN_OK,
        titularCooperadoId: ids.cooperadoTitularId,
      });
      const args = tx.cobranca.findFirst.mock.calls[0][0];
      expect(args.where.contrato).toEqual(
        expect.objectContaining({
          cooperadoId: ids.cooperadoTitularId,
          cooperativaId: ids.cooperativaId,
        }),
      );
    });
  });

  describe('Pós-commit familiar', () => {
    it('atualiza contadores da AutorizacaoTokenFamiliar (updateMany c/ cooperativaId)', async () => {
      const { service, autorizacaoUpdateMany, ids } = setup({
        autorizacaoAtiva: { id: 'aut-1', totalAbatesCount: 0 },
      });
      await service.usarNaFatura({
        cooperadoId: ids.cooperadoPagadorId,
        cooperativaId: ids.cooperativaId,
        cobrancaId: ids.cobrancaId,
        quantidadeTokens: 10,
        pin: PIN_OK,
        titularCooperadoId: ids.cooperadoTitularId,
      });
      // 1ª chamada: contadores aditivos (totalAbatesCount + totalTokensAbatidos + ultimoUsoEm)
      expect(autorizacaoUpdateMany).toHaveBeenNthCalledWith(
        1,
        expect.objectContaining({
          where: { id: 'aut-1', cooperativaId: ids.cooperativaId },
          data: expect.objectContaining({
            totalAbatesCount: { increment: 1 },
            ultimoUsoEm: expect.any(Date),
          }),
        }),
      );
      // 2ª chamada: primeiraUtilizacaoEm com filtro race-proof (only-once)
      expect(autorizacaoUpdateMany).toHaveBeenNthCalledWith(
        2,
        expect.objectContaining({
          where: {
            id: 'aut-1',
            cooperativaId: ids.cooperativaId,
            primeiraUtilizacaoEm: null,
          },
          data: { primeiraUtilizacaoEm: expect.any(Date) },
        }),
      );
    });

    it('totalAbatesCount > 0 → NÃO faz a 2ª updateMany de primeiraUtilizacaoEm', async () => {
      const { service, autorizacaoUpdateMany, ids } = setup({
        autorizacaoAtiva: { id: 'aut-1', totalAbatesCount: 5 },
      });
      await service.usarNaFatura({
        cooperadoId: ids.cooperadoPagadorId,
        cooperativaId: ids.cooperativaId,
        cobrancaId: ids.cobrancaId,
        quantidadeTokens: 10,
        pin: PIN_OK,
        titularCooperadoId: ids.cooperadoTitularId,
      });
      // Só 1 call (contadores) — não há call de primeiraUtilizacaoEm pra abates>0
      expect(autorizacaoUpdateMany).toHaveBeenCalledTimes(1);
      const updateArgs = autorizacaoUpdateMany.mock.calls[0][0];
      expect(updateArgs.data.primeiraUtilizacaoEm).toBeUndefined();
      expect(updateArgs.data.ultimoUsoEm).toBeInstanceOf(Date);
    });

    it('cria AuditLog forense token.usar-na-fatura.familiar com ambos cooperados no metadata', async () => {
      const { service, auditLogCreate, ids } = setup();
      await service.usarNaFatura({
        cooperadoId: ids.cooperadoPagadorId,
        cooperativaId: ids.cooperativaId,
        cobrancaId: ids.cobrancaId,
        quantidadeTokens: 10,
        pin: PIN_OK,
        titularCooperadoId: ids.cooperadoTitularId,
      });
      expect(auditLogCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            cooperativaId: ids.cooperativaId,
            acao: 'token.usar-na-fatura.familiar',
            recurso: 'Cobranca',
            recursoId: ids.cobrancaId,
            usuarioId: ids.cooperadoPagadorId,
            metadata: expect.objectContaining({
              pagadorCooperadoId: ids.cooperadoPagadorId,
              titularCooperadoId: ids.cooperadoTitularId,
              autorizacaoId: 'aut-1',
            }),
          }),
        }),
      );
    });

    it('emite COOPER_TOKEN_EVENTS.RESGATADO_FAMILIAR (e NÃO o RESGATADO legado)', async () => {
      const { service, eventEmitter, ids } = setup();
      await service.usarNaFatura({
        cooperadoId: ids.cooperadoPagadorId,
        cooperativaId: ids.cooperativaId,
        cobrancaId: ids.cobrancaId,
        quantidadeTokens: 10,
        pin: PIN_OK,
        titularCooperadoId: ids.cooperadoTitularId,
      });
      const eventNames = eventEmitter.emit.mock.calls.map((c) => c[0]);
      expect(eventNames).toContain(COOPER_TOKEN_EVENTS.RESGATADO_FAMILIAR);
      expect(eventNames).not.toContain(COOPER_TOKEN_EVENTS.RESGATADO);
      const familiarPayload = eventEmitter.emit.mock.calls.find(
        (c) => c[0] === COOPER_TOKEN_EVENTS.RESGATADO_FAMILIAR,
      )?.[1];
      expect(familiarPayload).toEqual(
        expect.objectContaining({
          cooperativaId: ids.cooperativaId,
          cooperadoPagadorId: ids.cooperadoPagadorId,
          cooperadoTitularId: ids.cooperadoTitularId,
          autorizacaoId: 'aut-1',
          cobrancaId: ids.cobrancaId,
        }),
      );
    });

    it('falha do updateMany não derruba o pagamento (best-effort post-commit)', async () => {
      const { service, autorizacaoUpdateMany, ids } = setup();
      autorizacaoUpdateMany.mockRejectedValueOnce(new Error('boom'));
      // pagamento já commitou — retorno deve sair normal
      const r = await service.usarNaFatura({
        cooperadoId: ids.cooperadoPagadorId,
        cooperativaId: ids.cooperativaId,
        cobrancaId: ids.cobrancaId,
        quantidadeTokens: 10,
        pin: PIN_OK,
        titularCooperadoId: ids.cooperadoTitularId,
      });
      expect(r.tokensUsados).toBeGreaterThan(0);
    });

    // P3-D reviewer 22/06 — simetria com o caso de updateMany: falha do
    // AuditLog também é best-effort (pagamento já commitou).
    it('falha do AuditLog não derruba o pagamento (best-effort post-commit)', async () => {
      const { service, auditLogCreate, ids } = setup();
      auditLogCreate.mockRejectedValueOnce(new Error('audit-boom'));
      const r = await service.usarNaFatura({
        cooperadoId: ids.cooperadoPagadorId,
        cooperativaId: ids.cooperativaId,
        cobrancaId: ids.cobrancaId,
        quantidadeTokens: 10,
        pin: PIN_OK,
        titularCooperadoId: ids.cooperadoTitularId,
      });
      expect(r.tokensUsados).toBeGreaterThan(0);
    });
  });

  describe('Self atual preservado', () => {
    it('Sem titularCooperadoId → caminho legado: emite RESGATADO + sem AuditLog familiar', async () => {
      const { service, eventEmitter, autorizacaoFindFirst, autorizacaoUpdateMany, auditLogCreate, ids } =
        setup({ isFamiliar: false });
      await service.usarNaFatura({
        cooperadoId: ids.cooperadoPagadorId,
        cooperativaId: ids.cooperativaId,
        cobrancaId: ids.cobrancaId,
        quantidadeTokens: 10,
        pin: PIN_OK,
      });
      // findFirst da autorização NUNCA é chamado no self.
      expect(autorizacaoFindFirst).not.toHaveBeenCalled();
      expect(autorizacaoUpdateMany).not.toHaveBeenCalled();
      expect(auditLogCreate).not.toHaveBeenCalled();
      const eventNames = eventEmitter.emit.mock.calls.map((c) => c[0]);
      expect(eventNames).toContain(COOPER_TOKEN_EVENTS.RESGATADO);
      expect(eventNames).not.toContain(COOPER_TOKEN_EVENTS.RESGATADO_FAMILIAR);
    });
  });
});
