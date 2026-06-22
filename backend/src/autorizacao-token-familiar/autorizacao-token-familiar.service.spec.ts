/**
 * Sprint Convênio FAMÍLIA M49 (22/06/2026) — Fatia C specs.
 *
 * Cobertura:
 *  - criar (pagador PIN obrigatório + multi-tenant + idempotência)
 *  - confirmarTitular (PIN opcional + ativo=true após confirmar)
 *  - revogar (unilateral pagador OU titular + tokens já usados não voltam)
 *  - Multi-tenant inegociável (lição M45 + Q2/Q3 orquestrador)
 */
import {
  ForbiddenException,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import {
  AutorizacaoTokenFamiliarService,
  AutorizacaoNaoEncontradaError,
  AutorizacaoConflitoError,
  CrossTenantError,
} from './autorizacao-token-familiar.service';

describe('AutorizacaoTokenFamiliarService — Sprint Família M49 Fatia C', () => {
  const cooperadoFindFirst = jest.fn();
  const cooperadoFindUnique = jest.fn();
  const autorizacaoFindFirst = jest.fn();
  const autorizacaoFindUnique = jest.fn();
  const autorizacaoCreate = jest.fn();
  const autorizacaoUpdate = jest.fn();
  const validarPin = jest.fn();
  const waEnviarMensagem = jest.fn();

  const prismaMock = {
    cooperado: { findFirst: cooperadoFindFirst, findUnique: cooperadoFindUnique },
    autorizacaoTokenFamiliar: {
      findFirst: autorizacaoFindFirst,
      findUnique: autorizacaoFindUnique,
      create: autorizacaoCreate,
      update: autorizacaoUpdate,
    },
  } as any;
  const pinMock = { validarPinComLockout: validarPin } as any;
  const waMock = { enviarMensagem: waEnviarMensagem } as any;

  const service = new AutorizacaoTokenFamiliarService(prismaMock, pinMock, waMock);

  const PAGADOR = { id: 'pagador-1', nomeCompleto: 'Esposa', telefone: '5527999998888' };
  const TITULAR = { id: 'titular-1', nomeCompleto: 'Marido', telefone: '5527999997777' };

  beforeEach(() => {
    jest.clearAllMocks();
    validarPin.mockResolvedValue({ ok: true });
    waEnviarMensagem.mockResolvedValue({ enviado: true });
    autorizacaoCreate.mockImplementation(({ data }) => Promise.resolve({ id: 'aut-1', ...data }));
    autorizacaoUpdate.mockImplementation(({ data }) => Promise.resolve({ id: 'aut-1', ...data }));
  });

  // ═══ criar ═══════════════════════════════════════════════════════════
  describe('criar', () => {
    beforeEach(() => {
      cooperadoFindFirst
        .mockImplementationOnce(async () => PAGADOR)   // pagador
        .mockImplementationOnce(async () => TITULAR);  // titular
      autorizacaoFindUnique.mockResolvedValue(null);   // sem existente
    });

    it('caminho feliz: cria autorização inativa + notifica titular + multi-tenant ambos lados', async () => {
      const r = await service.criar({
        cooperadoPagadorId: 'pagador-1',
        cooperadoTitularId: 'titular-1',
        cooperativaId: 'tenant-A',
        pinPagador: '123456',
      });

      expect(r.id).toBe('aut-1');
      expect(autorizacaoCreate).toHaveBeenCalledWith({
        data: expect.objectContaining({
          cooperativaId: 'tenant-A',
          cooperadoPagadorId: 'pagador-1',
          cooperadoTitularId: 'titular-1',
          ativo: false,
        }),
      });
      expect(waEnviarMensagem).toHaveBeenCalledWith(
        TITULAR.telefone,
        expect.stringContaining('Autorização familiar solicitada'),
        expect.objectContaining({
          tipoDisparo: 'AUTORIZACAO_FAMILIAR_SOLICITADA',
          cooperativaId: 'tenant-A',
        }),
      );
    });

    it('pagador == titular → BadRequestException', async () => {
      await expect(
        service.criar({
          cooperadoPagadorId: 'x',
          cooperadoTitularId: 'x',
          cooperativaId: 'tenant-A',
          pinPagador: '123456',
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('PIN inválido (regex) → BadRequestException', async () => {
      await expect(
        service.criar({
          cooperadoPagadorId: 'pagador-1',
          cooperadoTitularId: 'titular-1',
          cooperativaId: 'tenant-A',
          pinPagador: 'abc',
        }),
      ).rejects.toThrow(/PIN obrigatório/);
    });

    it('pagador em outro tenant → NotFoundException (multi-tenant M45)', async () => {
      cooperadoFindFirst
        .mockReset()
        .mockImplementationOnce(async () => null)
        .mockImplementationOnce(async () => TITULAR);
      await expect(
        service.criar({
          cooperadoPagadorId: 'pagador-x',
          cooperadoTitularId: 'titular-1',
          cooperativaId: 'tenant-A',
          pinPagador: '123456',
        }),
      ).rejects.toThrow(NotFoundException);
    });

    it('titular em outro tenant → CrossTenantError (esposa.coop != marido.coop)', async () => {
      cooperadoFindFirst
        .mockReset()
        .mockImplementationOnce(async () => PAGADOR)
        .mockImplementationOnce(async () => null);
      await expect(
        service.criar({
          cooperadoPagadorId: 'pagador-1',
          cooperadoTitularId: 'titular-de-outra-coop',
          cooperativaId: 'tenant-A',
          pinPagador: '123456',
        }),
      ).rejects.toThrow(CrossTenantError);
    });

    it('PIN incorreto → ForbiddenException', async () => {
      validarPin.mockResolvedValue({ ok: false, motivo: 'PIN_INCORRETO' });
      await expect(
        service.criar({
          cooperadoPagadorId: 'pagador-1',
          cooperadoTitularId: 'titular-1',
          cooperativaId: 'tenant-A',
          pinPagador: '123456',
        }),
      ).rejects.toThrow(ForbiddenException);
    });

    it('idempotência: autorização ativa existente → AutorizacaoConflitoError', async () => {
      autorizacaoFindUnique.mockResolvedValue({
        id: 'aut-existente',
        cooperativaId: 'tenant-A',
        ativo: true,
        revogadoEm: null,
        confirmadoTitularEm: new Date(),
      });
      await expect(
        service.criar({
          cooperadoPagadorId: 'pagador-1',
          cooperadoTitularId: 'titular-1',
          cooperativaId: 'tenant-A',
          pinPagador: '123456',
        }),
      ).rejects.toThrow(AutorizacaoConflitoError);
    });

    it('autorização revogada anterior → recria via update (reset confirmadoTitular + revogadoEm)', async () => {
      autorizacaoFindUnique.mockResolvedValue({
        id: 'aut-velha',
        cooperativaId: 'tenant-A',
        ativo: false,
        revogadoEm: new Date(),
        confirmadoTitularEm: new Date(),
      });
      await service.criar({
        cooperadoPagadorId: 'pagador-1',
        cooperadoTitularId: 'titular-1',
        cooperativaId: 'tenant-A',
        pinPagador: '123456',
      });
      // P1-mtenant fix 22/06 — recriar agora usa where { id, cooperativaId }
      expect(autorizacaoUpdate).toHaveBeenCalledWith({
        where: { id: 'aut-velha', cooperativaId: 'tenant-A' },
        data: expect.objectContaining({
          confirmadoTitularEm: null,
          ativo: false,
          revogadoEm: null,
        }),
      });
      expect(autorizacaoCreate).not.toHaveBeenCalled();
    });

    // P1-mtenant fix 22/06 — idempotência cross-tenant: findUnique pelo
    // @@unique global retornaria record de outro tenant → service detecta
    // via cooperativaId mismatch e lança CrossTenantError.
    it('par pagador+titular existe em outro tenant → CrossTenantError', async () => {
      autorizacaoFindUnique.mockResolvedValue({
        id: 'aut-outro-tenant',
        cooperativaId: 'tenant-OUTRO',
        ativo: true,
        revogadoEm: null,
        confirmadoTitularEm: new Date(),
      });
      await expect(
        service.criar({
          cooperadoPagadorId: 'pagador-1',
          cooperadoTitularId: 'titular-1',
          cooperativaId: 'tenant-A',
          pinPagador: '123456',
        }),
      ).rejects.toThrow(CrossTenantError);
    });
  });

  // ═══ confirmarTitular ═══════════════════════════════════════════════
  describe('confirmarTitular', () => {
    beforeEach(() => {
      autorizacaoFindFirst.mockResolvedValue({
        id: 'aut-1',
        cooperadoPagadorId: 'pagador-1',
        cooperadoTitularId: 'titular-1',
        confirmadoTitularEm: null,
        revogadoEm: null,
        ativo: false,
        cooperadoPagador: PAGADOR,
      });
      cooperadoFindUnique.mockResolvedValue(TITULAR);
    });

    it('caminho feliz sem PIN (Q2 — aceite autenticado): ativo=true', async () => {
      const r = await service.confirmarTitular({
        autorizacaoId: 'aut-1',
        cooperadoTitularId: 'titular-1',
        cooperativaId: 'tenant-A',
      });
      expect(r.ativo).toBe(true);
      expect(r.confirmadoTitularEm).toBeInstanceOf(Date);
      expect(validarPin).not.toHaveBeenCalled();
      expect(waEnviarMensagem).toHaveBeenCalledWith(
        PAGADOR.telefone,
        expect.stringContaining('Autorização familiar ativa'),
        expect.objectContaining({
          tipoDisparo: 'AUTORIZACAO_FAMILIAR_CONFIRMADA',
        }),
      );
    });

    it('PIN passado → valida', async () => {
      await service.confirmarTitular({
        autorizacaoId: 'aut-1',
        cooperadoTitularId: 'titular-1',
        cooperativaId: 'tenant-A',
        pinTitular: '654321',
      });
      expect(validarPin).toHaveBeenCalled();
    });

    it('PIN não definido (NÃO trava): aceita autenticado', async () => {
      validarPin.mockResolvedValue({ ok: false, motivo: 'PIN_NAO_DEFINIDO' });
      const r = await service.confirmarTitular({
        autorizacaoId: 'aut-1',
        cooperadoTitularId: 'titular-1',
        cooperativaId: 'tenant-A',
        pinTitular: '654321',
      });
      expect(r.ativo).toBe(true);
    });

    it('PIN incorreto explícito → ForbiddenException', async () => {
      validarPin.mockResolvedValue({ ok: false, motivo: 'PIN_INCORRETO' });
      await expect(
        service.confirmarTitular({
          autorizacaoId: 'aut-1',
          cooperadoTitularId: 'titular-1',
          cooperativaId: 'tenant-A',
          pinTitular: '999999',
        }),
      ).rejects.toThrow(ForbiddenException);
    });

    // P3-B reviewer 22/06 — cobre branch PIN_BLOQUEADO em confirmar.
    it('PIN bloqueado → ForbiddenException com data de desbloqueio', async () => {
      const desbloqueiaEm = new Date('2030-01-01');
      validarPin.mockResolvedValue({
        ok: false,
        motivo: 'PIN_BLOQUEADO',
        desbloqueiaEm,
      });
      await expect(
        service.confirmarTitular({
          autorizacaoId: 'aut-1',
          cooperadoTitularId: 'titular-1',
          cooperativaId: 'tenant-A',
          pinTitular: '654321',
        }),
      ).rejects.toThrow(ForbiddenException);
    });

    it('autorização inexistente OU outro tenant → AutorizacaoNaoEncontradaError', async () => {
      autorizacaoFindFirst.mockResolvedValue(null);
      await expect(
        service.confirmarTitular({
          autorizacaoId: 'aut-fake',
          cooperadoTitularId: 'titular-1',
          cooperativaId: 'tenant-A',
        }),
      ).rejects.toThrow(AutorizacaoNaoEncontradaError);
    });

    it('autorização já revogada → AutorizacaoConflitoError', async () => {
      autorizacaoFindFirst.mockResolvedValue({
        id: 'aut-1', cooperadoPagadorId: 'p', cooperadoTitularId: 't',
        confirmadoTitularEm: null, revogadoEm: new Date(), ativo: false,
        cooperadoPagador: PAGADOR,
      });
      await expect(
        service.confirmarTitular({
          autorizacaoId: 'aut-1',
          cooperadoTitularId: 'titular-1',
          cooperativaId: 'tenant-A',
        }),
      ).rejects.toThrow(AutorizacaoConflitoError);
    });

    it('já confirmada → AutorizacaoConflitoError', async () => {
      autorizacaoFindFirst.mockResolvedValue({
        id: 'aut-1', cooperadoPagadorId: 'p', cooperadoTitularId: 't',
        confirmadoTitularEm: new Date(), revogadoEm: null, ativo: true,
        cooperadoPagador: PAGADOR,
      });
      await expect(
        service.confirmarTitular({
          autorizacaoId: 'aut-1',
          cooperadoTitularId: 'titular-1',
          cooperativaId: 'tenant-A',
        }),
      ).rejects.toThrow(/já foi confirmada/);
    });
  });

  // ═══ revogar ════════════════════════════════════════════════════════
  describe('revogar', () => {
    const autorizacaoAtiva = {
      id: 'aut-1',
      cooperadoPagadorId: 'pagador-1',
      cooperadoTitularId: 'titular-1',
      ativo: true,
      revogadoEm: null,
      cooperadoPagador: PAGADOR,
      cooperadoTitular: TITULAR,
    };

    beforeEach(() => {
      autorizacaoFindFirst.mockResolvedValue(autorizacaoAtiva);
    });

    it('pagador revoga unilateral → ativo=false + notifica TITULAR (Q3+Q4)', async () => {
      await service.revogar({
        autorizacaoId: 'aut-1',
        cooperadoRevogadorId: 'pagador-1',
        cooperativaId: 'tenant-A',
        motivo: 'mudei de ideia',
      });
      expect(autorizacaoUpdate).toHaveBeenCalledWith({
        where: { id: 'aut-1', cooperativaId: 'tenant-A' },
        data: expect.objectContaining({
          ativo: false,
          revogadoPorCooperadoId: 'pagador-1',
          motivoRevogacao: 'mudei de ideia',
        }),
      });
      expect(waEnviarMensagem).toHaveBeenCalledWith(
        TITULAR.telefone,
        expect.stringContaining('revogou'),
        expect.objectContaining({
          tipoDisparo: 'AUTORIZACAO_FAMILIAR_REVOGADA',
        }),
      );
    });

    it('titular revoga unilateral → ativo=false + notifica PAGADOR', async () => {
      await service.revogar({
        autorizacaoId: 'aut-1',
        cooperadoRevogadorId: 'titular-1',
        cooperativaId: 'tenant-A',
      });
      expect(waEnviarMensagem).toHaveBeenCalledWith(
        PAGADOR.telefone,
        expect.any(String),
        expect.any(Object),
      );
    });

    it('terceiro tenta revogar → ForbiddenException', async () => {
      await expect(
        service.revogar({
          autorizacaoId: 'aut-1',
          cooperadoRevogadorId: 'estranho-1',
          cooperativaId: 'tenant-A',
        }),
      ).rejects.toThrow(ForbiddenException);
    });

    it('autorização já revogada → AutorizacaoConflitoError', async () => {
      autorizacaoFindFirst.mockResolvedValue({
        ...autorizacaoAtiva, revogadoEm: new Date(),
      });
      await expect(
        service.revogar({
          autorizacaoId: 'aut-1',
          cooperadoRevogadorId: 'pagador-1',
          cooperativaId: 'tenant-A',
        }),
      ).rejects.toThrow(AutorizacaoConflitoError);
    });

    it('outro tenant → AutorizacaoNaoEncontradaError', async () => {
      autorizacaoFindFirst.mockResolvedValue(null);
      await expect(
        service.revogar({
          autorizacaoId: 'aut-1',
          cooperadoRevogadorId: 'pagador-1',
          cooperativaId: 'tenant-X',
        }),
      ).rejects.toThrow(AutorizacaoNaoEncontradaError);
    });
  });
});
