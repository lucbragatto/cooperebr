import { Injectable, Logger } from '@nestjs/common';
import { RiskLevel, PolicyDecision, PolicyContext } from '../types/policy.types';

/**
 * PolicyEngine — Núcleo de governança do módulo Agents/IAG.
 *
 * Regras atuais (versão inicial — evoluir com feedback real):
 * - L4 → sempre bloqueado (nunca deve ser declarado por Tools)
 * - L3 → sempre exige aprovação humana explícita (suggestedMode = 'dry-run' até aprovação)
 * - L2 → permitido em dry-run; real só com limites (por enquanto: só dry-run)
 * - L1 → simulação livre (dry-run recomendado, real permitido em contextos controlados)
 * - L0 → leitura pura, sempre permitido
 *
 * O engine NUNCA rebaixa nível declarado pela Tool. Só pode elevar.
 */
@Injectable()
export class PolicyEngineService {
  private readonly logger = new Logger(PolicyEngineService.name);

  /**
   * Avalia se uma Tool pode ser executada no contexto dado.
   */
  evaluate(
    declaredLevel: RiskLevel,
    context: PolicyContext,
  ): PolicyDecision {
    // L4 é proibido por arquitetura
    if (declaredLevel === 'L4') {
      return {
        allowed: false,
        level: 'L4',
        reason: 'Nível L4 é bloqueado por design no módulo Agents/IAG.',
        requiresHumanApproval: true,
        suggestedMode: 'dry-run',
      };
    }

    // L3 (financeiro/regulatório crítico) → sempre requer aprovação humana
    if (declaredLevel === 'L3') {
      return {
        allowed: true,
        level: 'L3',
        reason: 'Operação de alto risco (L3). Execução real requer aprovação humana explícita.',
        requiresHumanApproval: true,
        suggestedMode: 'dry-run',
      };
    }

    // L2 (baixa risco, mas com efeito) → por enquanto só dry-run
    if (declaredLevel === 'L2') {
      return {
        allowed: true,
        level: 'L2',
        reason: 'Operação L2. Modo real sujeito a limites e auditoria reforçada.',
        requiresHumanApproval: false,
        suggestedMode: 'dry-run',
      };
    }

    // L1 (simulação/recomendação)
    if (declaredLevel === 'L1') {
      return {
        allowed: true,
        level: 'L1',
        reason: 'Operação de simulação/recomendação (L1). Dry-run é o modo padrão.',
        requiresHumanApproval: false,
        suggestedMode: 'dry-run',
      };
    }

    // L0 (leitura pura)
    return {
      allowed: true,
      level: 'L0',
      reason: 'Leitura pura (L0). Execução permitida sem restrições adicionais.',
      requiresHumanApproval: false,
      suggestedMode: 'real',
    };
  }

  /**
   * Verifica se o contexto de tenant está válido.
   * (Pode evoluir para checagens mais sofisticadas de permissão por perfil.)
   */
  validateTenantContext(context: PolicyContext): boolean {
    if (!context.cooperativaId) {
      this.logger.warn('PolicyEngine: contexto sem cooperativaId');
      return false;
    }
    if (!context.usuarioId) {
      this.logger.warn('PolicyEngine: contexto sem usuarioId');
      return false;
    }
    return true;
  }

  /**
   * Decide o modo efetivo de execução (dry-run vs real).
   * Respeita tanto a sugestão do Policy quanto o desejo explícito do caller.
   */
  resolveExecutionMode(
    decision: PolicyDecision,
    requestedMode?: 'dry-run' | 'real',
  ): 'dry-run' | 'real' {
    if (decision.requiresHumanApproval) {
      return 'dry-run';
    }
    if (requestedMode === 'real' && decision.suggestedMode === 'real') {
      return 'real';
    }
    return 'dry-run';
  }
}
