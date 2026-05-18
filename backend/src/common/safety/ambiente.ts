/**
 * Discriminador de ambiente real vs dev/staging.
 *
 * **NÃO use `process.env.NODE_ENV === 'production'` pra essa finalidade.**
 *
 * Motivo (descoberto em 18/05/2026 durante smoke Sub-Fase 1 Fase 4):
 * `ecosystem.config.cjs` força `NODE_ENV='production'` no PM2 pra que o
 * Nest rode o build compilado em `dist/` com otimizações Node. Isso é
 * intencional e correto operacionalmente — mas significa que NODE_ENV
 * é sempre 'production' tanto em DEV LOCAL quanto em PROD REAL.
 *
 * Resultado: TODO check `NODE_ENV !== 'production'` no projeto está
 * estruturalmente quebrado. Whitelist LGPD, override de contatos teste,
 * guards nativos de WA/Email — tudo bypassed em dev.
 *
 * Discriminador correto: flag explícita `AMBIENTE_REAL=true` no `.env`
 * (opt-in produção). Default ausente = dev (fail-safe).
 *
 * Origem: memória `falha_regra_contatos_teste_18_05.md`.
 */
export function isAmbienteReal(): boolean {
  return process.env.AMBIENTE_REAL === 'true';
}
