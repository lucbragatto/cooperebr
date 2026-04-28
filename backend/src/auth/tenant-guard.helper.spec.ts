import { ForbiddenException } from '@nestjs/common';
import { assertSameTenantOrSuperAdmin } from './tenant-guard.helper';
import { PerfilUsuario } from './perfil.enum';

describe('assertSameTenantOrSuperAdmin', () => {
  it('SUPER_ADMIN passa livre mesmo com cooperativaId diferente', () => {
    expect(() =>
      assertSameTenantOrSuperAdmin(
        { perfil: PerfilUsuario.SUPER_ADMIN, cooperativaId: 'coop-A' },
        'coop-B',
      ),
    ).not.toThrow();
  });

  it('SUPER_ADMIN passa livre mesmo sem cooperativaId vinculada', () => {
    expect(() =>
      assertSameTenantOrSuperAdmin(
        { perfil: PerfilUsuario.SUPER_ADMIN, cooperativaId: null },
        'qualquer-coop',
      ),
    ).not.toThrow();
  });

  it('ADMIN com mesma cooperativaId passa', () => {
    expect(() =>
      assertSameTenantOrSuperAdmin(
        { perfil: PerfilUsuario.ADMIN, cooperativaId: 'coop-A' },
        'coop-A',
      ),
    ).not.toThrow();
  });

  it('ADMIN com cooperativaId diferente lança ForbiddenException', () => {
    expect(() =>
      assertSameTenantOrSuperAdmin(
        { perfil: PerfilUsuario.ADMIN, cooperativaId: 'coop-A' },
        'coop-B',
      ),
    ).toThrow(ForbiddenException);
  });

  it('ADMIN sem cooperativaId vinculada lança ForbiddenException', () => {
    expect(() =>
      assertSameTenantOrSuperAdmin(
        { perfil: PerfilUsuario.ADMIN, cooperativaId: null },
        'coop-A',
      ),
    ).toThrow(ForbiddenException);
  });

  it('OPERADOR lança ForbiddenException mesmo com mesma cooperativaId', () => {
    expect(() =>
      assertSameTenantOrSuperAdmin(
        { perfil: PerfilUsuario.OPERADOR, cooperativaId: 'coop-A' },
        'coop-A',
      ),
    ).toThrow(ForbiddenException);
  });

  it('COOPERADO lança ForbiddenException', () => {
    expect(() =>
      assertSameTenantOrSuperAdmin(
        { perfil: PerfilUsuario.COOPERADO, cooperativaId: 'coop-A' },
        'coop-A',
      ),
    ).toThrow(ForbiddenException);
  });

  it('AGREGADOR lança ForbiddenException', () => {
    expect(() =>
      assertSameTenantOrSuperAdmin(
        { perfil: PerfilUsuario.AGREGADOR, cooperativaId: 'coop-A' },
        'coop-A',
      ),
    ).toThrow(ForbiddenException);
  });
});
