// CoopereBR — Fase B: Testes automatizados dos endpoints principais
// Executa 3x cada endpoint e gera relatório

const BASE = 'http://localhost:3000';
const RESULTS = [];
let TOKEN = null;

// ─── Helpers ────────────────────────────────────────────────────────────────

async function req(method, path, body = null, useAuth = true) {
  const headers = { 'Content-Type': 'application/json' };
  if (useAuth && TOKEN) headers['Authorization'] = `Bearer ${TOKEN}`;
  const opts = { method, headers };
  if (body) opts.body = JSON.stringify(body);
  const res = await fetch(`${BASE}${path}`, opts);
  let data;
  const text = await res.text();
  try { data = JSON.parse(text); } catch { data = text; }
  return { status: res.status, data };
}

function record(endpoint, run, status, passed, error = '', obs = '') {
  RESULTS.push({ endpoint, run, status, passed, error, obs });
  const icon = passed ? '✅' : '❌';
  console.log(`  ${icon} [${run}] ${status} ${error ? '— ' + error : ''} ${obs ? '(' + obs + ')' : ''}`);
}

// ─── Test functions ─────────────────────────────────────────────────────────

async function testLogin() {
  console.log('\n=== POST /auth/login ===');

  // Try known passwords
  const passwords = ['admin123', 'cooperebr123', 'Admin123!', 'Coopere@123', 'SuperAdmin@2026'];
  let loggedIn = false;

  for (const pwd of passwords) {
    try {
      const r = await req('POST', '/auth/login', { identificador: 'admin@cooperebr.com.br', senha: pwd }, false);
      if (r.status === 200 || r.status === 201) {
        TOKEN = r.data?.token || r.data?.access_token;
        console.log(`  ✓ Login OK with password hint (status ${r.status})`);
        loggedIn = true;
        break;
      }
    } catch {}
  }

  // Try superadmin
  if (!loggedIn) {
    for (const email of ['superadmin@cooperebr.com.br']) {
      for (const pwd of ['SuperAdmin@2026', 'Coopere@123', 'admin123']) {
        try {
          const r = await req('POST', '/auth/login', { identificador: email, senha: pwd }, false);
          if (r.status === 200 || r.status === 201) {
            TOKEN = r.data?.token || r.data?.access_token;
            console.log(`  ✓ Login OK as ${email} (status ${r.status})`);
            loggedIn = true;
            break;
          }
        } catch {}
        if (loggedIn) break;
      }
      if (loggedIn) break;
    }
  }

  // Try test credentials from env
  if (!loggedIn) {
    try {
      const r = await req('POST', '/auth/login', { identificador: 'teste@cooperebr.com', senha: 'Coopere@123' }, false);
      if (r.status === 200 || r.status === 201) {
        TOKEN = r.data?.token || r.data?.access_token;
        console.log(`  ✓ Login OK as teste@cooperebr.com (status ${r.status})`);
        loggedIn = true;
      }
    } catch {}
  }

  // Now run 3x valid login tests
  for (let i = 1; i <= 3; i++) {
    try {
      const r = await req('POST', '/auth/login', { identificador: 'superadmin@cooperebr.com.br', senha: 'SuperAdmin@2026' }, false);
      const ok = r.status === 200 || r.status === 201;
      if (ok && !TOKEN) TOKEN = r.data?.token || r.data?.access_token;
      record('POST /auth/login (válido)', i, r.status, ok,
        ok ? '' : (r.data?.message || JSON.stringify(r.data)),
        ok ? 'token recebido' : '');
    } catch (e) {
      record('POST /auth/login (válido)', i, 'ERR', false, e.message);
    }
  }

  // 3x invalid login
  for (let i = 1; i <= 3; i++) {
    try {
      const r = await req('POST', '/auth/login', { identificador: 'invalid@test.com', senha: 'wrong' }, false);
      const ok = r.status === 401 || r.status === 400 || r.status === 404;
      record('POST /auth/login (inválido)', i, r.status, ok,
        ok ? '' : 'Deveria retornar 401/400',
        typeof r.data === 'object' ? r.data?.message : '');
    } catch (e) {
      record('POST /auth/login (inválido)', i, 'ERR', false, e.message);
    }
  }
}

async function testAuthMe() {
  console.log('\n=== GET /auth/me ===');

  // 3x with token
  for (let i = 1; i <= 3; i++) {
    try {
      const r = await req('GET', '/auth/me');
      const ok = r.status === 200;
      record('GET /auth/me (c/ token)', i, r.status, ok,
        ok ? '' : (r.data?.message || ''),
        ok ? `perfil: ${r.data?.perfil || r.data?.user?.perfil}` : '');
    } catch (e) {
      record('GET /auth/me (c/ token)', i, 'ERR', false, e.message);
    }
  }

  // 3x without token
  for (let i = 1; i <= 3; i++) {
    try {
      const r = await req('GET', '/auth/me', null, false);
      const ok = r.status === 401;
      record('GET /auth/me (s/ token)', i, r.status, ok,
        ok ? '' : `Esperado 401, recebeu ${r.status}`);
    } catch (e) {
      record('GET /auth/me (s/ token)', i, 'ERR', false, e.message);
    }
  }
}

async function testEsqueciSenha() {
  console.log('\n=== POST /auth/esqueci-senha ===');
  for (let i = 1; i <= 3; i++) {
    try {
      const r = await req('POST', '/auth/esqueci-senha', { email: 'superadmin@cooperebr.com.br' }, false);
      const ok = r.status === 200 || r.status === 201;
      record('POST /auth/esqueci-senha', i, r.status, ok,
        ok ? '' : (r.data?.message || JSON.stringify(r.data)));
    } catch (e) {
      record('POST /auth/esqueci-senha', i, 'ERR', false, e.message);
    }
  }
}

async function testWhatsappStatus() {
  console.log('\n=== GET /whatsapp/status ===');
  for (let i = 1; i <= 3; i++) {
    try {
      const r = await req('GET', '/whatsapp/status');
      const ok = r.status === 200;
      record('GET /whatsapp/status', i, r.status, ok,
        ok ? '' : (r.data?.message || JSON.stringify(r.data)),
        ok ? `connected: ${JSON.stringify(r.data?.connected ?? r.data)}` : '');
    } catch (e) {
      record('GET /whatsapp/status', i, 'ERR', false, e.message);
    }
  }
}

async function testWhatsappConversas() {
  console.log('\n=== GET /whatsapp/conversas ===');
  for (let i = 1; i <= 3; i++) {
    try {
      const r = await req('GET', '/whatsapp/conversas');
      const ok = r.status === 200;
      record('GET /whatsapp/conversas', i, r.status, ok,
        ok ? '' : (r.data?.message || ''),
        ok ? `total: ${Array.isArray(r.data) ? r.data.length : '?'}` : '');
    } catch (e) {
      record('GET /whatsapp/conversas', i, 'ERR', false, e.message);
    }
  }
}

async function testWhatsappHistorico() {
  console.log('\n=== GET /whatsapp/historico ===');
  for (let i = 1; i <= 3; i++) {
    try {
      const r = await req('GET', '/whatsapp/historico');
      const ok = r.status === 200;
      record('GET /whatsapp/historico', i, r.status, ok,
        ok ? '' : (r.data?.message || ''),
        ok ? `msgs: ${Array.isArray(r.data) ? r.data.length : '?'}` : '');
    } catch (e) {
      record('GET /whatsapp/historico', i, 'ERR', false, e.message);
    }
  }
}

async function testWhatsappListas() {
  console.log('\n=== GET /whatsapp/listas ===');
  for (let i = 1; i <= 3; i++) {
    try {
      const r = await req('GET', '/whatsapp/listas');
      const ok = r.status === 200;
      record('GET /whatsapp/listas', i, r.status, ok,
        ok ? '' : (r.data?.message || ''),
        ok ? `total: ${Array.isArray(r.data) ? r.data.length : '?'}` : '');
    } catch (e) {
      record('GET /whatsapp/listas', i, 'ERR', false, e.message);
    }
  }
}

async function testWhatsappCooperadosDisparo() {
  console.log('\n=== GET /whatsapp/cooperados-para-disparo ===');
  for (let i = 1; i <= 3; i++) {
    try {
      const r = await req('GET', '/whatsapp/cooperados-para-disparo');
      const ok = r.status === 200;
      record('GET /whatsapp/cooperados-para-disparo', i, r.status, ok,
        ok ? '' : (r.data?.message || ''),
        ok ? `total: ${Array.isArray(r.data) ? r.data.length : '?'}` : '');
    } catch (e) {
      record('GET /whatsapp/cooperados-para-disparo', i, 'ERR', false, e.message);
    }
  }
}

async function testWebhookTexto() {
  console.log('\n=== POST /whatsapp/webhook-incoming (texto) ===');
  for (let i = 1; i <= 3; i++) {
    try {
      const r = await req('POST', '/whatsapp/webhook-incoming', {
        telefone: '5511999990001',
        tipo: 'texto',
        corpo: 'Olá, gostaria de informações sobre energia solar',
      }, false);
      const ok = r.status === 200 || r.status === 201;
      record('POST /whatsapp/webhook-incoming (texto)', i, r.status, ok,
        ok ? '' : (r.data?.message || JSON.stringify(r.data)));
    } catch (e) {
      record('POST /whatsapp/webhook-incoming (texto)', i, 'ERR', false, e.message);
    }
  }
}

async function testWebhookDocumento() {
  console.log('\n=== POST /whatsapp/webhook-incoming (documento) ===');
  for (let i = 1; i <= 3; i++) {
    try {
      const r = await req('POST', '/whatsapp/webhook-incoming', {
        telefone: '5511999990002',
        tipo: 'documento',
        mimeType: 'application/pdf',
        mediaBase64: 'dGVzdGU=', // fake base64, just structure test
      }, false);
      const ok = r.status === 200 || r.status === 201;
      record('POST /whatsapp/webhook-incoming (documento)', i, r.status, ok,
        ok ? '' : (r.data?.message || JSON.stringify(r.data)),
        'estrutura sem base64 real');
    } catch (e) {
      record('POST /whatsapp/webhook-incoming (documento)', i, 'ERR', false, e.message);
    }
  }
}

async function testCooperadosListar() {
  console.log('\n=== GET /cooperados ===');
  for (let i = 1; i <= 3; i++) {
    try {
      const r = await req('GET', '/cooperados');
      const ok = r.status === 200;
      record('GET /cooperados', i, r.status, ok,
        ok ? '' : (r.data?.message || ''),
        ok ? `total: ${Array.isArray(r.data) ? r.data.length : '?'}` : '');
    } catch (e) {
      record('GET /cooperados', i, 'ERR', false, e.message);
    }
  }
}

async function testFilaEsperaCount() {
  console.log('\n=== GET /cooperados/fila-espera/count ===');
  for (let i = 1; i <= 3; i++) {
    try {
      const r = await req('GET', '/cooperados/fila-espera/count');
      const ok = r.status === 200 && r.data?.count !== undefined;
      record('GET /cooperados/fila-espera/count', i, r.status, ok,
        ok ? '' : (r.data?.message || ''),
        ok ? `count: ${r.data.count}` : '');
    } catch (e) {
      record('GET /cooperados/fila-espera/count', i, 'ERR', false, e.message);
    }
  }
}

async function testCriarCooperado() {
  console.log('\n=== POST /cooperados (criar) ===');
  for (let i = 1; i <= 3; i++) {
    const ts = Date.now();
    try {
      const r = await req('POST', '/cooperados', {
        nomeCompleto: `Teste Auto ${ts}_${i}`,
        cpf: `000.000.00${i}-${String(ts).slice(-2)}`,
        email: `teste_auto_${ts}_${i}@test.com`,
        telefone: `5511${String(ts).slice(-4)}000${i}`,
      });
      const ok = r.status === 200 || r.status === 201;
      record('POST /cooperados (criar)', i, r.status, ok,
        ok ? '' : (r.data?.message || JSON.stringify(r.data)),
        ok ? `id: ${r.data?.id}` : '');
    } catch (e) {
      record('POST /cooperados (criar)', i, 'ERR', false, e.message);
    }
  }
}

async function testIndicacoesMeuLink() {
  console.log('\n=== GET /indicacoes/meu-link (cooperadoId null) ===');
  for (let i = 1; i <= 3; i++) {
    try {
      // Call without cooperadoId — should return safe default
      const r = await req('GET', '/indicacoes/meu-link');
      const ok = r.status === 200;
      record('GET /indicacoes/meu-link (null)', i, r.status, ok,
        ok ? '' : (r.data?.message || ''),
        ok ? `semCooperado: ${r.data?.semCooperado}` : '');
    } catch (e) {
      record('GET /indicacoes/meu-link (null)', i, 'ERR', false, e.message);
    }
  }
}

async function testConviteInvalido() {
  console.log('\n=== GET /publico/convite/codigo-invalido ===');
  for (let i = 1; i <= 3; i++) {
    try {
      const r = await req('GET', '/publico/convite/codigo-invalido', null, false);
      const ok = r.status === 200 && r.data?.valido === false;
      record('GET /publico/convite/codigo-invalido', i, r.status, ok,
        ok ? '' : `valido=${r.data?.valido}`,
        ok ? 'retornou { valido: false }' : '');
    } catch (e) {
      record('GET /publico/convite/codigo-invalido', i, 'ERR', false, e.message);
    }
  }
}

async function testIniciarCadastro() {
  console.log('\n=== POST /publico/iniciar-cadastro ===');
  for (let i = 1; i <= 3; i++) {
    try {
      const r = await req('POST', '/publico/iniciar-cadastro', {
        nome: `Teste Cadastro ${i}`,
        telefone: `5511999880${String(i).padStart(3, '0')}`,
      }, false);
      const ok = r.status === 200 || r.status === 201;
      record('POST /publico/iniciar-cadastro', i, r.status, ok,
        ok ? '' : (r.data?.message || JSON.stringify(r.data)),
        'pode falhar envio WhatsApp (esperado)');
    } catch (e) {
      record('POST /publico/iniciar-cadastro', i, 'ERR', false, e.message);
    }
  }
}

async function testPlanosAtivos() {
  console.log('\n=== GET /planos/ativos ===');
  for (let i = 1; i <= 3; i++) {
    try {
      const r = await req('GET', '/planos/ativos', null, false);
      const ok = r.status === 200;
      record('GET /planos/ativos', i, r.status, ok,
        ok ? '' : (r.data?.message || ''),
        ok ? `total: ${Array.isArray(r.data) ? r.data.length : '?'}` : '');
    } catch (e) {
      record('GET /planos/ativos', i, 'ERR', false, e.message);
    }
  }
}

async function testMotorPropostaCalcular() {
  console.log('\n=== POST /motor-proposta/calcular ===');
  for (let i = 1; i <= 3; i++) {
    try {
      const r = await req('POST', '/motor-proposta/calcular', {
        cooperadoId: 'test-id-inexistente',
        historico: [
          { mesAno: '2025-01', consumoKwh: 350, valorRS: 280 },
          { mesAno: '2025-02', consumoKwh: 400, valorRS: 320 },
          { mesAno: '2025-03', consumoKwh: 370, valorRS: 296 },
        ],
        kwhMesRecente: 370,
        valorMesRecente: 296,
        mesReferencia: '2025-03',
      });
      // May fail because cooperadoId doesn't exist — that's OK,
      // we check it doesn't crash with 500
      const ok = r.status === 200 || r.status === 201 || r.status === 400 || r.status === 404;
      record('POST /motor-proposta/calcular', i, r.status, ok,
        ok ? '' : (r.data?.message || JSON.stringify(r.data)),
        r.status === 200 ? 'cálculo OK' : `resposta: ${r.data?.message || ''}`);
    } catch (e) {
      record('POST /motor-proposta/calcular', i, 'ERR', false, e.message);
    }
  }
}

// ─── Main ───────────────────────────────────────────────────────────────────

async function main() {
  console.log('╔══════════════════════════════════════════════════════════════╗');
  console.log('║  CoopereBR — Teste Automatizado de Endpoints (Fase B)      ║');
  console.log('║  Data: 2026-03-24                                          ║');
  console.log('╚══════════════════════════════════════════════════════════════╝');

  // Check server is up
  try {
    await fetch(`${BASE}/planos/ativos`);
    console.log('\n✓ Servidor acessível em ' + BASE);
  } catch (e) {
    console.error('\n✗ Servidor NÃO acessível em ' + BASE);
    console.error('  Certifique-se de que o backend está rodando.');
    process.exit(1);
  }

  // Auth
  await testLogin();
  if (!TOKEN) {
    console.error('\n⚠ AVISO: Não foi possível obter token JWT. Endpoints autenticados falharão.');
  }
  await testAuthMe();
  await testEsqueciSenha();

  // WhatsApp
  await testWhatsappStatus();
  await testWhatsappConversas();
  await testWhatsappHistorico();
  await testWhatsappListas();
  await testWhatsappCooperadosDisparo();
  await testWebhookTexto();
  await testWebhookDocumento();

  // Cooperados
  await testCooperadosListar();
  await testFilaEsperaCount();
  await testCriarCooperado();

  // Indicações
  await testIndicacoesMeuLink();

  // Público
  await testConviteInvalido();
  await testIniciarCadastro();

  // Planos
  await testPlanosAtivos();

  // Motor de proposta
  await testMotorPropostaCalcular();

  // ─── Generate Report ────────────────────────────────────────────────────

  const totalTests = RESULTS.length;
  const passed = RESULTS.filter(r => r.passed).length;
  const failed = RESULTS.filter(r => !r.passed).length;

  // Group by endpoint
  const endpoints = [...new Set(RESULTS.map(r => r.endpoint))];
  const endpointsPassed = endpoints.filter(ep => RESULTS.filter(r => r.endpoint === ep).every(r => r.passed)).length;
  const endpointsFailed = endpoints.length - endpointsPassed;

  console.log('\n════════════════════════════════════════════════════════════');
  console.log(`RESUMO: ${passed}/${totalTests} testes passaram (${endpointsPassed}/${endpoints.length} endpoints 100% OK)`);
  console.log('════════════════════════════════════════════════════════════');

  // Build markdown report
  let md = `---\ngerado: 2026-03-25\ntipo: relatório de testes automatizados\n---\n\n`;
  md += `# Relatório de Testes — CoopereBR Backend\n\n`;
  md += `**Data:** 2026-03-24 (execução) / 2026-03-25 (relatório)\n`;
  md += `**Base URL:** ${BASE}\n`;
  md += `**Autenticação:** ${TOKEN ? 'Token JWT obtido com sucesso' : '⚠ Falha ao obter token'}\n\n`;
  md += `## Resumo\n\n`;
  md += `| Métrica | Valor |\n|---------|-------|\n`;
  md += `| Testes executados | ${totalTests} |\n`;
  md += `| Testes passando | ${passed} ✅ |\n`;
  md += `| Testes falhando | ${failed} ❌ |\n`;
  md += `| Endpoints testados | ${endpoints.length} |\n`;
  md += `| Endpoints 100% OK | ${endpointsPassed} ✅ |\n`;
  md += `| Endpoints com falha | ${endpointsFailed} ❌ |\n\n`;

  md += `## Resultados Detalhados\n\n`;

  for (const ep of endpoints) {
    const tests = RESULTS.filter(r => r.endpoint === ep);
    const allOk = tests.every(t => t.passed);
    md += `### ${allOk ? '✅' : '❌'} ${ep}\n\n`;
    md += `| Run | Status | Resultado | Erro | Observação |\n`;
    md += `|-----|--------|-----------|------|------------|\n`;
    for (const t of tests) {
      md += `| ${t.run} | ${t.status} | ${t.passed ? '✅' : '❌'} | ${t.error} | ${t.obs} |\n`;
    }
    md += `\n`;
  }

  // Failures section
  const failedEndpoints = endpoints.filter(ep => RESULTS.filter(r => r.endpoint === ep).some(r => !r.passed));
  if (failedEndpoints.length > 0) {
    md += `## Falhas e Sugestões de Correção\n\n`;
    for (const ep of failedEndpoints) {
      const tests = RESULTS.filter(r => r.endpoint === ep && !r.passed);
      md += `### ${ep}\n\n`;
      md += `**Sintoma:** Status ${tests[0].status} — ${tests[0].error}\n\n`;

      // Suggest fixes based on patterns
      if (tests[0].status === 401 || tests[0].status === 'ERR') {
        md += `**Sugestão:** Verificar se o token JWT está válido e se o usuário tem as permissões necessárias (perfil ADMIN/SUPER_ADMIN).\n\n`;
      } else if (tests[0].status === 500) {
        md += `**Sugestão:** Erro interno do servidor — verificar logs do backend para stack trace completo. Possível problema no service ou na query ao banco.\n\n`;
      } else if (tests[0].status === 400) {
        md += `**Sugestão:** Validação do body falhou — verificar DTO e campos obrigatórios.\n\n`;
      } else if (tests[0].status === 404) {
        md += `**Sugestão:** Rota não encontrada — verificar se o módulo está importado no AppModule e se o path está correto.\n\n`;
      } else {
        md += `**Sugestão:** Investigar resposta inesperada. Verificar controller e service correspondente.\n\n`;
      }
    }
  }

  md += `## Notas\n\n`;
  md += `- Cada endpoint foi testado 3 vezes para verificar consistência\n`;
  md += `- Webhook WhatsApp com documento usa base64 fake (apenas teste de estrutura)\n`;
  md += `- POST /publico/iniciar-cadastro pode falhar no envio de WhatsApp (esperado em ambiente de teste)\n`;
  md += `- POST /motor-proposta/calcular usa cooperadoId inexistente — verifica se não dá 500\n`;
  md += `- POST /cooperados cria registros de teste (limpar após testes se necessário)\n`;

  // Write report
  const fs = await import('fs');
  fs.writeFileSync('C:/Users/Luciano/cooperebr/memory/RELATORIO-TESTES-2026-03-25.md', md, 'utf-8');
  console.log('\n📄 Relatório salvo em memory/RELATORIO-TESTES-2026-03-25.md');

  // Also output to stdout for inspection
  if (failed > 0) {
    console.log('\n── Falhas encontradas: ──');
    for (const r of RESULTS.filter(r => !r.passed)) {
      console.log(`  ❌ ${r.endpoint} [${r.run}]: ${r.status} — ${r.error}`);
    }
  }
}

main().catch(e => {
  console.error('Erro fatal:', e);
  process.exit(1);
});
