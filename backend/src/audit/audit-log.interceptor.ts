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
        const cooperativaId: string | null =
          user.cooperativaId ?? user.tenantId ?? null;
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
