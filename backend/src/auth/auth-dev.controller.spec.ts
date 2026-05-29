import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { AuthDevController } from './auth-dev.controller';
import { PerfilUsuario } from './perfil.enum';

/**
 * D-novo-BM (29/05/2026) — Specs de proteção do controller dev-only.
 *
 * Foco: garantir que defesa em camadas (`isAmbienteReal` + role + audit) bloqueia
 * uso indevido. Os guards `@Roles(SUPER_ADMIN)` + `@AuditLog` são globais
 * (testados nos seus próprios specs) — aqui validamos só o guard `isAmbienteReal`
 * runtime e o fluxo de impersonate.
 */
describe('AuthDevController — guards dev-only', () => {
  const usuarioFindMany = jest.fn();
  const usuarioFindUnique = jest.fn();
  const prismaMock = {
    usuario: { findMany: usuarioFindMany, findUnique: usuarioFindUnique },
  } as any;

  const assinarTokenImpersonate = jest.fn();
  const authServiceMock = { assinarTokenImpersonate } as any;

  let controller: AuthDevController;

  beforeEach(() => {
    jest.clearAllMocks();
    delete process.env.AMBIENTE_REAL;
    controller = new AuthDevController(authServiceMock, prismaMock);
  });

  afterAll(() => {
    delete process.env.AMBIENTE_REAL;
  });

  describe('GET /auth/dev/usuarios-teste', () => {
    it('DEV: retorna lista de usuários ativos', async () => {
      const lista = [
        { id: 'u1', nome: 'X', email: 'x@x.com', perfil: 'SUPER_ADMIN', cooperativaId: null, cooperativa: null },
      ];
      usuarioFindMany.mockResolvedValueOnce(lista);

      const r = await controller.listarUsuariosTeste();

      expect(r).toEqual(lista);
      expect(usuarioFindMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: { ativo: true } }),
      );
    });

    it('PROD (AMBIENTE_REAL=true): lança ForbiddenException', async () => {
      process.env.AMBIENTE_REAL = 'true';

      await expect(controller.listarUsuariosTeste()).rejects.toThrow(ForbiddenException);
      expect(usuarioFindMany).not.toHaveBeenCalled();
    });
  });

  describe('POST /auth/dev/impersonate', () => {
    const reqSA: any = { user: { email: 'sa@cooperebr.com.br', perfil: 'SUPER_ADMIN' } };

    it('DEV: gera JWT impersonado pra usuário ativo', async () => {
      usuarioFindUnique.mockResolvedValueOnce({
        id: 'u1',
        nome: 'Admin CoopereBR',
        email: 'admin@cooperebr.com.br',
        perfil: PerfilUsuario.ADMIN,
        cpf: null,
        cooperativaId: 'coop-A',
        administradoraId: null,
        ativo: true,
      });
      assinarTokenImpersonate.mockResolvedValueOnce('jwt-mock-8h');

      const r = await controller.impersonate({ userId: 'u1' }, reqSA);

      expect(r.token).toBe('jwt-mock-8h');
      expect(r.usuario).toMatchObject({ id: 'u1', perfil: PerfilUsuario.ADMIN, cooperativaId: 'coop-A' });
      expect(r.expiresIn).toBe('8h');
      expect(r.impersonadoPor).toBe('sa@cooperebr.com.br');
      expect(assinarTokenImpersonate).toHaveBeenCalledWith(
        expect.objectContaining({ id: 'u1', email: 'admin@cooperebr.com.br' }),
      );
    });

    it('PROD (AMBIENTE_REAL=true): lança ForbiddenException antes de qualquer query', async () => {
      process.env.AMBIENTE_REAL = 'true';

      await expect(controller.impersonate({ userId: 'u1' }, reqSA)).rejects.toThrow(
        ForbiddenException,
      );
      expect(usuarioFindUnique).not.toHaveBeenCalled();
      expect(assinarTokenImpersonate).not.toHaveBeenCalled();
    });

    it('Usuário-alvo inexistente: NotFoundException', async () => {
      usuarioFindUnique.mockResolvedValueOnce(null);

      await expect(controller.impersonate({ userId: 'nao-existe' }, reqSA)).rejects.toThrow(
        NotFoundException,
      );
      expect(assinarTokenImpersonate).not.toHaveBeenCalled();
    });

    it('Usuário-alvo inativo: ForbiddenException', async () => {
      usuarioFindUnique.mockResolvedValueOnce({
        id: 'u2',
        nome: 'Inativo',
        email: 'inativo@x.com',
        perfil: PerfilUsuario.ADMIN,
        cpf: null,
        cooperativaId: null,
        administradoraId: null,
        ativo: false,
      });

      await expect(controller.impersonate({ userId: 'u2' }, reqSA)).rejects.toThrow(
        ForbiddenException,
      );
      expect(assinarTokenImpersonate).not.toHaveBeenCalled();
    });

    it('userId ausente no body: ForbiddenException', async () => {
      await expect(controller.impersonate({} as any, reqSA)).rejects.toThrow(ForbiddenException);
      expect(usuarioFindUnique).not.toHaveBeenCalled();
    });
  });
});
