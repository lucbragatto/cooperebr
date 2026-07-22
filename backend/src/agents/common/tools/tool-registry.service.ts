import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { Tool, ToolResult, AgentContext } from './tool.interface';
import { PolicyEngineService } from '../policy/policy-engine.service';
import { RiskLevel } from '../types/policy.types';

/**
 * ToolRegistry — Registro central de todas as Tools do módulo Agents/IAG.
 *
 * Responsabilidades:
 * - Armazenar Tools registradas
 * - Validar política antes de permitir execução
 * - Executar Tools de forma governada (com métricas básicas)
 * - Fornecer lista de Tools disponíveis (para UI e prompts)
 */
@Injectable()
export class ToolRegistryService {
  private readonly logger = new Logger(ToolRegistryService.name);
  private readonly tools = new Map<string, Tool>();

  constructor(private readonly policyEngine: PolicyEngineService) {}

  /**
   * Registra uma Tool no sistema.
   * Chamado normalmente no momento de bootstrap do módulo (via module providers).
   */
  register(tool: Tool): void {
    if (this.tools.has(tool.id)) {
      this.logger.warn(`Tool já registrada será sobrescrita: ${tool.id}`);
    }
    this.tools.set(tool.id, tool);
    this.logger.log(`Tool registrada: ${tool.id} [${tool.declaredRiskLevel}]`);
  }

  /**
   * Retorna todas as Tools registradas (para listagem / descoberta).
   */
  listAll(): Tool[] {
    return Array.from(this.tools.values());
  }

  /**
   * Retorna Tools filtradas por nível máximo de risco (útil para UI).
   */
  listByMaxLevel(maxLevel: RiskLevel): Tool[] {
    const order: RiskLevel[] = ['L0', 'L1', 'L2', 'L3', 'L4'];
    const maxIndex = order.indexOf(maxLevel);
    return this.listAll().filter(t => order.indexOf(t.declaredRiskLevel) <= maxIndex);
  }

  /**
   * Executa uma Tool com governança completa (PolicyEngine + validação + métricas).
   */
  async execute<TInput, TOutput>(
    toolId: string,
    input: TInput,
    context: AgentContext,
  ): Promise<ToolResult<TOutput>> {
    const start = Date.now();
    const tool = this.tools.get(toolId);

    if (!tool) {
      throw new BadRequestException(`Tool não encontrada: ${toolId}`);
    }

    // 1. Validação de tenant
    if (!this.policyEngine.validateTenantContext(context)) {
      return this.buildErrorResult(tool, 'POLICY_TENANT_INVALID', 'Contexto de tenant inválido ou incompleto.', start);
    }

    // 2. Avaliação de política
    const decision = this.policyEngine.evaluate(tool.declaredRiskLevel, context);

    if (!decision.allowed) {
      return this.buildErrorResult(tool, 'POLICY_DENIED', decision.reason, start, decision.level);
    }

    const effectiveMode = this.policyEngine.resolveExecutionMode(decision, context.executionMode);

    // 3. Validação de input
    const parsedInput = tool.inputSchema.safeParse(input);
    if (!parsedInput.success) {
      return this.buildErrorResult(
        tool,
        'VALIDATION_ERROR',
        'Input inválido para a Tool',
        start,
        decision.level,
        parsedInput.error.format(),
      );
    }

    // 4. Execução real da Tool
    try {
      const output = await tool.execute(parsedInput.data, {
        ...context,
        executionMode: effectiveMode,
      });

      const durationMs = Date.now() - start;

      return {
        success: true,
        data: output as TOutput,
        meta: {
          toolId: tool.id,
          level: decision.level,
          executedAt: new Date(),
          durationMs,
          dryRun: effectiveMode === 'dry-run',
          correlationId: context.correlationId,
        },
      };
    } catch (err: any) {
      this.logger.error(`Erro ao executar Tool ${toolId}: ${err.message}`, err.stack);
      return this.buildErrorResult(tool, 'EXECUTION_ERROR', err.message || 'Erro interno na Tool', start, decision.level);
    }
  }

  private buildErrorResult(
    tool: Tool,
    code: string,
    message: string,
    start: number,
    level: RiskLevel = tool.declaredRiskLevel,
    details?: unknown,
  ): ToolResult {
    return {
      success: false,
      error: {
        code,
        message,
        details,
      },
      meta: {
        toolId: tool.id,
        level,
        executedAt: new Date(),
        durationMs: Date.now() - start,
        dryRun: true,
      },
    };
  }
}
