/**
 * Sprint M52b F4 — Smoke gate OFF/ON pro melt (24/06/2026).
 *
 * Testa o gate dual `isMeltAtivado` SEM tocar banco real:
 *  - Gate OFF (default): isMeltAtivado retorna false em todos os cenários
 *    exceto `meltAtivado=true + isAmbienteReal()=false` (DEV smoke).
 *  - Gate ON: lança configCooperToken.meltAtivado=true em DEV, ou +env em PROD.
 *
 * NÃO valida o lançamento contábil em si (specs já cobrem). Valida só o gate
 * dual no nível do helper exportado. Lê isAmbienteReal() real pra confirmar
 * que o caminho DEV em jest funciona.
 *
 * Uso:
 *   node -e "require('dotenv').config({path:'.env'}); require('ts-node').register({transpileOnly:true}); require('./scripts/smoke-m52b-melt-gate.ts');"
 */
import { isMeltAtivado } from '../src/financeiro/token-contabil.service';

interface Caso {
  rotulo: string;
  config: { meltAtivado?: boolean | null } | null;
  envOriginal?: string | undefined;
  envApply?: string | undefined;
  esperado: boolean;
}

const ENV_ORIG = process.env.MELT_PRODUCAO_LIBERADA;

const casos: Caso[] = [
  { rotulo: 'config=null → false (gate OFF default)', config: null, esperado: false },
  { rotulo: 'config={} (sem campo) → false', config: {}, esperado: false },
  { rotulo: 'meltAtivado=false → false', config: { meltAtivado: false }, esperado: false },
  { rotulo: 'meltAtivado=null → false', config: { meltAtivado: null }, esperado: false },
  // Em DEV (NODE_ENV != production), isAmbienteReal()=false → dispensa env.
  { rotulo: 'meltAtivado=true em DEV → true (env dispensado)', config: { meltAtivado: true }, esperado: true },
];

function avaliar(c: Caso): { ok: boolean; got: boolean } {
  if (c.envApply !== undefined) {
    process.env.MELT_PRODUCAO_LIBERADA = c.envApply;
  } else {
    delete process.env.MELT_PRODUCAO_LIBERADA;
  }
  const got = isMeltAtivado(c.config);
  return { ok: got === c.esperado, got };
}

function main(): void {
  console.log('\n========================================================================');
  console.log('  SMOKE M52b F4 — Gate dual MELT (isMeltAtivado)');
  console.log('========================================================================');
  console.log(`NODE_ENV: ${process.env.NODE_ENV ?? '(undefined)'}`);

  let okCount = 0;
  let failCount = 0;
  for (const c of casos) {
    const { ok, got } = avaliar(c);
    if (ok) {
      okCount += 1;
      console.log(`  ✅ ${c.rotulo} → ${got}`);
    } else {
      failCount += 1;
      console.log(`  ❌ ${c.rotulo} → ${got} (esperado ${c.esperado})`);
    }
  }

  // Restaurar env
  if (ENV_ORIG === undefined) delete process.env.MELT_PRODUCAO_LIBERADA;
  else process.env.MELT_PRODUCAO_LIBERADA = ENV_ORIG;

  console.log('\n========================================================================');
  console.log(`Resultado: ${okCount}/${casos.length} OK ${failCount > 0 ? `(${failCount} falhas)` : ''}`);
  console.log('========================================================================');

  if (failCount > 0) process.exitCode = 1;
}

main();
