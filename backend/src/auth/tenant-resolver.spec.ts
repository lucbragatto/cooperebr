import { ForbiddenException } from '@nestjs/common';
import { resolveTenantIdFromReq } from './tenant-resolver';
import { PerfilUsuario } from './perfil.enum';

/**
 * Corretiva IDOR 21/07 Onda 1 — unit test do helper de resolucao de tenant
 * fail-CLOSED. O padrao antigo (`?? null`) confundia "ausente" com "SUPER_ADMIN
 * bypass"; este helper decide pelo PERFIL, nao pelo valor.
 *
 * Auditoria em 21/07 confirmou existencia de 3 usuarios com cooperativaId=null
 * no banco (2 SUPER_ADMIN + 1 COOPERADO). O COOPERADO seria o vetor do IDOR
 * novo se o fix mantivesse o padrao antigo — este teste garante que nao.
 */
describe('resolveTenantIdFromReq — fail-CLOSED por perfil', () => {
  const req = (perfil: string | undefined, cooperativaId: string | null | undefined) =>
    ({ user: perfil ? { perfil, cooperativaId } : null } as any);

  describe('SUPER_ADMIN → bypass legitimo (pode passar cooperativaId no body)', () => {
    it('body vazio → retorna null (age globalmente)', () => {
      const result = resolveTenantIdFromReq(req(PerfilUsuario.SUPER_ADMIN, null));
      expect(result).toBeNull();
    });

    it('body com cooperativaId → retorna esse (age em tenant especifico)', () => {
      const result = resolveTenantIdFromReq(req(PerfilUsuario.SUPER_ADMIN, null), 'tenant-B');
      expect(result).toBe('tenant-B');
    });

    it('SUPER_ADMIN com cooperativaId propria + body override → body vence', () => {
      const result = resolveTenantIdFromReq(req(PerfilUsuario.SUPER_ADMIN, 'tenant-A'), 'tenant-B');
      expect(result).toBe('tenant-B');
    });
  });

  describe('ADMIN → SEMPRE cooperativaId do JWT, IGNORA body', () => {
    it('com cooperativaId no token → retorna esse (body ignorado)', () => {
      const result = resolveTenantIdFromReq(req(PerfilUsuario.ADMIN, 'tenant-A'), 'tenant-B');
      expect(result).toBe('tenant-A');
    });

    it('SEM cooperativaId no token → 403 ForbiddenException (NAO cai em null)', () => {
      expect(() => resolveTenantIdFromReq(req(PerfilUsuario.ADMIN, null))).toThrow(ForbiddenException);
    });

    it('SEM cooperativaId no token + body sugerindo → AINDA 403 (nao aceita body de ADMIN)', () => {
      expect(() =>
        resolveTenantIdFromReq(req(PerfilUsuario.ADMIN, null), 'tenant-B'),
      ).toThrow(ForbiddenException);
    });
  });

  describe('OPERADOR e COOPERADO → mesmo fail-CLOSED do ADMIN', () => {
    it('OPERADOR sem cooperativaId → 403', () => {
      expect(() => resolveTenantIdFromReq(req(PerfilUsuario.OPERADOR, null))).toThrow(
        ForbiddenException,
      );
    });

    it('COOPERADO sem cooperativaId → 403 (vetor auditado 21/07)', () => {
      // Existe 1 COOPERADO com cooperativaId=null no banco. Sem este helper,
      // ele cairia no branch "null = bypass" e ganharia IDOR silencioso.
      expect(() => resolveTenantIdFromReq(req(PerfilUsuario.COOPERADO, null))).toThrow(
        ForbiddenException,
      );
    });

    it('COOPERADO com cooperativaId → retorna esse (body ignorado)', () => {
      const result = resolveTenantIdFromReq(req(PerfilUsuario.COOPERADO, 'tenant-A'), 'tenant-B');
      expect(result).toBe('tenant-A');
    });
  });

  describe('degenerate cases', () => {
    it('req sem user → 403 (não é SUPER_ADMIN, então cai no fail-CLOSED)', () => {
      expect(() => resolveTenantIdFromReq(req(undefined, undefined))).toThrow(ForbiddenException);
    });

    it('cooperativaId=empty string → 403 (é falsy)', () => {
      expect(() => resolveTenantIdFromReq(req(PerfilUsuario.ADMIN, ''))).toThrow(ForbiddenException);
    });
  });
});
