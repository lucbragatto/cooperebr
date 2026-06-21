import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { CooperadosController } from './cooperados.controller';
import { PerfilUsuario } from '../auth/perfil.enum';

/**
 * Sprint Hardening Tenant-Spoof (20/06/2026) —
 * D-novo-COOPERADOS-CONTROLLER-TENANT-SPOOF P0.
 *
 * Garante que POST /cooperados:
 * - SEMPRE descarta `body.cooperativaId` (compat-only, ignorado);
 * - resolve tenant a partir do JWT (`req.user.cooperativaId`);
 * - permite SUPER_ADMIN cross-tenant SÓ via `body.cooperativaIdAlvo`
 *   VALIDADO contra Cooperativa.findUnique + ativo (P1 reviewers);
 * - lança ForbiddenException quando tenant não pode ser resolvido;
 * - preserva o fluxo legítimo AGREGADOR (administradoraId do JWT).
 */
describe('CooperadosController — D-novo-COOPERADOS-CONTROLLER-TENANT-SPOOF P0', () => {
  const serviceCreate = jest.fn();
  const cooperativaFindUnique = jest.fn();

  const prismaMock = {
    cooperativa: { findUnique: cooperativaFindUnique },
  } as any;

  const controller = new CooperadosController(
    { create: serviceCreate } as any,
    prismaMock,
    {} as any, {} as any, {} as any,
  );

  const bodyBase = {
    nomeCompleto: 'Fulano de Tal',
    cpf: '12345678900',
    email: 'fulano@example.com',
  };

  beforeEach(() => {
    jest.clearAllMocks();
    serviceCreate.mockResolvedValue({ id: 'coop-novo' });
  });

  it('ADMIN: cria no próprio tenant (JWT) ignorando body.cooperativaId malicioso', async () => {
    const req = { user: { perfil: PerfilUsuario.ADMIN, cooperativaId: 'tenant-A' } };
    const body = { ...bodyBase, cooperativaId: 'tenant-B-MALICIOSO' } as any;

    await controller.create(body, req as any);

    expect(serviceCreate).toHaveBeenCalledTimes(1);
    const arg = serviceCreate.mock.calls[0][0];
    expect(arg.cooperativaId).toBe('tenant-A');
    expect(arg.cooperativaId).not.toBe('tenant-B-MALICIOSO');
    expect(cooperativaFindUnique).not.toHaveBeenCalled();
  });

  it('OPERADOR: idem ADMIN — JWT manda, body é descartado', async () => {
    const req = { user: { perfil: PerfilUsuario.OPERADOR, cooperativaId: 'tenant-A' } };
    const body = { ...bodyBase, cooperativaId: 'tenant-Z' } as any;

    await controller.create(body, req as any);

    const arg = serviceCreate.mock.calls[0][0];
    expect(arg.cooperativaId).toBe('tenant-A');
  });

  it('SUPER_ADMIN: cria cross-tenant via cooperativaIdAlvo (validado contra Cooperativa.ativo)', async () => {
    cooperativaFindUnique.mockResolvedValue({ id: 'tenant-alvo', ativo: true });
    const req = { user: { perfil: PerfilUsuario.SUPER_ADMIN, cooperativaId: undefined } };
    const body = { ...bodyBase, cooperativaIdAlvo: 'tenant-alvo' } as any;

    await controller.create(body, req as any);

    expect(cooperativaFindUnique).toHaveBeenCalledWith({
      where: { id: 'tenant-alvo' },
      select: { id: true, ativo: true },
    });
    const arg = serviceCreate.mock.calls[0][0];
    expect(arg.cooperativaId).toBe('tenant-alvo');
  });

  it('SUPER_ADMIN: cooperativaIdAlvo inexistente → BadRequestException', async () => {
    cooperativaFindUnique.mockResolvedValue(null);
    const req = { user: { perfil: PerfilUsuario.SUPER_ADMIN, cooperativaId: undefined } };
    const body = { ...bodyBase, cooperativaIdAlvo: 'cooperativa-fake' } as any;

    await expect(controller.create(body, req as any)).rejects.toThrow(BadRequestException);
    expect(serviceCreate).not.toHaveBeenCalled();
  });

  it('SUPER_ADMIN: cooperativaIdAlvo inativa → BadRequestException (não cria órfão)', async () => {
    cooperativaFindUnique.mockResolvedValue({ id: 'tenant-suspenso', ativo: false });
    const req = { user: { perfil: PerfilUsuario.SUPER_ADMIN, cooperativaId: undefined } };
    const body = { ...bodyBase, cooperativaIdAlvo: 'tenant-suspenso' } as any;

    await expect(controller.create(body, req as any)).rejects.toThrow(BadRequestException);
    expect(serviceCreate).not.toHaveBeenCalled();
  });

  it('SUPER_ADMIN: body.cooperativaId malicioso continua descartado, mesmo com cooperativaIdAlvo', async () => {
    cooperativaFindUnique.mockResolvedValue({ id: 'tenant-alvo', ativo: true });
    const req = { user: { perfil: PerfilUsuario.SUPER_ADMIN, cooperativaId: undefined } };
    const body = { ...bodyBase, cooperativaId: 'tenant-spoof', cooperativaIdAlvo: 'tenant-alvo' } as any;

    await controller.create(body, req as any);

    const arg = serviceCreate.mock.calls[0][0];
    expect(arg.cooperativaId).toBe('tenant-alvo');
  });

  it('ADMIN: cooperativaIdAlvo é IGNORADO (só SA escala) — não consulta Prisma', async () => {
    const req = { user: { perfil: PerfilUsuario.ADMIN, cooperativaId: 'tenant-A' } };
    const body = { ...bodyBase, cooperativaIdAlvo: 'tenant-Z' } as any;

    await controller.create(body, req as any);

    const arg = serviceCreate.mock.calls[0][0];
    expect(arg.cooperativaId).toBe('tenant-A');
    expect(cooperativaFindUnique).not.toHaveBeenCalled();
  });

  it('Tenant não resolvível: ForbiddenException', async () => {
    const req = { user: { perfil: PerfilUsuario.ADMIN, cooperativaId: undefined } };
    const body = { ...bodyBase, cooperativaId: 'tenant-X' } as any;

    await expect(controller.create(body, req as any)).rejects.toThrow(ForbiddenException);
    expect(serviceCreate).not.toHaveBeenCalled();
  });

  it('AGREGADOR: tenant vem do JWT (derivado da Administradora) + administradoraId propagado', async () => {
    const req = {
      user: {
        perfil: PerfilUsuario.AGREGADOR,
        cooperativaId: 'tenant-da-administradora',
        administradoraId: 'adm-1',
      },
    };
    const body = { ...bodyBase, cooperativaId: 'tenant-spoof' } as any;

    await controller.create(body, req as any);

    const arg = serviceCreate.mock.calls[0][0];
    expect(arg.cooperativaId).toBe('tenant-da-administradora');
    expect(arg.administradoraId).toBe('adm-1');
  });
});
