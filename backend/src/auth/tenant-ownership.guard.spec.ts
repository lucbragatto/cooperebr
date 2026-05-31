import {
  BadRequestException,
  ExecutionContext,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { PerfilUsuario } from './perfil.enum';
import { IS_PUBLIC_KEY } from './public.decorator';
import {
  TENANT_RESOURCE_KEY,
  TENANT_EXEMPT_KEY,
} from './tenant-resource.decorator';
import { TenantOwnershipGuard } from './tenant-ownership.guard';

/**
 * D-novo-BR F1.1 (31/05/2026) — Specs do TenantOwnershipGuard.
 *
 * Cobertura:
 *  - opt-in (sem @TenantResource → passa)
 *  - @Public skip + @TenantExempt skip
 *  - SUPER_ADMIN bypass
 *  - posse direta (ADMIN próprio passa / outro NotFound)
 *  - via relação (buildNestedWhere correto)
 *  - globalOnlySuperAdmin (recurso global ADMIN → Forbidden; SA passa)
 *  - id faltando → BadRequest
 *  - model inválido → BadRequest
 *  - ADMIN sem cooperativaId no token → Forbidden
 */
describe('TenantOwnershipGuard — F1.1', () => {
  let reflector: Reflector;
  let prismaMock: any;
  let guard: TenantOwnershipGuard;

  // helper pra simular ExecutionContext
  function ctxWith({
    user,
    params = {},
    metadata = {} as Record<string, any>,
  }: {
    user?: any;
    params?: Record<string, string>;
    metadata?: Record<string, any>;
  }): ExecutionContext {
    const req: any = { user, params };
    const handler = () => undefined;
    const cls = function MockClass() {};
    // injeta metadata via SetMetadata (Reflect)
    for (const [key, value] of Object.entries(metadata)) {
      Reflect.defineMetadata(key, value, handler);
    }
    return {
      switchToHttp: () => ({ getRequest: () => req }) as any,
      getHandler: () => handler,
      getClass: () => cls,
    } as any;
  }

  beforeEach(() => {
    reflector = new Reflector();
    prismaMock = {
      usina: { findFirst: jest.fn(), findUnique: jest.fn() },
      documentoCooperado: { findFirst: jest.fn() },
      modeloMensagem: { findFirst: jest.fn(), findUnique: jest.fn() },
    };
    guard = new TenantOwnershipGuard(reflector, prismaMock);
  });

  it('Sem @TenantResource → passa (opt-in não-quebrante)', async () => {
    const ctx = ctxWith({ user: { perfil: PerfilUsuario.ADMIN, cooperativaId: 'A' } });
    await expect(guard.canActivate(ctx)).resolves.toBe(true);
  });

  it('@Public → passa', async () => {
    const ctx = ctxWith({
      user: undefined,
      metadata: { [IS_PUBLIC_KEY]: true },
    });
    await expect(guard.canActivate(ctx)).resolves.toBe(true);
  });

  it('@TenantExempt → passa', async () => {
    const ctx = ctxWith({
      user: { perfil: PerfilUsuario.ADMIN, cooperativaId: 'A' },
      metadata: { [TENANT_EXEMPT_KEY]: true },
    });
    await expect(guard.canActivate(ctx)).resolves.toBe(true);
  });

  it('SUPER_ADMIN → bypass mesmo com @TenantResource', async () => {
    const ctx = ctxWith({
      user: { perfil: PerfilUsuario.SUPER_ADMIN, cooperativaId: null },
      params: { id: 'u1' },
      metadata: { [TENANT_RESOURCE_KEY]: { model: 'usina' } },
    });
    await expect(guard.canActivate(ctx)).resolves.toBe(true);
    expect(prismaMock.usina.findFirst).not.toHaveBeenCalled();
  });

  it('Posse direta — ADMIN próprio passa', async () => {
    prismaMock.usina.findFirst.mockResolvedValueOnce({ id: 'u1' });
    const ctx = ctxWith({
      user: { perfil: PerfilUsuario.ADMIN, cooperativaId: 'coop-A' },
      params: { id: 'u1' },
      metadata: { [TENANT_RESOURCE_KEY]: { model: 'usina' } },
    });
    await expect(guard.canActivate(ctx)).resolves.toBe(true);
    expect(prismaMock.usina.findFirst).toHaveBeenCalledWith({
      where: { id: 'u1', cooperativaId: 'coop-A' },
      select: { id: true },
    });
  });

  it('Posse direta — ADMIN outro tenant → NotFoundException', async () => {
    prismaMock.usina.findFirst.mockResolvedValueOnce(null);
    const ctx = ctxWith({
      user: { perfil: PerfilUsuario.ADMIN, cooperativaId: 'coop-B' },
      params: { id: 'u1' },
      metadata: { [TENANT_RESOURCE_KEY]: { model: 'usina' } },
    });
    await expect(guard.canActivate(ctx)).rejects.toThrow(NotFoundException);
  });

  it('Via relação — ADMIN próprio passa (buildNestedWhere aninhado)', async () => {
    prismaMock.documentoCooperado.findFirst.mockResolvedValueOnce({ id: 'd1' });
    const ctx = ctxWith({
      user: { perfil: PerfilUsuario.ADMIN, cooperativaId: 'coop-A' },
      params: { id: 'd1' },
      metadata: {
        [TENANT_RESOURCE_KEY]: { model: 'documentoCooperado', via: 'cooperado.cooperativaId' },
      },
    });
    await expect(guard.canActivate(ctx)).resolves.toBe(true);
    expect(prismaMock.documentoCooperado.findFirst).toHaveBeenCalledWith({
      where: { id: 'd1', cooperado: { cooperativaId: 'coop-A' } },
      select: { id: true },
    });
  });

  it('Via relação — outro tenant → NotFoundException', async () => {
    prismaMock.documentoCooperado.findFirst.mockResolvedValueOnce(null);
    const ctx = ctxWith({
      user: { perfil: PerfilUsuario.ADMIN, cooperativaId: 'coop-B' },
      params: { id: 'd1' },
      metadata: {
        [TENANT_RESOURCE_KEY]: { model: 'documentoCooperado', via: 'cooperado.cooperativaId' },
      },
    });
    await expect(guard.canActivate(ctx)).rejects.toThrow(NotFoundException);
  });

  it('globalOnlySuperAdmin — recurso GLOBAL (cooperativaId=null) + ADMIN → ForbiddenException', async () => {
    prismaMock.modeloMensagem.findUnique.mockResolvedValueOnce({ id: 'm1', cooperativaId: null });
    const ctx = ctxWith({
      user: { perfil: PerfilUsuario.ADMIN, cooperativaId: 'coop-A' },
      params: { id: 'm1' },
      metadata: {
        [TENANT_RESOURCE_KEY]: { model: 'modeloMensagem', globalOnlySuperAdmin: true },
      },
    });
    await expect(guard.canActivate(ctx)).rejects.toThrow(ForbiddenException);
  });

  it('globalOnlySuperAdmin — recurso GLOBAL + SUPER_ADMIN → passa (bypass antes do check)', async () => {
    const ctx = ctxWith({
      user: { perfil: PerfilUsuario.SUPER_ADMIN, cooperativaId: null },
      params: { id: 'm1' },
      metadata: {
        [TENANT_RESOURCE_KEY]: { model: 'modeloMensagem', globalOnlySuperAdmin: true },
      },
    });
    await expect(guard.canActivate(ctx)).resolves.toBe(true);
    expect(prismaMock.modeloMensagem.findUnique).not.toHaveBeenCalled();
  });

  it('globalOnlySuperAdmin — recurso tenant-scoped do ADMIN próprio → passa', async () => {
    prismaMock.modeloMensagem.findUnique.mockResolvedValueOnce({ id: 'm1', cooperativaId: 'coop-A' });
    const ctx = ctxWith({
      user: { perfil: PerfilUsuario.ADMIN, cooperativaId: 'coop-A' },
      params: { id: 'm1' },
      metadata: {
        [TENANT_RESOURCE_KEY]: { model: 'modeloMensagem', globalOnlySuperAdmin: true },
      },
    });
    await expect(guard.canActivate(ctx)).resolves.toBe(true);
  });

  it('globalOnlySuperAdmin — recurso tenant-scoped de outro tenant → NotFoundException', async () => {
    prismaMock.modeloMensagem.findUnique.mockResolvedValueOnce({ id: 'm1', cooperativaId: 'coop-A' });
    const ctx = ctxWith({
      user: { perfil: PerfilUsuario.ADMIN, cooperativaId: 'coop-B' },
      params: { id: 'm1' },
      metadata: {
        [TENANT_RESOURCE_KEY]: { model: 'modeloMensagem', globalOnlySuperAdmin: true },
      },
    });
    await expect(guard.canActivate(ctx)).rejects.toThrow(NotFoundException);
  });

  it('id faltando no param → BadRequestException', async () => {
    const ctx = ctxWith({
      user: { perfil: PerfilUsuario.ADMIN, cooperativaId: 'coop-A' },
      params: {},
      metadata: { [TENANT_RESOURCE_KEY]: { model: 'usina' } },
    });
    await expect(guard.canActivate(ctx)).rejects.toThrow(BadRequestException);
  });

  it('idParam customizado funciona', async () => {
    prismaMock.usina.findFirst.mockResolvedValueOnce({ id: 'u1' });
    const ctx = ctxWith({
      user: { perfil: PerfilUsuario.ADMIN, cooperativaId: 'coop-A' },
      params: { usinaId: 'u1' },
      metadata: { [TENANT_RESOURCE_KEY]: { model: 'usina', idParam: 'usinaId' } },
    });
    await expect(guard.canActivate(ctx)).resolves.toBe(true);
    expect(prismaMock.usina.findFirst).toHaveBeenCalledWith({
      where: { id: 'u1', cooperativaId: 'coop-A' },
      select: { id: true },
    });
  });

  it('model inválido (não existe no Prisma) → BadRequestException', async () => {
    const ctx = ctxWith({
      user: { perfil: PerfilUsuario.ADMIN, cooperativaId: 'coop-A' },
      params: { id: 'x' },
      metadata: { [TENANT_RESOURCE_KEY]: { model: 'modelInexistente' } },
    });
    await expect(guard.canActivate(ctx)).rejects.toThrow(BadRequestException);
  });

  it('ADMIN sem cooperativaId no token → ForbiddenException', async () => {
    const ctx = ctxWith({
      user: { perfil: PerfilUsuario.ADMIN },
      params: { id: 'u1' },
      metadata: { [TENANT_RESOURCE_KEY]: { model: 'usina' } },
    });
    await expect(guard.canActivate(ctx)).rejects.toThrow(ForbiddenException);
  });

  it('Sem user (não autenticado) → return false', async () => {
    const ctx = ctxWith({
      user: undefined,
      params: { id: 'u1' },
      metadata: { [TENANT_RESOURCE_KEY]: { model: 'usina' } },
    });
    await expect(guard.canActivate(ctx)).resolves.toBe(false);
  });
});
