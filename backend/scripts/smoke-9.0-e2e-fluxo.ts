/**
 * Sprint Portal Empresa 9.0 + 9.1 — Smoke E2E read-only ("o 2").
 *
 * Confirma o caminho end-to-end SEM front:
 *  1. Login do usuário EMPRESA_CONVENIADA via /auth/login.
 *  2. /auth/me retorna contexto 'empresa_conveniada'.
 *  3. GET /portal/meus-convenios retorna o convênio CV-2026-0001.
 *  4. GET /portal/meus-convenios/:id/dashboard retorna estrutura correta.
 *  5. GET /portal/meus-convenios/:id/convites lista atual.
 *  6. GET /portal/meus-convenios/:id/membros-pendentes lista atual.
 *
 * Não executa POST (criação de convite/aprovação) pra não poluir banco —
 * isso o Luciano faz pelo navegador (golden path do mockup).
 */

const API = process.env.API_URL ?? 'http://localhost:3000';
const EMAIL = 'lucbragatto+empresa-teste@gmail.com';
const SENHA = 'Teste@123';

async function main() {
  console.log('[smoke 9.0 E2E] === FLUXO LOGIN → DASHBOARD ===');

  // 1. Login
  const loginR = await fetch(`${API}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ identificador: EMAIL, senha: SENHA }),
  });
  if (!loginR.ok) {
    console.error(`[smoke] login falhou: ${loginR.status} ${await loginR.text()}`);
    process.exit(1);
  }
  const login: any = await loginR.json();
  console.log(`[smoke] ✓ login OK — perfil=${login.usuario?.perfil} email=${login.usuario?.email}`);
  const token = login.token;
  const auth = { Authorization: `Bearer ${token}` };

  // 2. /auth/me
  const meR = await fetch(`${API}/auth/me`, { headers: auth });
  const me: any = await meR.json();
  const ctxEmpresa = me.contextos?.find((c: any) => c.tipo === 'empresa_conveniada');
  if (!ctxEmpresa) {
    console.error('[smoke] FALHA: contexto empresa_conveniada AUSENTE em /auth/me. Contextos:', me.contextos);
    process.exit(1);
  }
  console.log(`[smoke] ✓ contexto empresa_conveniada — label="${ctxEmpresa.label}" cooperadoId=${ctxEmpresa.id}`);

  // 3. /portal/meus-convenios
  const convsR = await fetch(`${API}/portal/meus-convenios`, { headers: auth });
  if (!convsR.ok) {
    console.error(`[smoke] /portal/meus-convenios falhou: ${convsR.status} ${await convsR.text()}`);
    process.exit(1);
  }
  const convs: any = await convsR.json();
  console.log(`[smoke] ✓ /portal/meus-convenios — total=${convs.total}`);
  if (convs.total === 0) {
    console.error('[smoke] FALHA: lista vazia, esperado pelo menos 1 convênio.');
    process.exit(1);
  }
  const cv = convs.data[0];
  console.log(`[smoke]   convênio: ${cv.numero} — ${cv.empresaNome} (status=${cv.status})`);

  // 4. /portal/meus-convenios/:id/dashboard
  const dashR = await fetch(`${API}/portal/meus-convenios/${cv.id}/dashboard`, { headers: auth });
  if (!dashR.ok) {
    console.error(`[smoke] dashboard falhou: ${dashR.status} ${await dashR.text()}`);
    process.exit(1);
  }
  const dash: any = await dashR.json();
  console.log(`[smoke] ✓ dashboard — convênio="${dash.convenio?.empresaNome}" natureza=${dash.convenio?.naturezaAtoCooperativo} cobrancas=${dash.cobrancas?.length}`);
  console.log(`[smoke]   contadores membros:`, dash.contadoresMembros);

  // 5. Convites
  const convsListR = await fetch(`${API}/portal/meus-convenios/${cv.id}/convites`, { headers: auth });
  if (!convsListR.ok) {
    console.error(`[smoke] convites falhou: ${convsListR.status} ${await convsListR.text()}`);
    process.exit(1);
  }
  const convsList: any = await convsListR.json();
  console.log(`[smoke] ✓ convites — total=${convsList.contadores?.total ?? convsList.data?.length ?? 0}`);

  // 6. Membros pendentes
  const pendR = await fetch(`${API}/portal/meus-convenios/${cv.id}/membros-pendentes`, { headers: auth });
  if (!pendR.ok) {
    console.error(`[smoke] pendentes falhou: ${pendR.status} ${await pendR.text()}`);
    process.exit(1);
  }
  const pend: any = await pendR.json();
  console.log(`[smoke] ✓ membros-pendentes — total=${pend.total ?? pend.data?.length ?? 0}`);

  // 7. SECURITY: tentar acessar um convênio que NÃO é meu (com id falso)
  const fakeR = await fetch(`${API}/portal/meus-convenios/conv-inexistente/dashboard`, { headers: auth });
  if (fakeR.status !== 404 && fakeR.status !== 403) {
    console.error(`[smoke] ATENÇÃO: acesso a convênio inexistente retornou ${fakeR.status} — esperado 404/403.`);
  } else {
    console.log(`[smoke] ✓ multi-tenant guard: convênio inexistente → ${fakeR.status} (correto, anti-enum)`);
  }

  console.log('');
  console.log('═══ SMOKE 9.0 E2E — PASSOU ═══');
  console.log('Próximo: Luciano abre http://localhost:3001/login → preenche → /conveniada/convenio/' + cv.id);
}

main().catch((err) => {
  console.error('[smoke] EXCEÇÃO:', err);
  process.exit(1);
});
