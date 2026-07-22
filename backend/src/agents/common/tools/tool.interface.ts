import { z } from 'zod';
import { RiskLevel, PolicyContext } from '../types/policy.types';

/**
 * Contexto de execução de uma Tool.
 * Fornecido pelo harness do PolicyEngine + AgentsService.
 */
export interface AgentContext extends PolicyContext {
  /** Modo de execução forçado (útil para simulações L1) */
  executionMode?: 'dry-run' | 'real';
  /** Metadados adicionais (ex: origem da chamada: dashboard, whatsapp, cron) */
  source?: string;
}

/**
 * Resultado padronizado de execução de Tool.
 * Todo Tool deve retornar este formato (além do output específico).
 */
export interface ToolResult<T = unknown> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
    details?: unknown;
  };
  /** Metadados de execução (sempre presentes para auditoria) */
  meta: {
    toolId: string;
    level: RiskLevel;
    executedAt: Date;
    durationMs: number;
    dryRun: boolean;
    correlationId?: string;
  };
}

/**
 * Contrato mínimo que toda Tool do módulo Agents/IAG deve implementar.
 * Este contrato é a base do sistema de governança (PolicyEngine).
 */
export interface Tool<TInput = unknown, TOutput = unknown> {
  /** Identificador único e estável (ex: 'sentinela.verificarConcentracao25') */
  readonly id: string;

  /** Nome amigável para humanos */
  readonly name: string;

  /** Descrição curta do que a tool faz (usada em prompts e UI) */
  readonly description: string;

  /** Nível de risco declarado pela Tool. O PolicyEngine pode elevar, nunca rebaixar. */
  readonly declaredRiskLevel: RiskLevel;

  /** Schema Zod para validação de entrada (obrigatório) */
  readonly inputSchema: z.ZodSchema<TInput>;

  /** Schema Zod para validação de saída (recomendado) */
  readonly outputSchema?: z.ZodSchema<TOutput>;

  /**
   * Função de execução da Tool.
   * O PolicyEngine chama esta função SOMENTE após aprovação de política.
   */
  execute(input: TInput, context: AgentContext): Promise<TOutput>;
}

/**
 * Helper para criar Tools com tipagem forte.
 * Uso recomendado:
 *
 * export const minhaTool: Tool<MeuInput, MeuOutput> = defineTool({
 *   id: '...',
 *   name: '...',
 *   description: '...',
 *   declaredRiskLevel: 'L1',
 *   inputSchema: z.object({...}),
 *   execute: async (input, ctx) => { ... }
 * });
 */
export function defineTool<TInput, TOutput>(def: {
  id: string;
  name: string;
  description: string;
  declaredRiskLevel: RiskLevel;
  inputSchema: z.ZodSchema<TInput>;
  outputSchema?: z.ZodSchema<TOutput>;
  execute: (input: TInput, context: AgentContext) => Promise<TOutput>;
}): Tool<TInput, TOutput> {
  return {
    id: def.id,
    name: def.name,
    description: def.description,
    declaredRiskLevel: def.declaredRiskLevel,
    inputSchema: def.inputSchema,
    outputSchema: def.outputSchema,
    execute: def.execute,
  };
}
