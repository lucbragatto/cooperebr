import { ForbiddenException } from '@nestjs/common';
import { CooperativasController } from './cooperativas.controller';
import { PerfilUsuario } from '../auth/perfil.enum';

/**
 * Specs focados em isolamento multi-tenant (proteção IDOR).
 *
 * Cobre 3 endpoints representativos (GET, PATCH, PUT) — todos usam o mesmo
 * helper `assertSameTenantOrSuperAdmin`. Demais endpoints vulneráveis
 * (GET /:id/painel-parceiro, GET /:id/qrcode, GET /financeiro/:id) seguem
 * o mesmo padrão e são cobertos pelo spec do helper isolado.
 */
describe('CooperativasController — multi-tenant guard (IDOR)', () => {
  const findOneMock = jest.fn();
  const updateMock = jest.fn();
  const updateFinanceiroMock = jest.fn();

  const toggleVeDespesasMock = jest.fn();
  const serviceMock = {
    findOne: findOneMock,
    update: updateMock,
    updateFinanceiro: updateFinanceiroMock,
    toggleProprietarioVeDespesas: toggleVeDespesasMock,
  } as any;

  let controller: CooperativasController;

  beforeEach(() => {
    jest.clearAllMocks();
    controller = new CooperativasController(serviceMock);
  });

  describe('GET /cooperativas/:id (findOne)', () => {
    it('SUPER_ADMIN acessa qualquer cooperativa', async () => {
      findOneMock.mockResolvedValue({ id: 'coop-B' });
      const req = { user: { perfil: PerfilUsuario.SUPER_ADMIN, cooperativaId: 'coop-A' } };

      const r = await controller.findOne('coop-B', req);

      expect(r).toEqual({ id: 'coop-B' });
      expect(findOneMock).toHaveBeenCalledWith('coop-B');
    });

    it('ADMIN acessa a própria cooperativa', async () => {
      findOneMock.mockResolvedValue({ id: 'coop-A' });
      const req = { user: { perfil: PerfilUsuario.ADMIN, cooperativaId: 'coop-A' } };

      const r = await controller.findOne('coop-A', req);

      expect(r).toEqual({ id: 'coop-A' });
    });

    it('ADMIN tentando acessar outra cooperativa lança ForbiddenException', () => {
      const req = { user: { perfil: PerfilUsuario.ADMIN, cooperativaId: 'coop-A' } };

      expect(() => controller.findOne('coop-B', req)).toThrow(ForbiddenException);
      expect(findOneMock).not.toHaveBeenCalled();
    });
  });

  describe('PATCH /cooperativas/financeiro/:id (updateFinanceiro)', () => {
    it('SUPER_ADMIN edita config financeira de qualquer', () => {
      const req = { user: { perfil: PerfilUsuario.SUPER_ADMIN, cooperativaId: 'coop-A' } };

      controller.updateFinanceiro('coop-B', { multaAtraso: 2 }, req);

      expect(updateFinanceiroMock).toHaveBeenCalledWith('coop-B', { multaAtraso: 2 });
    });

    it('ADMIN tentando editar config financeira de outra cooperativa lança ForbiddenException', () => {
      const req = { user: { perfil: PerfilUsuario.ADMIN, cooperativaId: 'coop-A' } };

      expect(() =>
        controller.updateFinanceiro('coop-B', { multaAtraso: 99 }, req),
      ).toThrow(ForbiddenException);
      expect(updateFinanceiroMock).not.toHaveBeenCalled();
    });
  });

  describe('PUT /cooperativas/:id (update)', () => {
    it('ADMIN edita a própria cooperativa', () => {
      const req = { user: { perfil: PerfilUsuario.ADMIN, cooperativaId: 'coop-A' } };

      controller.update('coop-A', { nome: 'Novo Nome' }, req);

      expect(updateMock).toHaveBeenCalledWith('coop-A', { nome: 'Novo Nome' });
    });

    it('ADMIN tentando editar dados de outra cooperativa lança ForbiddenException', () => {
      const req = { user: { perfil: PerfilUsuario.ADMIN, cooperativaId: 'coop-A' } };

      expect(() =>
        controller.update('coop-B', { ativo: false, nome: 'Hackeada' }, req),
      ).toThrow(ForbiddenException);
      expect(updateMock).not.toHaveBeenCalled();
    });

    it('OPERADOR não tem acesso mesmo na própria cooperativa', () => {
      const req = { user: { perfil: PerfilUsuario.OPERADOR, cooperativaId: 'coop-A' } };

      expect(() => controller.update('coop-A', { nome: 'X' }, req)).toThrow(ForbiddenException);
      expect(updateMock).not.toHaveBeenCalled();
    });
  });

  // BH.4 (M37, 29/05/2026) — D-novo-BH flag visibilidade portal proprietário
  describe('PUT /cooperativas/:id/proprietario-ve-despesas (BH.4)', () => {
    it('ADMIN toggla a própria cooperativa', async () => {
      const req = { user: { perfil: PerfilUsuario.ADMIN, cooperativaId: 'coop-A' } };
      await controller.toggleProprietarioVeDespesas('coop-A', { ativo: false }, req);
      expect(toggleVeDespesasMock).toHaveBeenCalledWith('coop-A', false);
    });

    it('ADMIN tentando alterar OUTRA cooperativa → ForbiddenException', async () => {
      const req = { user: { perfil: PerfilUsuario.ADMIN, cooperativaId: 'coop-A' } };
      await expect(
        controller.toggleProprietarioVeDespesas('coop-B', { ativo: true }, req),
      ).rejects.toThrow(ForbiddenException);
      expect(toggleVeDespesasMock).not.toHaveBeenCalled();
    });

    it('SUPER_ADMIN toggla qualquer cooperativa', async () => {
      const req = { user: { perfil: PerfilUsuario.SUPER_ADMIN } };
      await controller.toggleProprietarioVeDespesas('coop-X', { ativo: true }, req);
      expect(toggleVeDespesasMock).toHaveBeenCalledWith('coop-X', true);
    });
  });
});
