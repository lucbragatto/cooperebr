import { ForbiddenException } from '@nestjs/common';
import { PerfilUsuario } from './perfil.enum';

interface UserLike {
  perfil: PerfilUsuario | string;
  cooperativaId?: string | null;
}

/**
 * Garante isolamento multi-tenant em endpoints que recebem cooperativaId via parâmetro.
 *
 * - SUPER_ADMIN: passa livre (acesso cross-tenant intencional).
 * - ADMIN: só acessa a própria `cooperativaId`. Tentar outro id → ForbiddenException.
 * - Outros perfis (OPERADOR, COOPERADO, AGREGADOR): sem acesso → ForbiddenException.
 *
 * Uso:
 *   assertSameTenantOrSuperAdmin(req.user, id);
 */
export function assertSameTenantOrSuperAdmin(
  user: UserLike,
  cooperativaIdAlvo: string,
): void {
  if (user.perfil === PerfilUsuario.SUPER_ADMIN) {
    return;
  }

  if (user.perfil === PerfilUsuario.ADMIN) {
    if (!user.cooperativaId) {
      throw new ForbiddenException('Usuário ADMIN sem cooperativa vinculada');
    }
    if (cooperativaIdAlvo !== user.cooperativaId) {
      throw new ForbiddenException('Você não tem acesso a esta cooperativa');
    }
    return;
  }

  throw new ForbiddenException('Perfil sem acesso a este recurso');
}
