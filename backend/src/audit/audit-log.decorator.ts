import { SetMetadata } from '@nestjs/common';

export const AUDIT_LOG_KEY = 'audit_log_meta';

export interface AuditLogMeta {
  acao: string;
  recurso: string;
  recursoIdParam?: string;
  /**
   * Sprint Hardening Lateral (23/06/2026) — fix
   * D-novo-AUDITLOG-TENANT-ALVO-SA P1.
   *
   * Quando o caller é SUPER_ADMIN agindo cross-tenant (sem cooperativaId no
   * JWT), o interceptor pega `null` como tenant — perdendo a rastreabilidade
   * de QUAL tenant foi modificado.
   *
   * `cooperativaIdSource` declara onde buscar o tenant ALVO quando o JWT
   * não tem. Formato `'<scope>:<key>'`:
   *  - `'param:tenant'` → `req.params.tenant`
   *  - `'body:cooperativaId'` → `req.body.cooperativaId`
   *  - `'query:tenant'` → `req.query.tenant`
   *  - `'response:cooperativaId'` → `response.cooperativaId` (após handler)
   *
   * Aplicado SÓ nos endpoints onde SA age cross-tenant com alvo (migração,
   * cadastros, etc.). NÃO retroativo (catalogado como follow-up).
   */
  cooperativaIdSource?: string;
}

/**
 * Marca um handler para registro em AuditLog após execução bem-sucedida.
 * Exemplos:
 *  @AuditLog({ acao: 'cooperativa.suspender', recurso: 'Cooperativa', recursoIdParam: 'id' })
 *  @AuditLog({ acao: 'cobranca.cancelar', recurso: 'Cobranca', recursoIdParam: 'id' })
 *  @AuditLog({ acao: 'cooperado.cadastro-completo', recurso: 'Cooperado',
 *             cooperativaIdSource: 'body:cooperativaId' })  // SA precisa rastreabilidade
 */
export const AuditLog = (meta: AuditLogMeta) => SetMetadata(AUDIT_LOG_KEY, meta);
