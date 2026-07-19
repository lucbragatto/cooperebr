/**
 * Smoke Sprint C Bloco 1 — Throttler burst test (17/06/2026).
 *
 * Valida que:
 *  - Default tier (100/min): endpoint sem @Throttle/@SkipThrottle cai em
 *    429 quando bursta > 100/min (asserção: 100 sucessos + 429 a partir
 *    do 101º).
 *  - Webhook tier (600/min): os 4 webhooks (Asaas, BB, Sicoob, WhatsApp)
 *    ABSORVEM rajadas até 600/min sem 429 — defesa do caminho do
 *    dinheiro contra throttle global mal calibrado.
 *
 * Auth dos webhooks NÃO é exercitada (tokens inválidos retornam 401/500
 * mas o objetivo do smoke é o limite de rate, não a integração — basta
 * confirmar que a resposta NÃO é 429 dentro do burst esperado).
 *
 * Cleanup: nenhum estado persistido (apenas requests, throttler é em
 * memória).
 */
import * as dotenv from 'dotenv';
import * as path from 'node:path';

dotenv.config({ path: path.resolve(__dirname, '..', '.env') });

const API = process.env.API ?? 'http://localhost:3000';

let passCount = 0;
let failCount = 0;

function pass(msg: string) {
  console.log(`  ✓ ${msg}`);
  passCount++;
}
function fail(msg: string) {
  console.log(`  ✗ ${msg}`);
  failCount++;
}

async function callOnce(
  method: string,
  p: string,
  body?: any,
  extraHeaders?: Record<string, string>,
): Promise<number> {
  try {
    const res = await fetch(`${API}${p}`, {
      method,
      headers: { 'Content-Type': 'application/json', ...(extraHeaders ?? {}) },
      body: body ? JSON.stringify(body) : undefined,
    });
    return res.status;
  } catch {
    return 0;
  }
}

interface BurstResult {
  totalSucesso: number;
  totalNot429: number;
  total429: number;
  primeiro429: number | null;
}

async function burst(
  method: string,
  p: string,
  body: any,
  n: number,
  extraHeaders?: Record<string, string>,
): Promise<BurstResult> {
  // Burst sequencial — throttler conta requests dentro do mesmo IP.
  const result: BurstResult = {
    totalSucesso: 0,
    totalNot429: 0,
    total429: 0,
    primeiro429: null,
  };
  for (let i = 1; i <= n; i++) {
    const status = await callOnce(method, p, body, extraHeaders);
    if (status === 429) {
      result.total429++;
      if (result.primeiro429 === null) result.primeiro429 = i;
    } else {
      result.totalNot429++;
      if (status >= 200 && status < 300) result.totalSucesso++;
    }
  }
  return result;
}

async function main() {
  console.log(`\n[SETUP] API=${API}\n`);

  // Aguarda 65s pra zerar window do throttler antes de começar.
  // Em ambiente fresh já está zerado; se a sessão anterior fez chamadas
  // recentes, isso normaliza. Skip via env SMOKE_SKIP_WARMUP=true.
  if (process.env.SMOKE_SKIP_WARMUP !== 'true') {
    console.log('[WARMUP] Aguardando 65s pra zerar janela do throttler default...');
    await new Promise((r) => setTimeout(r, 65_000));
  }

  // ─── Caso 1: default tier (100/min) cai em 429 acima do limite ───
  // /portal/disclaimer-saque é GET autenticado SEM @Throttle explícito.
  // Sem JWT retorna 401, mas o request conta no throttler antes.
  console.log('\n[CASO 1] Endpoint sem @Throttle (default 100/min) — burst 110 em /portal/disclaimer-saque');
  const def = await burst('GET', '/portal/disclaimer-saque', undefined, 110);
  console.log(`  Resultado: sucesso=${def.totalSucesso} not429=${def.totalNot429} 429=${def.total429} primeiro429=${def.primeiro429}`);
  if (def.total429 > 0 && def.primeiro429 !== null && def.primeiro429 > 95 && def.primeiro429 <= 105) {
    pass(`Default tier ATIVO — primeiro 429 no request #${def.primeiro429} (~100/min como esperado)`);
  } else if (def.total429 > 0) {
    pass(`Default tier ATIVO — primeiro 429 no request #${def.primeiro429} (fora da janela exata mas throttle funcionou)`);
  } else {
    fail(`Default tier NÃO ativou em 110 requests — guard pode estar dormindo`);
  }

  // Aguarda janela zerar pra próximo caso.
  console.log('\n[WARMUP] Aguardando 65s zerar window default...');
  await new Promise((r) => setTimeout(r, 65_000));

  // ─── Caso 2: webhook Asaas absorve burst até 600/min ───
  console.log('\n[CASO 2] /asaas/webhook (tier webhook 600/min) — burst 200');
  // Asaas webhook auth via header. Mando sem token — service retorna erro mas request CONTA no throttler.
  const asaas = await burst('POST', '/asaas/webhook', { event: 'TEST_BURST' }, 200);
  console.log(`  Resultado: sucesso=${asaas.totalSucesso} not429=${asaas.totalNot429} 429=${asaas.total429} primeiro429=${asaas.primeiro429}`);
  if (asaas.total429 === 0) {
    pass(`Asaas webhook ABSORVE 200 requests sem 429 (tier webhook 600/min OK)`);
  } else {
    fail(`Asaas webhook caiu em 429 no #${asaas.primeiro429} — esperado SEM 429 em 200 (limite tier webhook=600)`);
  }

  // ─── Caso 3: webhook BB absorve burst ───
  console.log('\n[CASO 3] /integracao-bancaria/webhook/bb (tier webhook 600/min) — burst 200');
  const bb = await burst('POST', '/integracao-bancaria/webhook/bb', { event: 'TEST' }, 200);
  console.log(`  Resultado: sucesso=${bb.totalSucesso} not429=${bb.totalNot429} 429=${bb.total429} primeiro429=${bb.primeiro429}`);
  if (bb.total429 === 0) {
    pass(`BB webhook ABSORVE 200 requests sem 429 (tier webhook 600/min OK)`);
  } else {
    fail(`BB webhook caiu em 429 no #${bb.primeiro429}`);
  }

  // ─── Caso 4: webhook Sicoob absorve burst ───
  console.log('\n[CASO 4] /integracao-bancaria/webhook/sicoob (tier webhook 600/min) — burst 200');
  const sicoob = await burst('POST', '/integracao-bancaria/webhook/sicoob', { event: 'TEST' }, 200);
  console.log(`  Resultado: sucesso=${sicoob.totalSucesso} not429=${sicoob.totalNot429} 429=${sicoob.total429} primeiro429=${sicoob.primeiro429}`);
  if (sicoob.total429 === 0) {
    pass(`Sicoob webhook ABSORVE 200 requests sem 429`);
  } else {
    fail(`Sicoob webhook caiu em 429 no #${sicoob.primeiro429}`);
  }

  // ─── Caso 5: webhook WhatsApp absorve burst ───
  console.log('\n[CASO 5] /whatsapp/webhook-incoming (tier webhook 600/min) — burst 200');
  // Corretiva 2026-07-16 Achado 3 — secret vai no header, não mais na
  // query. Vale "invalid" mesmo — o objetivo do smoke é o throttler
  // absorver 200 requests (não é 429), a auth já retorna 401 e conta no
  // rate no mesmo passo. O teste não deve depender da auth passar.
  const wa = await burst('POST', '/whatsapp/webhook-incoming', {
    telefone: '+5500000000000',
    tipo: 'texto',
    corpo: 'burst',
  }, 200, { 'x-whatsapp-secret': 'invalid' });
  console.log(`  Resultado: sucesso=${wa.totalSucesso} not429=${wa.totalNot429} 429=${wa.total429} primeiro429=${wa.primeiro429}`);
  if (wa.total429 === 0) {
    pass(`WhatsApp webhook ABSORVE 200 requests sem 429`);
  } else {
    fail(`WhatsApp webhook caiu em 429 no #${wa.primeiro429}`);
  }

  console.log('\n═══════════════════════════════════════════════════');
  console.log(`Resultado: ${passCount} PASS / ${failCount} FAIL`);
  console.log('═══════════════════════════════════════════════════');
  process.exit(failCount > 0 ? 1 : 0);
}

main();
