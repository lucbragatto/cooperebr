import { SetMetadata } from '@nestjs/common';

export const AUDIT_LOG_KEY = 'audit_log_meta';

export interface AuditLogMeta {
  acao: string;
  recurso: string;
  recursoIdParam?: string;
}

/**
 * Marca um handler para registro em AuditLog após execução bem-sucedida.
 * Exemplos:
 *  @AuditLog({ acao: 'cooperativa.suspender', recurso: 'Cooperativa', recursoIdParam: 'id' })
 *  @AuditLog({ acao: 'cobranca.cancelar', recurso: 'Cobranca', recursoIdParam: 'id' })
 */
export const AuditLog = (meta: AuditLogMeta) => SetMetadata(AUDIT_LOG_KEY, meta);
