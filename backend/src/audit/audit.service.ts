import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma.service';

export interface AuditEntry {
  usuarioId: string;
  usuarioPerfil: string;
  acao: string;
  recurso: string;
  recursoId?: string | null;
  cooperativaId?: string | null;
  impersonating?: boolean;
  cooperativaImpersonadaId?: string | null;
  metadata?: Record<string, unknown> | null;
  ip?: string | null;
  userAgent?: string | null;
}

@Injectable()
export class AuditService {
  private readonly logger = new Logger(AuditService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Registra uma entrada de auditoria. Falha silenciosa por design — auditoria
   * nunca pode quebrar fluxo de negócio. Erros vão pro logger.
   */
  async log(entry: AuditEntry): Promise<void> {
    try {
      await this.prisma.auditLog.create({
        data: {
          usuarioId: entry.usuarioId,
          usuarioPerfil: entry.usuarioPerfil,
          acao: entry.acao,
          recurso: entry.recurso,
          recursoId: entry.recursoId ?? null,
          cooperativaId: entry.cooperativaId ?? null,
          impersonating: entry.impersonating ?? false,
          cooperativaImpersonadaId: entry.cooperativaImpersonadaId ?? null,
          metadata: (entry.metadata ?? null) as any,
          ip: entry.ip ?? null,
          userAgent: entry.userAgent ?? null,
        },
      });
    } catch (err) {
      this.logger.error(
        `Falha ao gravar AuditLog acao=${entry.acao} recurso=${entry.recurso}: ${(err as Error).message}`,
      );
    }
  }
}
