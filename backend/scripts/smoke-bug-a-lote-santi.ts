/**
 * Smoke E2E — Bug A (lote Santi) — 10/06/2026
 *
 * Valida ao vivo no backend rodando em :3000 que `enviarLinkPorWhatsapp`
 * propaga FALHOU + motivo (commit 56b7666) através do fluxo completo:
 *  1. Login Santi (lucbragatto+santi@gmail.com / Santi@2026)
 *  2. Troca pro contexto empresa_conveniada (CV-SANTI-001)
 *  3. POST /portal/meus-convenios/:id/convites/lote/enviar com 2 destinatários:
 *     - "Smoke Whitelist" / 5527981341348 (whitelisted Luciano)
 *     - "Smoke Nao Whitelist" / 27999111222 (não-whitelisted, fora prefixos fake)
 *  4. Aguarda 7s (throttle 2s × 2 + margem)
 *  5. GET status do lote → confirma 1 ENVIADO + 1 FALHOU (whitelist-dev)
 *
 * Regra de contatos de teste preservada: nenhum disparo real pra número que
 * não seja do Luciano. O número não-whitelisted é BLOQUEADO pelo guard de
 * whitelist em DEV — sender retorna {enviado:false, motivo:'whitelist-dev'}
 * sem chegar perto do WhatsApp Web.
 */

const API = process.env.API ?? 'http://localhost:3000';
const CONVENIO_ID = 'cmq6qo5ly0007va2w6hilvs2a';
const EMPRESA_COOPERADO_ID = 'cmq6qo4hi0002va2wti5k1sqw'; // Santi PJ
const COOPERATIVA_ID = 'cmn0ho8bx0000uox8wu96u6fd'; // CoopereBR

async function call(method: string, path: string, opts: { token?: string; body?: any } = {}) {
  const res = await fetch(`${API}${path}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(opts.token ? { Authorization: `Bearer ${opts.token}` } : {}),
    },
    body: opts.body ? JSON.stringify(opts.body) : undefined,
  });
  const text = await res.text();
  let json: any;
  try { json = JSON.parse(text); } catch { json = text; }
  if (!res.ok) {
    throw new Error(`HTTP ${res.status} ${method} ${path}: ${text}`);
  }
  return json;
}

async function main() {
  console.log('[smoke] 1. Login Santi...');
  const login = await call('POST', '/auth/login', {
    body: { identificador: 'lucbragatto+santi@gmail.com', senha: 'Santi@2026' },
  });
  const baseToken: string = login.token ?? login.access_token;
  console.log(`[smoke]    token base OK (len=${baseToken.length})`);

  console.log('[smoke] 2. Troca contexto → empresa_conveniada...');
  const troca = await call('POST', '/auth/trocar-contexto', {
    token: baseToken,
    body: {
      contexto: 'empresa_conveniada',
      cooperativaId: COOPERATIVA_ID,
      cooperadoId: EMPRESA_COOPERADO_ID,
    },
  });
  const empresaToken: string = troca.token ?? troca.access_token;
  console.log(`[smoke]    token empresa OK (len=${empresaToken.length})`);

  console.log('[smoke] 3. POST lote/enviar (1 whitelisted + 1 não-whitelisted)...');
  const lote = await call('POST', `/portal/meus-convenios/${CONVENIO_ID}/convites/lote/enviar`, {
    token: empresaToken,
    body: {
      destinatarios: [
        { nome: 'Smoke Whitelist', telefone: '5527981341348' },
        { nome: 'Smoke Nao Whitelist', telefone: '27999111222' },
      ],
    },
  });
  console.log(`[smoke]    loteId=${lote.loteId} total=${lote.total}`);

  console.log('[smoke] 4. Aguardando 7s (throttle 2s × 2 + margem)...');
  await new Promise((r) => setTimeout(r, 7000));

  console.log('[smoke] 5. GET status do lote...');
  const status = await call(
    'GET',
    `/portal/meus-convenios/${CONVENIO_ID}/convites/lote/${lote.loteId}/status`,
    { token: empresaToken },
  );
  console.log(`[smoke]    resumo:`, status.resumo);
  console.log(`[smoke]    itens:`);
  for (const it of status.itens ?? []) {
    console.log(
      `[smoke]      • ${it.nomeConvidado.padEnd(22)} | ...${it.telefoneSufixo} | ${it.statusEnvio.padEnd(8)} | erro=${it.erro ?? '-'}`,
    );
  }

  // Assertivas
  const r = status.resumo;
  const enviados = (status.itens ?? []).filter((i: any) => i.statusEnvio === 'ENVIADO');
  const falhou = (status.itens ?? []).filter((i: any) => i.statusEnvio === 'FALHOU');

  let ok = true;
  if (r.enviado !== 1) {
    console.log(`[smoke] ❌ Esperado 1 ENVIADO, recebido ${r.enviado}`);
    ok = false;
  }
  if (r.falhou !== 1) {
    console.log(`[smoke] ❌ Esperado 1 FALHOU, recebido ${r.falhou}`);
    ok = false;
  }
  const naoWhitelist = falhou.find((i: any) => i.nomeConvidado === 'Smoke Nao Whitelist');
  if (!naoWhitelist) {
    console.log('[smoke] ❌ "Smoke Nao Whitelist" não está em FALHOU');
    ok = false;
  } else if (naoWhitelist.erro !== 'whitelist-dev') {
    console.log(`[smoke] ❌ Motivo errado: esperado "whitelist-dev", recebido "${naoWhitelist.erro}"`);
    ok = false;
  } else {
    console.log('[smoke] ✅ Bug A confirmado: não-whitelist → FALHOU + erro=whitelist-dev');
  }
  const whitelistEnviado = enviados.find((i: any) => i.nomeConvidado === 'Smoke Whitelist');
  if (!whitelistEnviado) {
    console.log('[smoke] ❌ "Smoke Whitelist" não está em ENVIADO');
    ok = false;
  } else {
    console.log('[smoke] ✅ Whitelisted → ENVIADO');
  }

  if (!ok) process.exit(1);
  console.log('[smoke] 🟢 SMOKE PASS — Bug A end-to-end OK');
}

main().catch((err) => {
  console.error('[smoke] 💥 ERRO:', err.message);
  process.exit(1);
});
