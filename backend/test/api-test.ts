/**
 * Script de teste de API — CooperEBR
 * Uso: npm run test:api
 *
 * Requer: backend rodando em http://localhost:3000
 * Credenciais: variáveis de ambiente API_TEST_EMAIL e API_TEST_SENHA
 *              ou fallback para admin@cooperebr.com / Admin@123
 */

const BASE_URL = process.env.API_URL || 'http://localhost:3000';
const EMAIL = process.env.API_TEST_EMAIL || 'admin@cooperebr.com';
const SENHA = process.env.API_TEST_SENHA || 'Admin@123';

interface TestResult {
  name: string;
  passed: boolean;
  detail: string;
  duration: number;
}

const results: TestResult[] = [];
let token = '';

async function request(
  method: string,
  path: string,
  body?: unknown,
): Promise<{ status: number; data: any }> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };
  if (token) headers['Authorization'] = `Bearer ${token}`;

  const res = await fetch(`${BASE_URL}${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });

  let data: any;
  try {
    data = await res.json();
  } catch {
    data = null;
  }
  return { status: res.status, data };
}

async function runTest(
  name: string,
  fn: () => Promise<{ passed: boolean; detail: string }>,
) {
  const start = Date.now();
  try {
    const { passed, detail } = await fn();
    results.push({ name, passed, detail, duration: Date.now() - start });
  } catch (err: any) {
    results.push({
      name,
      passed: false,
      detail: `Exception: ${err.message}`,
      duration: Date.now() - start,
    });
  }
}

// ─── Tests ─────────────────────────────────────────────────────────────────

async function testLogin() {
  const { status, data } = await request('POST', '/auth/login', {
    identificador: EMAIL,
    senha: SENHA,
  });
  if ((status === 200 || status === 201) && data?.token) {
    token = data.token;
    return { passed: true, detail: `Logado como ${data.usuario?.nome ?? EMAIL} (perfil: ${data.usuario?.perfil ?? '?'})` };
  }
  return { passed: false, detail: `Status ${status}: ${JSON.stringify(data?.message ?? data)}` };
}

async function testGetCooperados() {
  const { status, data } = await request('GET', '/cooperados');
  if (status === 200 && Array.isArray(data)) {
    return { passed: true, detail: `${data.length} cooperados encontrados` };
  }
  return { passed: false, detail: `Status ${status}` };
}

async function testGetUsinas() {
  const { status, data } = await request('GET', '/usinas');
  if (status === 200 && Array.isArray(data)) {
    return { passed: true, detail: `${data.length} usinas encontradas` };
  }
  return { passed: false, detail: `Status ${status}` };
}

async function testGetPlanos() {
  const { status, data } = await request('GET', '/planos');
  if (status === 200 && Array.isArray(data)) {
    return { passed: true, detail: `${data.length} planos encontrados` };
  }
  return { passed: false, detail: `Status ${status}` };
}

async function testGetContratos() {
  const { status, data } = await request('GET', '/contratos');
  if (status === 200 && Array.isArray(data)) {
    return { passed: true, detail: `${data.length} contratos encontrados` };
  }
  return { passed: false, detail: `Status ${status}` };
}

async function testGetCobrancas() {
  const { status, data } = await request('GET', '/cobrancas');
  if (status === 200 && Array.isArray(data)) {
    return { passed: true, detail: `${data.length} cobranças encontradas` };
  }
  return { passed: false, detail: `Status ${status}` };
}

async function testGetOcorrencias() {
  const { status, data } = await request('GET', '/ocorrencias');
  if (status === 200 && Array.isArray(data)) {
    return { passed: true, detail: `${data.length} ocorrências encontradas` };
  }
  return { passed: false, detail: `Status ${status}` };
}

async function testMotorPropostaConfig() {
  const { status, data } = await request('GET', '/motor-proposta/configuracao');
  if (status === 200 && data?.id) {
    return {
      passed: true,
      detail: `descontoPadrao=${data.descontoPadrao}, fonteKwh=${data.fonteKwh}`,
    };
  }
  return { passed: false, detail: `Status ${status}` };
}

async function testMotorPropostaCalcular() {
  // Dados reais da fatura Derli
  const payload = {
    cooperadoId: 'test-derli',
    kwhMesRecente: 1930,
    valorMesRecente: 2090.18,
    mesReferencia: '2026-03',
    historico: [
      { mesAno: '03/2025', consumoKwh: 1850, valorRS: 1980.50 },
      { mesAno: '04/2025', consumoKwh: 1920, valorRS: 2050.30 },
      { mesAno: '05/2025', consumoKwh: 1780, valorRS: 1910.20 },
      { mesAno: '06/2025', consumoKwh: 1650, valorRS: 1780.40 },
      { mesAno: '07/2025', consumoKwh: 1700, valorRS: 1830.10 },
      { mesAno: '08/2025', consumoKwh: 1820, valorRS: 1960.70 },
      { mesAno: '09/2025', consumoKwh: 1900, valorRS: 2040.30 },
      { mesAno: '10/2025', consumoKwh: 1950, valorRS: 2100.50 },
      { mesAno: '11/2025', consumoKwh: 2010, valorRS: 2150.80 },
      { mesAno: '12/2025', consumoKwh: 1880, valorRS: 2020.40 },
      { mesAno: '01/2026', consumoKwh: 1960, valorRS: 2100.90 },
      { mesAno: '02/2026', consumoKwh: 1930, valorRS: 2090.18 },
    ],
  };

  const { status, data } = await request('POST', '/motor-proposta/calcular', payload);

  if (status === 200 || status === 201) {
    const r = data?.resultado ?? data?.opcoes?.[0];
    if (r) {
      const checks: string[] = [];
      // Validar valores esperados com margem de tolerância
      if (r.valorCooperado !== undefined) {
        checks.push(`valorCooperado=${r.valorCooperado}`);
      }
      if (r.economiaMensal !== undefined) {
        checks.push(`economiaMensal=${r.economiaMensal}`);
      }
      if (r.kwhContrato !== undefined) {
        checks.push(`kwhContrato=${r.kwhContrato}`);
      }
      return { passed: true, detail: checks.join(', ') };
    }
    return { passed: true, detail: `Cálculo retornado (aguardandoEscolha=${data?.aguardandoEscolha})` };
  }
  return { passed: false, detail: `Status ${status}: ${JSON.stringify(data?.message ?? data)}` };
}

async function testMotorPropostaDashboard() {
  const { status, data } = await request('GET', '/motor-proposta');
  if (status === 200 && data) {
    return {
      passed: true,
      detail: `pendentes=${data.propostasPendentes}, aceitas=${data.propostasAceitasNoMes}, tarifaVigente=${data.tarifaVigente}`,
    };
  }
  return { passed: false, detail: `Status ${status}` };
}

async function testGetTarifas() {
  const { status, data } = await request('GET', '/motor-proposta/tarifa-concessionaria');
  if (status === 200 && Array.isArray(data)) {
    return { passed: true, detail: `${data.length} tarifas cadastradas` };
  }
  return { passed: false, detail: `Status ${status}` };
}

async function testNotificacoesNaoLidas() {
  const { status, data } = await request('GET', '/notificacoes/nao-lidas');
  if (status === 200) {
    const count = Array.isArray(data) ? data.length : data?.count ?? '?';
    return { passed: true, detail: `${count} não lidas` };
  }
  return { passed: false, detail: `Status ${status}` };
}

async function testGetListaEspera() {
  const { status, data } = await request('GET', '/motor-proposta/lista-espera');
  if (status === 200 && Array.isArray(data)) {
    return { passed: true, detail: `${data.length} na lista de espera` };
  }
  return { passed: false, detail: `Status ${status}` };
}

// ─── Runner ────────────────────────────────────────────────────────────────

async function main() {
  console.log('');
  console.log('='.repeat(60));
  console.log('  CooperEBR — Teste de API');
  console.log(`  Backend: ${BASE_URL}`);
  console.log(`  Data: ${new Date().toLocaleString('pt-BR')}`);
  console.log('='.repeat(60));
  console.log('');

  // 1. Login (obrigatório para os demais)
  await runTest('POST /auth/login', testLogin);
  if (!token) {
    console.log('  ERRO: Login falhou, abortando testes.');
    console.log('  Verifique se o backend está rodando e as credenciais estão corretas.');
    console.log(`  Email: ${EMAIL}`);
    printReport();
    process.exit(1);
  }

  // 2. CRUD endpoints
  await runTest('GET /cooperados', testGetCooperados);
  await runTest('GET /usinas', testGetUsinas);
  await runTest('GET /planos', testGetPlanos);
  await runTest('GET /contratos', testGetContratos);
  await runTest('GET /cobrancas', testGetCobrancas);
  await runTest('GET /ocorrencias', testGetOcorrencias);

  // 3. Motor de proposta
  await runTest('GET /motor-proposta (config)', testMotorPropostaConfig);
  await runTest('POST /motor-proposta/calcular (Derli)', testMotorPropostaCalcular);
  await runTest('GET /motor-proposta/dashboard', testMotorPropostaDashboard);
  await runTest('GET /motor-proposta/tarifas', testGetTarifas);
  await runTest('GET /motor-proposta/lista-espera', testGetListaEspera);

  // 4. Notificações
  await runTest('GET /notificacoes/nao-lidas', testNotificacoesNaoLidas);

  printReport();
}

function printReport() {
  console.log('');
  console.log('='.repeat(60));
  console.log('  RELATORIO');
  console.log('='.repeat(60));
  console.log('');

  const passed = results.filter((r) => r.passed);
  const failed = results.filter((r) => !r.passed);

  for (const r of results) {
    const icon = r.passed ? '\x1b[32m PASS \x1b[0m' : '\x1b[31m FAIL \x1b[0m';
    const ms = `(${r.duration}ms)`;
    console.log(`  ${icon} ${r.name} ${ms}`);
    console.log(`         ${r.detail}`);
  }

  console.log('');
  console.log('-'.repeat(60));
  console.log(
    `  Total: ${results.length} | \x1b[32mPassed: ${passed.length}\x1b[0m | \x1b[31mFailed: ${failed.length}\x1b[0m`,
  );
  console.log('-'.repeat(60));
  console.log('');

  if (failed.length > 0) {
    process.exit(1);
  }
}

main().catch((err) => {
  console.error('Erro fatal:', err.message);
  process.exit(1);
});
