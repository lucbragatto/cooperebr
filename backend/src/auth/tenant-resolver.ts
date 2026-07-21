import { ForbiddenException } from '@nestjs/common';
import { PerfilUsuario } from './perfil.enum';

/**
 * Corretiva IDOR 21/07 Onda 1 — revisão do padrao D-novo-BQ.3 A1.
 *
 * O padrao original (`req.user?.cooperativaId ?? null`) inferia intencao pelo
 * VALOR: null = SUPER_ADMIN bypass. Isso quebra fail-closed quando um perfil
 * nao-SUPER_ADMIN tem cooperativaId ausente no token — cai no mesmo branch e
 * ganha bypass silencioso (auditoria 21/07: existem 3 usuarios sem
 * cooperativaId; 2 SUPER_ADMIN + 1 COOPERADO).
 *
 * Este helper decide pelo PERFIL, fail-CLOSED:
 *   - SUPER_ADMIN → retorna body.cooperativaId ?? null (bypass legitimo)
 *   - Qualquer outro perfil sem cooperativaId no token → 403 imediato
 *   - Qualquer outro perfil com cooperativaId → retorna esse valor
 *
 * Se o retorno for null, e INTENCAO de SUPER_ADMIN, nao default de outro perfil.
 * Callers usam o retorno diretamente em where clauses/validacoes de posse.
 *
 * @throws ForbiddenException — perfil nao-SUPER_ADMIN sem cooperativaId.
 */
export function resolveTenantIdFromReq(
  req: { user?: { perfil?: string; cooperativaId?: string | null } | null },
  bodyCooperativaId?: string | null,
): string | null {
  const perfil = req?.user?.perfil;
  if (perfil === PerfilUsuario.SUPER_ADMIN) {
    return bodyCooperativaId ?? null;
  }
  const cooperativaId = req?.user?.cooperativaId;
  if (!cooperativaId) {
    throw new ForbiddenException('Usuário sem cooperativaId no token');
  }
  return cooperativaId;
}
