import { Injectable, Logger } from '@nestjs/common';
import { ToolRegistryService } from './common/tools/tool-registry.service';
import { PolicyEngineService } from './common/policy/policy-engine.service';
import { AgentContext } from './common/tools/tool.interface';

/**
 * AgentsService — Orquestrador principal do módulo IAG.
 *
 * Responsabilidades futuras:
 * - Expor métodos de alto nível (runSentinela, analisarRepasse, etc.)
 * - Gerenciar histórico de execuções de agentes (quando persistirmos)
 * - Integrar com EventEmitter para reação autônoma (Sentinela)
 *
 * Por enquanto: apenas expõe o registry e o policy engine.
 */
@Injectable()
export class AgentsService {
  private readonly logger = new Logger(AgentsService.name);

  constructor(
    private readonly toolRegistry: ToolRegistryService,
    private readonly policyEngine: PolicyEngineService,
  ) {}

  /**
   * Retorna todas as Tools disponíveis (para UI admin futura).
   */
  listAvailableTools() {
    return this.toolRegistry.listAll().map(t => ({
      id: t.id,
      name: t.name,
      description: t.description,
      declaredRiskLevel: t.declaredRiskLevel,
    }));
  }

  /**
   * Executa uma Tool específica de forma governada.
   * Este é o ponto de entrada principal para execução controlada.
   */
  async runTool(toolId: string, input: unknown, context: AgentContext) {
    return this.toolRegistry.execute(toolId, input, context);
  }
}
