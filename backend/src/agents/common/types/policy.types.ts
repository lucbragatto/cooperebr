/**
 * Policy Engine Types — Módulo Agents/IAG
 *
 * Níveis de risco (L0 a L4).
 * L4 é bloqueado por design (nunca deve ser implementado em Tools).
 */

export type RiskLevel = 'L0' | 'L1' | 'L2' | 'L3' | 'L4';

export interface PolicyDecision {
  allowed: boolean;
  level: RiskLevel;
  reason: string;
  requiresHumanApproval: boolean;
  suggestedMode: 'dry-run' | 'real';
}

export interface PolicyContext {
  /** Tenant principal da operação */
  cooperativaId: string;
  /** Usuário que está invocando (pode ser admin ou sistema) */
  usuarioId: string;
  /** Perfil do usuário */
  usuarioPerfil: string;
  /** Se está em modo de impersonação */
  impersonating?: boolean;
  /** Correlação para rastreabilidade */
  correlationId?: string;
}
