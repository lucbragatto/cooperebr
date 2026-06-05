/**
 * Smoke E2E PROGRAMÁTICO — golden paths /cadastro?conv= e /cadastro?ref=.
 *
 * Roda contra o backend de DEV (http://localhost:3000) com PRISMA direto pro
 * setup/teardown. Não usa Playwright/browser. Não dispara WhatsApp real
 * (telefone alvo whitelisted; também faz bypass OTP via DB direto).
 *
 * Cenários:
 *  A) ?conv= — convite Clínica teste, sem ?tenant=, validando o fix
 *     D-novo-CADWEB-CONV-TENANT (resolução server-side via token).
 *  B) ?ref= — indicação MLM clássica, validando que Indicacao é criada.
 *
 * Reporta TODAS as falhas no fim (não para no primeiro erro).
 */
import { PrismaClient } from '@prisma/client';
import { randomBytes, createHash } from 'crypto';

const prisma = new PrismaClient();

const API = process.env.SMOKE_API_URL ?? 'http://localhost:3000';
const TELEFONE_TESTE = '5527981341348';

// Convite usa @@unique([convenioId, telefone]) — pra rodar smoke múltiplas vezes,
// geramos telefone único por execução (anonimizado / bloqueado defensivamente
// em whitelist-teste.ts:90 — `551199988…` está no PREFIXOS_FAKE).
// Inclui timestamp (ms) na seed pra evitar colisão com smokes anteriores cujo
// cleanup falhou ou que ainda têm convite ativo.
function telefoneSmokeUnico(seedHex: string): string {
  const h = createHash('sha256')
    .update(seedHex + ':' + Date.now())
    .digest('hex');
  const digits = (BigInt('0x' + h.slice(0, 8)) % 1000n).toString().padStart(3, '0');
  return '5511999988' + digits;
}
const TENANT_COOP = 'cmn0ho8bx0000uox8wu96u6fd'; // CoopereBR
const CONVENIO_ID = 'cmpwof5h6000avaf8547cj3pb'; // Clínica teste
const INDICADOR_ID = 'cmpwnuid50006vaf8th51y2s7'; // Clínica Teste cooperado
const INDICADOR_COD = 'cmpwnuid50007vaf8wx9498bl'; // codigoIndicacao do acima
const ADMIN_USER_ID = 'cmn3oj8040002uobotvxu872q'; // superadmin

const failures: Array<{ cenario: string; passo: string; esperado: string; obtido: string }> = [];

function fail(cenario: string, passo: string, esperado: string, obtido: string) {
  failures.push({ cenario, passo, esperado, obtido });
  console.error(`❌ [${cenario}] ${passo}\n   esperado: ${esperado}\n   obtido:   ${obtido}`);
}

function ok(cenario: string, passo: string, detalhe = '') {
  console.log(`✅ [${cenario}] ${passo}${detalhe ? ' — ' + detalhe : ''}`);
}

// ─── Payload do wizard /cadastro ─────────────────────────────────────
// Gera CPF/UC/email determinísticos a partir de uma seed hex (sufixo).
// Substitui versão anterior (parseInt(suffix.slice(-9), 36) → NaN quando
// suffix continha char fora do base36, ex: 'a3b4_dup').
function makePayload(seedHex: string) {
  // Hash determinístico → 11 dígitos pro CPF, 6 dígitos pro UC.
  const h = createHash('sha256').update(seedHex).digest('hex');
  const cpf = String(
    BigInt('0x' + h.slice(0, 16)) % 89_999_999_999n + 10_000_000_000n,
  ).slice(0, 11);
  const ucSuf = String(BigInt('0x' + h.slice(16, 30)) % 999_999n).padStart(6, '0');
  return {
    nome: `SMOKE ${seedHex.slice(0, 10)}`,
    cpf,
    email: `smoke+${seedHex}@example.invalid`,
    telefone: '5511999998888', // numero-protegido (não vaza WA real)
    endereco: {
      cep: '29100000',
      logradouro: 'Rua Smoke',
      numero: '1',
      bairro: 'Centro',
      cidade: 'Vitória',
      estado: 'ES',
    },
    instalacao: {
      numeroUC: '0001' + ucSuf,
      distribuidora: 'EDP_ES',
      consumoMedioKwh: 300,
    },
    planoSelecionado: 'DESCONTO_DIRETO',
    aceitaClube: false,
  };
}

// ═══════════════════════════════════════════════════════════════════
// CENÁRIO A — ?conv= (Convergência Fatia 2 + fix D-novo-CADWEB-CONV-TENANT)
// ═══════════════════════════════════════════════════════════════════
async function smokeConvitePublico(): Promise<{ cleanup: () => Promise<void> }> {
  const CEN = 'CONV';
  console.log('\n══════ CENÁRIO A — ?conv= ══════\n');

  // (1) Cria convite via Prisma direto (evita disparar WA pro telefone)
  const token = randomBytes(32).toString('hex');
  const suffix = randomBytes(4).toString('hex');
  const telefoneSmoke = telefoneSmokeUnico(suffix);
  const convite = await prisma.conviteConvenioMembro.create({
    data: {
      convenioId: CONVENIO_ID,
      cooperativaId: TENANT_COOP,
      nomeConvidado: `SMOKE Conv ${suffix}`,
      telefone: telefoneSmoke,
      token,
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      createdBy: ADMIN_USER_ID,
    },
    select: { id: true, token: true },
  });
  ok(CEN, '1. convite criado', `id=${convite.id}`);

  const cleanup = async () => {
    try {
      const cooperadoCriado = await prisma.cooperado.findFirst({
        where: { email: { startsWith: 'smoke+' + suffix } },
        select: { id: true },
      });
      if (cooperadoCriado) {
        // Ordem inversa de dependência: AprovacaoConvenioMembro -> ConvenioCooperado -> UC -> Cooperado.
        await prisma.aprovacaoConvenioMembro.deleteMany({
          where: { membro: { cooperadoId: cooperadoCriado.id } },
        });
        await prisma.convenioCooperado.deleteMany({ where: { cooperadoId: cooperadoCriado.id } });
        await prisma.uc.deleteMany({ where: { cooperadoId: cooperadoCriado.id } });
        await prisma.cooperado.delete({ where: { id: cooperadoCriado.id } });
      }
      await prisma.conviteConvenioMembro.delete({ where: { id: convite.id } });
      console.log(`🧹 [${CEN}] cleanup OK`);
    } catch (e: any) {
      console.warn(`⚠️  [${CEN}] cleanup falhou:`, e.message);
    }
  };

  // (2) GET /publico/convites/:token → valido=true
  try {
    const r = await fetch(`${API}/publico/convites/${token}`);
    const data: any = await r.json();
    if (!r.ok) fail(CEN, '2. GET convite', '200', `${r.status} ${JSON.stringify(data).slice(0, 200)}`);
    else if (!data.valido) fail(CEN, '2. GET convite', 'valido=true', JSON.stringify(data));
    else ok(CEN, '2. GET /publico/convites/:token', 'valido=true');
  } catch (e: any) {
    fail(CEN, '2. GET convite', 'sucesso fetch', `EXC: ${e.message}`);
  }

  // (3) Bypass OTP via DB (em DEV — equivale ao Luciano colar código)
  await prisma.conviteConvenioMembro.update({
    where: { id: convite.id },
    data: { otpValidadoEm: new Date() },
  });
  ok(CEN, '3. OTP marcado como validado (bypass DEV)');

  // (4) POST /publico/cadastro-web SEM cooperativaId / SEM ?tenant=
  const payload = {
    ...makePayload(suffix),
    token,
    origem: 'CONVITE_PUBLICO',
    // cooperativaId AUSENTE — esse é o foco do teste
  };
  let cadastroOk = false;
  try {
    const r = await fetch(`${API}/publico/cadastro-web`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const data: any = await r.json();
    if (!r.ok) {
      fail(CEN, '4. POST /publico/cadastro-web', '200/201', `${r.status} ${JSON.stringify(data).slice(0, 300)}`);
    } else {
      cadastroOk = true;
      ok(CEN, '4. POST /publico/cadastro-web', `status=${r.status}`);
    }
  } catch (e: any) {
    fail(CEN, '4. POST cadastro-web', 'sucesso fetch', `EXC: ${e.message}`);
  }

  if (!cadastroOk) return { cleanup };

  // (5) Verifica persistência
  const cooperado = await prisma.cooperado.findFirst({
    where: { email: { startsWith: 'smoke+' + suffix } },
    select: {
      id: true,
      cooperativaId: true,
      status: true,
      tipoCooperado: true,
      ucs: { select: { id: true, numero: true } },
    },
  });
  if (!cooperado) fail(CEN, '5a. cooperado persistido', 'encontrado', 'null');
  else {
    if (cooperado.cooperativaId !== TENANT_COOP)
      fail(CEN, '5b. cooperativaId derivado do convite', TENANT_COOP, cooperado.cooperativaId);
    else ok(CEN, '5b. cooperativaId derivado server-side via token', cooperado.cooperativaId);

    if (cooperado.ucs.length === 0) fail(CEN, '5c. UC criada', 'pelo menos 1', '0');
    else ok(CEN, '5c. UC criada', `numero=${cooperado.ucs[0].numero}`);

    const membro = await prisma.convenioCooperado.findFirst({
      where: { cooperadoId: cooperado.id, convenioId: CONVENIO_ID },
      select: { id: true, status: true },
    });
    if (!membro) fail(CEN, '5d. ConvenioCooperado criado', 'encontrado', 'null');
    else if (membro.status !== 'PENDENTE_APROVACAO_EMPRESA')
      fail(CEN, '5d. ConvenioCooperado status', 'PENDENTE_APROVACAO_EMPRESA', membro.status);
    else ok(CEN, '5d. membro convênio criado', `status=${membro.status}`);

    if (membro) {
      const aprovacao = await prisma.aprovacaoConvenioMembro.findUnique({
        where: { membroId: membro.id },
        select: { id: true, token: true, expiresAt: true, usedAt: true },
      });
      if (!aprovacao) fail(CEN, '5e. AprovacaoConvenioMembro (magic link empresa)', 'criada', 'null');
      else ok(CEN, '5e. magic link aprovação empresa', `tokenSufixo=...${aprovacao.token.slice(-6)}`);
    }
  }

  // (6) Verifica consume-once do convite
  const conviteFinal = await prisma.conviteConvenioMembro.findUnique({
    where: { id: convite.id },
    select: { usedAt: true },
  });
  if (!conviteFinal?.usedAt) fail(CEN, '6. convite marcado consume-once', 'usedAt != null', 'null');
  else ok(CEN, '6. convite consume-once', `usedAt=${conviteFinal.usedAt.toISOString()}`);

  // (7) REGRESSÃO — segundo cadastro com mesmo token deve falhar
  try {
    const payload2 = { ...makePayload(suffix + '_dup'), token, origem: 'CONVITE_PUBLICO' };
    const r = await fetch(`${API}/publico/cadastro-web`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload2),
    });
    const data: any = await r.json();
    // cadastroWebV2 quando origem=CONVITE_PUBLICO deve rejeitar token já usado.
    // Backend pode retornar 400/409 — qualquer não-2xx aqui é OK.
    if (r.ok) fail(CEN, '7. consume-once em retry', '4xx', `200 ${JSON.stringify(data).slice(0, 200)}`);
    else ok(CEN, '7. consume-once impede 2º cadastro', `status=${r.status}`);
  } catch (e: any) {
    fail(CEN, '7. retry consume-once', 'sucesso fetch', `EXC: ${e.message}`);
  }

  return { cleanup };
}

// ═══════════════════════════════════════════════════════════════════
// CENÁRIO B — ?ref= (MLM clássico)
// ═══════════════════════════════════════════════════════════════════
async function smokeRefMLM(): Promise<{ cleanup: () => Promise<void> }> {
  const CEN = 'REF';
  console.log('\n══════ CENÁRIO B — ?ref= ══════\n');

  const suffix = randomBytes(4).toString('hex');

  const cleanup = async () => {
    try {
      const cooperadoCriado = await prisma.cooperado.findFirst({
        where: { email: { startsWith: 'smoke+' + suffix } },
        select: { id: true },
      });
      if (cooperadoCriado) {
        await prisma.indicacao.deleteMany({ where: { cooperadoIndicadoId: cooperadoCriado.id } });
        await prisma.convenioCooperado.deleteMany({ where: { cooperadoId: cooperadoCriado.id } });
        await prisma.uc.deleteMany({ where: { cooperadoId: cooperadoCriado.id } });
        await prisma.cooperado.delete({ where: { id: cooperadoCriado.id } });
      }
      console.log(`🧹 [${CEN}] cleanup OK`);
    } catch (e: any) {
      console.warn(`⚠️  [${CEN}] cleanup falhou:`, e.message);
    }
  };

  // (1) Confirma indicador existe e tem codigoIndicacao
  const indicador = await prisma.cooperado.findUnique({
    where: { id: INDICADOR_ID },
    select: { id: true, nomeCompleto: true, codigoIndicacao: true, status: true },
  });
  if (!indicador || indicador.codigoIndicacao !== INDICADOR_COD) {
    fail(CEN, '1. indicador disponível', `${INDICADOR_ID} com cod=${INDICADOR_COD}`, JSON.stringify(indicador));
    return { cleanup };
  }
  ok(CEN, '1. indicador', `${indicador.nomeCompleto} (cod=${indicador.codigoIndicacao})`);

  // (2) GET /publico/convite/:codigo → valido
  try {
    const r = await fetch(`${API}/publico/convite/${INDICADOR_COD}`);
    const data: any = await r.json();
    if (!r.ok) fail(CEN, '2. GET convite/:codigo', '200', `${r.status}`);
    else if (!data.valido)
      fail(CEN, '2. GET convite/:codigo valida codigoIndicacao', 'valido=true', JSON.stringify(data));
    else ok(CEN, '2. GET /publico/convite/:codigo', `indicador=${data.nomeIndicador}`);
  } catch (e: any) {
    fail(CEN, '2. GET convite/:codigo', 'sucesso fetch', `EXC: ${e.message}`);
  }

  // (3) POST /publico/cadastro-web com codigoRef + cooperativaId
  const payload = {
    ...makePayload(suffix),
    codigoRef: INDICADOR_COD,
    cooperativaId: TENANT_COOP,
  };
  let cadastroOk = false;
  try {
    const r = await fetch(`${API}/publico/cadastro-web`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const data: any = await r.json();
    if (!r.ok) {
      fail(CEN, '3. POST cadastro-web', '200/201', `${r.status} ${JSON.stringify(data).slice(0, 300)}`);
    } else {
      cadastroOk = true;
      ok(CEN, '3. POST /publico/cadastro-web ?ref=', `status=${r.status}`);
    }
  } catch (e: any) {
    fail(CEN, '3. POST cadastro-web', 'sucesso fetch', `EXC: ${e.message}`);
  }

  if (!cadastroOk) return { cleanup };

  // (4) Verifica persistência
  const cooperado = await prisma.cooperado.findFirst({
    where: { email: { startsWith: 'smoke+' + suffix } },
    select: {
      id: true,
      cooperativaId: true,
      status: true,
      ucs: { select: { id: true } },
    },
  });
  if (!cooperado) {
    fail(CEN, '4a. cooperado criado', 'encontrado', 'null');
    return { cleanup };
  }
  ok(CEN, '4a. cooperado criado', `id=${cooperado.id} tenant=${cooperado.cooperativaId}`);

  if (cooperado.cooperativaId !== TENANT_COOP)
    fail(CEN, '4b. cooperativaId via body', TENANT_COOP, cooperado.cooperativaId);
  else ok(CEN, '4b. cooperativaId do body respeitado (sem token)', cooperado.cooperativaId);

  // (5) Indicacao criada vinculando indicador → indicado
  // (Processamento é assíncrono via this.indicacoes.registrarIndicacao no service;
  //  damos uma janelinha curta pra completar antes de checar.)
  await new Promise((r) => setTimeout(r, 1500));
  const indicacao = await prisma.indicacao.findFirst({
    where: { cooperadoIndicadoId: cooperado.id },
    select: {
      id: true,
      cooperadoIndicadorId: true,
      cooperadoIndicadoId: true,
      status: true,
      nivel: true,
    },
  });
  if (!indicacao) fail(CEN, '5. Indicacao MLM criada', 'encontrada', 'null');
  else if (indicacao.cooperadoIndicadorId !== INDICADOR_ID)
    fail(CEN, '5. Indicacao.cooperadoIndicadorId', INDICADOR_ID, indicacao.cooperadoIndicadorId);
  else ok(CEN, '5. Indicacao MLM vinculada', `id=${indicacao.id} status=${indicacao.status} nivel=${indicacao.nivel}`);

  return { cleanup };
}

// ═══════════════════════════════════════════════════════════════════
// MAIN
// ═══════════════════════════════════════════════════════════════════
async function main() {
  const inicio = Date.now();

  // Confirma backend está de pé
  try {
    const ping = await fetch(`${API}/publico/desconto-padrao?cooperativaId=${TENANT_COOP}`);
    if (!ping.ok) console.warn(`⚠️  backend ping retornou ${ping.status} — tentando rodar mesmo assim`);
    else console.log(`✅ backend UP em ${API}`);
  } catch (e: any) {
    console.error(`❌ backend não responde em ${API}: ${e.message}`);
    console.error('   Verifique pm2 status. Abortando.');
    process.exit(2);
  }

  const cleanups: Array<() => Promise<void>> = [];

  try {
    const a = await smokeConvitePublico();
    cleanups.push(a.cleanup);
  } catch (e: any) {
    console.error(`❌ CENÁRIO A explodiu: ${e.message}\n${e.stack}`);
    failures.push({ cenario: 'CONV', passo: 'exceção', esperado: 'execução completa', obtido: e.message });
  }

  try {
    const b = await smokeRefMLM();
    cleanups.push(b.cleanup);
  } catch (e: any) {
    console.error(`❌ CENÁRIO B explodiu: ${e.message}\n${e.stack}`);
    failures.push({ cenario: 'REF', passo: 'exceção', esperado: 'execução completa', obtido: e.message });
  }

  // Cleanup sempre
  console.log('\n══════ CLEANUP ══════');
  for (const c of cleanups) await c();

  const dur = ((Date.now() - inicio) / 1000).toFixed(1);

  console.log('\n══════ RESUMO ══════');
  console.log(`Duração: ${dur}s`);
  console.log(`Falhas:  ${failures.length}`);
  if (failures.length === 0) {
    console.log('\n✅ TODOS OS CENÁRIOS PASSARAM');
  } else {
    console.log('\n❌ FALHAS:');
    for (const f of failures) {
      console.log(`  • [${f.cenario}] ${f.passo}`);
      console.log(`     esperado: ${f.esperado}`);
      console.log(`     obtido:   ${f.obtido}`);
    }
  }

  process.exit(failures.length === 0 ? 0 : 1);
}

main()
  .catch((e) => {
    console.error('FATAL:', e);
    process.exit(2);
  })
  .finally(() => prisma.$disconnect());
