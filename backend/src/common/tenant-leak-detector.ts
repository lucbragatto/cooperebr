import { Logger } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { getTenantContext, TenantContext } from './tenant-context';

/**
 * D-novo-BR F1.3 (31/05/2026) — Prisma Client Extension LOG-ONLY.
 *
 * Detecta o 69º endpoint vulnerável ANTES de produção. Estratégia:
 *
 * 1. Roda em CADA query Prisma (qualquer model, qualquer operação).
 * 2. Pula models GLOBAIS (whitelist abaixo) — Cooperativa, PlanoSaas, etc.
 * 3. Pula contexto isPlatform=true — crons/listeners/webhooks legítimos.
 * 4. Pula SUPER_ADMIN (cooperativaId null no token = cross-tenant intencional).
 * 5. Pula contexto vazio (init, scripts standalone, ALS não populado).
 * 6. Se chegou aqui: model é tenant-scoped + usuário tem tenant ativo →
 *    inspeciona `args.where` e LOGA warn se não encontra filtro de tenant
 *    direto (`cooperativaId`) nem via relação conhecida.
 *
 * NUNCA injeta. NUNCA bloqueia. NUNCA modifica resultado.
 *
 * Falsos positivos: aceitáveis na F1.3 (defensivo) — ajustar whitelist
 * conforme observação dos logs em F1.4.
 */

const logger = new Logger('TenantLeakDetector');

/** Models genuinamente globais — compartilhados entre tenants. */
export const MODELS_GLOBAIS = new Set<string>([
  'Cooperativa',            // é o próprio tenant
  'ConfigGatewayPlataforma', // config plataforma
  'PlanoSaas',              // planos plataforma
  'LeadWhatsapp',           // público pré-tenant
  'EmailLog',               // M7 cat-3 — schema add em F1.5
  // Outros models sem cooperativaId direto (tenant-via-relação) NÃO
  // estão aqui — devemos LOGAR queries sem filtro relacional pra detectar.
]);

/** Operações que recebem `args.where` */
export const OPS_COM_WHERE = new Set<string>([
  'findFirst',
  'findUnique',
  'findFirstOrThrow',
  'findUniqueOrThrow',
  'findMany',
  'update',
  'updateMany',
  'delete',
  'deleteMany',
  'count',
  'aggregate',
  'groupBy',
]);

/**
 * Detecta se o `where` tem filtro de tenant (direto ou via relação).
 * Heurística conservadora: procura recursivamente por `cooperativaId` em
 * qualquer profundidade do where (até 4 níveis pra evitar explosão).
 */
export function whereTemFiltroTenant(where: any, depth = 0): boolean {
  if (!where || typeof where !== 'object' || depth > 4) return false;
  if ('cooperativaId' in where) return true;
  if (Array.isArray(where.AND)) {
    if (where.AND.some((c: any) => whereTemFiltroTenant(c, depth + 1))) return true;
  }
  if (Array.isArray(where.OR)) {
    if (where.OR.every((c: any) => whereTemFiltroTenant(c, depth + 1))) return true;
  }
  for (const [key, value] of Object.entries(where)) {
    if (key === 'AND' || key === 'OR' || key === 'NOT') continue;
    if (value && typeof value === 'object' && !Array.isArray(value)) {
      if (whereTemFiltroTenant(value, depth + 1)) return true;
    }
  }
  return false;
}

/**
 * Função pura testável que decide se deve LOGAR.
 * Retorna null se NÃO deve logar; retorna string da mensagem se DEVE.
 */
export function avaliarQuery(opts: {
  model?: string;
  operation: string;
  args: any;
  ctx: TenantContext | undefined;
}): string | null {
  if (!OPS_COM_WHERE.has(opts.operation)) return null;
  if (opts.model && MODELS_GLOBAIS.has(opts.model)) return null;
  if (!opts.ctx) return null;
  if (opts.ctx.isPlatform) return null;
  if (opts.ctx.perfil === 'SUPER_ADMIN') return null;
  if (!opts.ctx.cooperativaId) return null;

  const where = opts.args?.where;
  if (whereTemFiltroTenant(where)) return null;

  return `[TENANT-LEAK-DETECT] model=${opts.model} op=${opts.operation} perfil=${opts.ctx.perfil} cooperativaId=${opts.ctx.cooperativaId} sem filtro de tenant no where`;
}

export const tenantLeakExtension = Prisma.defineExtension({
  name: 'tenantLeakDetector',
  query: {
    $allModels: {
      $allOperations({ model, operation, args, query }) {
        const ctx = getTenantContext();
        const msg = avaliarQuery({ model, operation, args, ctx });
        if (msg) logger.warn(msg);
        return query(args);
      },
    },
  },
});
