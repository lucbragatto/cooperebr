/**
 * Sprint Portal Empresa 9.0 (04/06/2026) — Specs do PagadorCooperadoGuard.
 *
 * Cobre:
 *  1. Sem decorator → passa (não-quebrante).
 *  2. SUPER_ADMIN → bypass (debug/impersonate).
 *  3. Perfil ≠ EMPRESA_CONVENIADA → Forbidden.
 *  4. Sem email no token → Forbidden.
 *  5. Cooperado(email) não existe → Forbidden.
 *  6. :id sem path param → Forbidden.
 *  7. Convenio não existe → NotFound.
 *  8. Convenio existe mas pagadorCooperadoId ≠ cooperado.id → NotFound (não 403 — evita enumeração).
 *  9. Match completo → true + req.empresa anexado.
 */
import { ExecutionContext, ForbiddenException, NotFoundException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import {
  PagadorCooperadoGuard,
  PAGADOR_COOPERADO_KEY,
} from './pagador-cooperado.guard';
import { PerfilUsuario } from './perfil.enum';

describe('PagadorCooperadoGuard', () => {
  const reflector = { getAllAndOverride: jest.fn() } as unknown as Reflector;
  const findFirstCooperado = jest.fn();
  const findUniqueConvenio = jest.fn();
  const prisma = {
    cooperado: { findFirst: findFirstCooperado },
    contratoConvenio: { findUnique: findUniqueConvenio },
  } as any;

  let guard: PagadorCooperadoGuard;

  beforeEach(() => {
    jest.clearAllMocks();
    guard = new PagadorCooperadoGuard(reflector, prisma);
  });

  function buildCtx(req: any): ExecutionContext {
    return {
      switchToHttp: () => ({ getRequest: () => req }),
      getHandler: () => ({}),
      getClass: () => ({}),
    } as any;
  }

  it('sem decorator @PagadorCooperadoOnly → passa direto', async () => {
    (reflector.getAllAndOverride as jest.Mock).mockReturnValueOnce(undefined);
    const r = await guard.canActivate(buildCtx({ user: {} }));
    expect(r).toBe(true);
    expect(findFirstCooperado).not.toHaveBeenCalled();
  });

  it('SUPER_ADMIN bypassa o guard', async () => {
    (reflector.getAllAndOverride as jest.Mock).mockReturnValueOnce({});
    const r = await guard.canActivate(
      buildCtx({ user: { perfil: PerfilUsuario.SUPER_ADMIN, email: 'a@b.com' } }),
    );
    expect(r).toBe(true);
    expect(findFirstCooperado).not.toHaveBeenCalled();
  });

  it('perfil ≠ EMPRESA_CONVENIADA → Forbidden', async () => {
    (reflector.getAllAndOverride as jest.Mock).mockReturnValueOnce({});
    await expect(
      guard.canActivate(
        buildCtx({ user: { perfil: PerfilUsuario.ADMIN, email: 'a@b.com' } }),
      ),
    ).rejects.toThrow(ForbiddenException);
  });

  it('sem email no token → Forbidden', async () => {
    (reflector.getAllAndOverride as jest.Mock).mockReturnValueOnce({});
    await expect(
      guard.canActivate(
        buildCtx({ user: { perfil: PerfilUsuario.EMPRESA_CONVENIADA } }),
      ),
    ).rejects.toThrow(ForbiddenException);
  });

  it('cooperado por email não encontrado → Forbidden', async () => {
    (reflector.getAllAndOverride as jest.Mock).mockReturnValueOnce({});
    findFirstCooperado.mockResolvedValueOnce(null);
    await expect(
      guard.canActivate(
        buildCtx({
          user: { perfil: PerfilUsuario.EMPRESA_CONVENIADA, email: 'x@y.com' },
          params: { id: 'conv-1' },
        }),
      ),
    ).rejects.toThrow(ForbiddenException);
  });

  it('path sem param :id → Forbidden', async () => {
    (reflector.getAllAndOverride as jest.Mock).mockReturnValueOnce({});
    findFirstCooperado.mockResolvedValueOnce({ id: 'coop-1', cooperativaId: 'coop-A' });
    await expect(
      guard.canActivate(
        buildCtx({
          user: { perfil: PerfilUsuario.EMPRESA_CONVENIADA, email: 'x@y.com' },
          params: {},
        }),
      ),
    ).rejects.toThrow(ForbiddenException);
  });

  it('convênio inexistente → NotFound', async () => {
    (reflector.getAllAndOverride as jest.Mock).mockReturnValueOnce({});
    findFirstCooperado.mockResolvedValueOnce({ id: 'coop-1', cooperativaId: 'coop-A' });
    findUniqueConvenio.mockResolvedValueOnce(null);
    await expect(
      guard.canActivate(
        buildCtx({
          user: { perfil: PerfilUsuario.EMPRESA_CONVENIADA, email: 'x@y.com' },
          params: { id: 'conv-1' },
        }),
      ),
    ).rejects.toThrow(NotFoundException);
  });

  it('convênio existe mas pagadorCooperadoId ≠ cooperado → NotFound (evita enumeração)', async () => {
    (reflector.getAllAndOverride as jest.Mock).mockReturnValueOnce({});
    findFirstCooperado.mockResolvedValueOnce({ id: 'coop-1', cooperativaId: 'coop-A' });
    findUniqueConvenio.mockResolvedValueOnce({
      id: 'conv-1',
      pagadorCooperadoId: 'OUTRO-PAGADOR',
      cooperativaId: 'coop-A',
      empresaNome: 'Clinica X',
      status: 'ATIVO',
    });
    await expect(
      guard.canActivate(
        buildCtx({
          user: { perfil: PerfilUsuario.EMPRESA_CONVENIADA, email: 'x@y.com' },
          params: { id: 'conv-1' },
        }),
      ),
    ).rejects.toThrow(NotFoundException);
  });

  it('match completo → true + req.empresa anexado', async () => {
    (reflector.getAllAndOverride as jest.Mock).mockReturnValueOnce({});
    findFirstCooperado.mockResolvedValueOnce({ id: 'coop-1', cooperativaId: 'coop-A' });
    findUniqueConvenio.mockResolvedValueOnce({
      id: 'conv-1',
      pagadorCooperadoId: 'coop-1',
      cooperativaId: 'coop-A',
      empresaNome: 'Clinica X',
      status: 'ATIVO',
    });
    const req: any = {
      user: { perfil: PerfilUsuario.EMPRESA_CONVENIADA, email: 'x@y.com' },
      params: { id: 'conv-1' },
    };
    const r = await guard.canActivate(buildCtx(req));
    expect(r).toBe(true);
    expect(req.empresa).toEqual({
      cooperadoId: 'coop-1',
      cooperativaId: 'coop-A',
      convenio: { id: 'conv-1', empresaNome: 'Clinica X', status: 'ATIVO' },
    });
  });
});
