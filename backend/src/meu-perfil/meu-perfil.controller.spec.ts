/**
 * F1 (09/06/2026) — Specs do MeuPerfilController (PIN inicial pelo portal).
 *
 * - GET  /meu-perfil/pin-status -> {temPin}
 * - POST /meu-perfil/definir-pin -> bloqueia 409 se ja existe; valida 6 digitos
 *   + isPinFraco; checa pin===pinConfirmacao; cooperadoId+cooperativaId SEMPRE
 *   do JWT (anti-IDOR multi-tenant — nunca aceita do body).
 */
import { BadRequestException, ConflictException, ForbiddenException } from '@nestjs/common';
import { MeuPerfilController } from './meu-perfil.controller';

const fakePinSvc = {
  temPin: jest.fn(),
  definirPin: jest.fn(),
};

describe('MeuPerfilController — F1 PIN inicial', () => {
  let ctl: MeuPerfilController;

  beforeEach(() => {
    jest.clearAllMocks();
    ctl = new MeuPerfilController(fakePinSvc as any);
  });

  describe('GET /pin-status', () => {
    it('retorna {temPin: true} quando cooperado ja tem PIN', async () => {
      fakePinSvc.temPin.mockResolvedValueOnce(true);
      const r = await ctl.pinStatus({ cooperadoId: 'c1', cooperativaId: 't1' });
      expect(r).toEqual({ temPin: true });
      expect(fakePinSvc.temPin).toHaveBeenCalledWith({
        cooperadoId: 'c1',
        cooperativaId: 't1',
      });
    });

    it('retorna {temPin: false} quando ainda nao tem', async () => {
      fakePinSvc.temPin.mockResolvedValueOnce(false);
      const r = await ctl.pinStatus({ cooperadoId: 'c1', cooperativaId: 't1' });
      expect(r).toEqual({ temPin: false });
    });

    it('Forbidden se JWT sem cooperadoId', async () => {
      await expect(
        ctl.pinStatus({ cooperativaId: 't1' }),
      ).rejects.toThrow(ForbiddenException);
    });

    it('Forbidden se JWT sem cooperativaId', async () => {
      await expect(
        ctl.pinStatus({ cooperadoId: 'c1' }),
      ).rejects.toThrow(ForbiddenException);
    });
  });

  describe('POST /definir-pin', () => {
    it('cria PIN OK quando 6 digitos validos + sem PIN prévio + confirmacao bate', async () => {
      fakePinSvc.temPin.mockResolvedValueOnce(false);
      fakePinSvc.definirPin.mockResolvedValueOnce(undefined);

      const r = await ctl.definirPin(
        { cooperadoId: 'c1', cooperativaId: 't1' },
        { pin: '482173', pinConfirmacao: '482173' },
      );

      expect(r).toEqual({ sucesso: true });
      expect(fakePinSvc.definirPin).toHaveBeenCalledWith({
        cooperadoId: 'c1',
        pin: '482173',
        cooperativaId: 't1',
      });
    });

    it('Conflict 409 quando cooperado ja tem PIN', async () => {
      fakePinSvc.temPin.mockResolvedValueOnce(true);
      await expect(
        ctl.definirPin(
          { cooperadoId: 'c1', cooperativaId: 't1' },
          { pin: '482173', pinConfirmacao: '482173' },
        ),
      ).rejects.toThrow(ConflictException);
      expect(fakePinSvc.definirPin).not.toHaveBeenCalled();
    });

    it('BadRequest quando pin !== pinConfirmacao', async () => {
      await expect(
        ctl.definirPin(
          { cooperadoId: 'c1', cooperativaId: 't1' },
          { pin: '482173', pinConfirmacao: '482174' },
        ),
      ).rejects.toThrow(BadRequestException);
      expect(fakePinSvc.temPin).not.toHaveBeenCalled();
      expect(fakePinSvc.definirPin).not.toHaveBeenCalled();
    });

    it('BadRequest quando PIN eh fraco (6 iguais)', async () => {
      await expect(
        ctl.definirPin(
          { cooperadoId: 'c1', cooperativaId: 't1' },
          { pin: '111111', pinConfirmacao: '111111' },
        ),
      ).rejects.toThrow(BadRequestException);
      expect(fakePinSvc.temPin).not.toHaveBeenCalled();
      expect(fakePinSvc.definirPin).not.toHaveBeenCalled();
    });

    it('BadRequest quando PIN eh fraco (sequencia 123456)', async () => {
      await expect(
        ctl.definirPin(
          { cooperadoId: 'c1', cooperativaId: 't1' },
          { pin: '123456', pinConfirmacao: '123456' },
        ),
      ).rejects.toThrow(BadRequestException);
    });

    it('BadRequest quando PIN eh fraco (sequencia 987654)', async () => {
      await expect(
        ctl.definirPin(
          { cooperadoId: 'c1', cooperativaId: 't1' },
          { pin: '987654', pinConfirmacao: '987654' },
        ),
      ).rejects.toThrow(BadRequestException);
    });

    it('Forbidden se JWT sem cooperadoId (anti-IDOR multi-tenant)', async () => {
      await expect(
        ctl.definirPin(
          { cooperativaId: 't1' },
          { pin: '482173', pinConfirmacao: '482173' },
        ),
      ).rejects.toThrow(ForbiddenException);
      expect(fakePinSvc.definirPin).not.toHaveBeenCalled();
    });

    it('cooperadoId e cooperativaId vem do JWT — NUNCA do body', async () => {
      fakePinSvc.temPin.mockResolvedValueOnce(false);
      fakePinSvc.definirPin.mockResolvedValueOnce(undefined);

      // Mesmo se o body tentasse passar cooperadoId/cooperativaId estranhos,
      // o DTO nao deixa (so pin/pinConfirmacao); E o controller usa SO o
      // CurrentUser. Spec confirma comportamento.
      await ctl.definirPin(
        { cooperadoId: 'c-jwt', cooperativaId: 't-jwt' },
        { pin: '273981', pinConfirmacao: '273981' },
      );

      expect(fakePinSvc.definirPin).toHaveBeenCalledWith({
        cooperadoId: 'c-jwt',
        pin: '273981',
        cooperativaId: 't-jwt',
      });
    });
  });
});
