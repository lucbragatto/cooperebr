/**
 * Sprint Hardening Lateral (23/06/2026) — Bloco B (CADASTRO-COMPLETO) + D (asaas).
 *
 * Spec do helper canônico `assertSameTenantOrSuperAdmin` aplicado nos fixes
 * do Hardening Lateral. Cobre os cenários esperados:
 *
 *  - SA passa livre (cross-tenant intencional)
 *  - ADMIN só na própria cooperativa; ADMIN→outra = Forbidden
 *  - Outros perfis = Forbidden
 */
import { ForbiddenException } from '@nestjs/common';
import { assertSameTenantOrSuperAdmin } from './tenant-guard.helper';
import { PerfilUsuario } from './perfil.enum';

describe('Hardening Lateral — assertSameTenantOrSuperAdmin', () => {
  it('SUPER_ADMIN passa livre (cross-tenant intencional)', () => {
    const user = { perfil: PerfilUsuario.SUPER_ADMIN, cooperativaId: null };
    expect(() => assertSameTenantOrSuperAdmin(user, 'tenant-OUTRO')).not.toThrow();
  });

  it('ADMIN com cooperativaId própria → passa', () => {
    const user = { perfil: PerfilUsuario.ADMIN, cooperativaId: 'tenant-A' };
    expect(() => assertSameTenantOrSuperAdmin(user, 'tenant-A')).not.toThrow();
  });

  it('ADMIN tentando outra cooperativa → ForbiddenException', () => {
    const user = { perfil: PerfilUsuario.ADMIN, cooperativaId: 'tenant-A' };
    expect(() => assertSameTenantOrSuperAdmin(user, 'tenant-B')).toThrow(ForbiddenException);
  });

  it('ADMIN sem cooperativaId no JWT → ForbiddenException', () => {
    const user = { perfil: PerfilUsuario.ADMIN, cooperativaId: null };
    expect(() => assertSameTenantOrSuperAdmin(user, 'tenant-A')).toThrow(ForbiddenException);
  });

  it.each([PerfilUsuario.OPERADOR, PerfilUsuario.COOPERADO, PerfilUsuario.AGREGADOR])(
    '%s → ForbiddenException (sem acesso)',
    (perfil) => {
      const user = { perfil, cooperativaId: 'tenant-A' };
      expect(() => assertSameTenantOrSuperAdmin(user, 'tenant-A')).toThrow(ForbiddenException);
    },
  );
});
