import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Observable, tap } from 'rxjs';
import { AUDIT_LOG_KEY, AuditLogMeta } from './audit-log.decorator';
import { AuditService } from './audit.service';

/**
 * Sprint Hardening Lateral (23/06/2026) — fix
 * D-novo-AUDITLOG-TENANT-ALVO-SA P1.
 *
 * Pure function: resolve o cooperativaId pro AuditLog combinando o JWT
 * (prevalece quando presente) com o `cooperativaIdSource` declarado pelo
 * decorator quando SA opera cross-tenant sem cooperativaId no JWT.
 *
 * Exportada pra testabilidade direta (sem montar RxJS pipeline).
 */
export function resolveCooperativaIdAlvoAudit(
  meta: AuditLogMeta,
  jwtCooperativaId: string | null,
  req: { params?: any; body?: any; query?: any },
  response: any,
): string | null {
  if (jwtCooperativaId) return jwtCooperativaId;
  if (!meta.cooperativaIdSource) return null;
  const idx = meta.cooperativaIdSource.indexOf(':');
  if (idx < 0) return null;
  const scope = meta.cooperativaIdSource.slice(0, idx);
  const key = meta.cooperativaIdSource.slice(idx + 1);
  if (!scope || !key) return null;
  const source =
    scope === 'param' ? req.params :
    scope === 'body' ? req.body :
    scope === 'query' ? req.query :
    scope === 'response' ? response :
    null;
  const value = source?.[key];
  return typeof value === 'string' && value.length > 0 ? value : null;
}

@Injectable()
export class AuditLogInterceptor implements NestInterceptor {
  constructor(
    private readonly reflector: Reflector,
    private readonly auditService: AuditService,
  ) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const meta = this.reflector.get<AuditLogMeta>(
      AUDIT_LOG_KEY,
      context.getHandler(),
    );

    if (!meta) {
      return next.handle();
    }

    const req = context.switchToHttp().getRequest();
    const user = req.user;

    return next.handle().pipe(
      tap((response) => {
        // Só grava se passou (não houve exception).
        if (!user?.userId && !user?.id) {
          return; // sem usuário autenticado, pula
        }

        const usuarioId: string = user.userId ?? user.id;
        const usuarioPerfil: string = user.perfil ?? user.role ?? 'DESCONHECIDO';
        const jwtCoopId: string | null =
          user.cooperativaId ?? user.tenantId ?? null;
        // Hardening Lateral 23/06 — função pura testável resolve SA-alvo.
        const cooperativaId = resolveCooperativaIdAlvoAudit(meta, jwtCoopId, req, response);
        const impersonating: boolean = !!user.impersonating;
        const cooperativaImpersonadaId: string | null =
          user.cooperativaImpersonadaId ?? null;

        const recursoId = meta.recursoIdParam
          ? req.params?.[meta.recursoIdParam] ?? response?.id ?? null
          : response?.id ?? null;

        this.auditService.log({
          usuarioId,
          usuarioPerfil,
          acao: meta.acao,
          recurso: meta.recurso,
          recursoId,
          cooperativaId,
          impersonating,
          cooperativaImpersonadaId,
          metadata: {
            method: req.method,
            url: req.originalUrl ?? req.url,
            params: req.params,
            query: req.query,
          },
          ip:
            req.ip ??
            req.headers?.['x-forwarded-for']?.toString() ??
            req.socket?.remoteAddress ??
            null,
          userAgent: req.headers?.['user-agent'] ?? null,
        });
      }),
    );
  }
}
