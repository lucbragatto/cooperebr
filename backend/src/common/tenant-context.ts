import { AsyncLocalStorage } from 'node:async_hooks';

/**
 * D-novo-BR F1.3 (31/05/2026) — Contexto de tenant via AsyncLocalStorage.
 *
 * Usado pela Prisma Client Extension log-only pra distinguir:
 *  - Request HTTP normal (perfil + cooperativaId conhecidos → loga se query
 *    a model tenant-scoped não filtra por cooperativaId)
 *  - Operação de plataforma (cron, listener, webhook): `isPlatform: true`
 *    → extensão NÃO loga (operação legítima cross-tenant).
 *  - Sem contexto algum (scripts standalone, init): extensão também não loga
 *    (evita ruído de inicialização).
 *
 * Pattern: usar `runWithTenant` no HTTP middleware (auto) e `runAsPlatform`
 * explicitamente nos crons/listeners/webhooks (manual obrigatório).
 */

export interface TenantContext {
  cooperativaId?: string | null;
  perfil?: string;
  /** true = operação de plataforma (cron/webhook/listener); false = HTTP request */
  isPlatform: boolean;
}

const storage = new AsyncLocalStorage<TenantContext>();

/** Lê o contexto atual. Retorna undefined fora de qualquer run. */
export function getTenantContext(): TenantContext | undefined {
  return storage.getStore();
}

/** Roda `fn` dentro de contexto HTTP (perfil + cooperativaId conhecidos). */
export function runWithTenant<T>(
  ctx: { cooperativaId?: string | null; perfil?: string },
  fn: () => T,
): T {
  return storage.run({ ...ctx, isPlatform: false }, fn);
}

/**
 * Roda `fn` em contexto de plataforma — extensão NÃO loga.
 * Wirar em TODOS os pontos fora-de-HTTP: @Cron, @OnEvent, webhooks @Public,
 * scripts CLI executados via NestJS standalone application.
 */
export function runAsPlatform<T>(fn: () => T): T {
  return storage.run({ isPlatform: true }, fn);
}

/**
 * Decorator method-level que envolve a chamada inteira em `runAsPlatform`.
 *
 * Usage:
 *   @Cron('0 3 * * *')
 *   @AsPlatform()
 *   async meuCron() { ... }
 *
 * Funciona com async/sync. Preserva `this`. Sem mudança no corpo do método.
 */
export function AsPlatform(): MethodDecorator {
  return (_target, _key, descriptor: PropertyDescriptor) => {
    const original = descriptor.value;
    descriptor.value = function (...args: unknown[]) {
      return runAsPlatform(() => original.apply(this, args));
    };
    return descriptor;
  };
}
