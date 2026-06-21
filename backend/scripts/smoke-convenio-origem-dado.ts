/**
 * Smoke E2E — Sprint Convênio-Token-Cooperado slice "recebe créditos GD
 * como DADO + origemConvenioId no ledger" (20/06/2026).
 *
 * Valida 3 caminhos ponta-a-ponta contra localhost:3000:
 *
 *  1. Cadastro público SEM_UC com jaRecebeCreditosGd + fornecedorGdAtual
 *     → Cooperado.jaRecebeCreditosGd=true + fornecedorGdAtual='X Solar'.
 *  2. comprarTokensCooperado (cooperado PJ) SEM convenioId →
 *     CooperTokenCompra.convenioId=null (caminho legado preservado).
 *  3. comprarTokensCooperado COM convenioId válido do mesmo tenant →
 *     CooperTokenCompra.convenioId=<convenio> + log estruturado.
 *  4. comprarTokensCooperado COM convenioId de OUTRO TENANT → 404
 *     (defense in depth multi-tenant).
 *  5. comprarTokensCooperado COM convenioId INEXISTENTE → 404.
 *
 * Setup:
 *  - Cooperativa CoopereBR (cmn0ho8bx0000uox8wu96u6fd).
 *  - Cooperado-PJ SISGDSOLAR (cmq57khne0002vavsis4v9oxk).
 *  - Convênio existente na CoopereBR — busca runtime via Prisma.
 *  - Convênio de OUTRO tenant — busca runtime via Prisma (se houver).
 *  - SEM disparo real Asaas em produção (env protegido — smoke roda
 *    contra config existente; se asaasService falhar por config inválida
 *    em dev, smoke skipa cenário 2-5 gracefully).
 *
 * Cleanup ao final (idempotente):
 *  - Deleta cooperado SEM_UC criado no cenário 1.
 *  - Deleta CooperTokenCompra (status AGUARDANDO_PAGAMENTO) criadas.
 */
import { PrismaClient } from '@prisma/client';
import * as jwt from 'jsonwebtoken';
import * as dotenv from 'dotenv';
import * as path from 'node:path';

dotenv.config({ path: path.resolve(__dirname, '..', '.env') });

// P2 review security Sprint C — guard anti-execução em prod.
if (process.env.NODE_ENV === 'production' && process.env.SMOKE_FORCE_PROD !== 'true') {
  console.error('[ABORT] Smoke não deve rodar em produção sem SMOKE_FORCE_PROD=true');
  process.exit(1);
}

const API = process.env.API ?? 'http://localhost:3000';
const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET) {
  console.error('JWT_SECRET nao encontrado no .env — abort');
  process.exit(1);
}

const COOPEREBR_ID = 'cmn0ho8bx0000uox8wu96u6fd';
const COOPERADO_PJ_ID = 'cmq57khne0002vavsis4v9oxk'; // SISGDSOLAR

const prisma = new PrismaClient();
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

async function call(
  method: string,
  pathSuffix: string,
  opts: { token?: string; body?: any } = {},
): Promise<{ status: number; json: any }> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (opts.token) headers.Authorization = `Bearer ${opts.token}`;
  const res = await fetch(`${API}${pathSuffix}`, {
    method,
    headers,
    body: opts.body ? JSON.stringify(opts.body) : undefined,
  });
  const text = await res.text();
  let json: any;
  try {
    json = JSON.parse(text);
  } catch {
    json = text;
  }
  return { status: res.status, json };
}

function jwtPj(usuarioId: string) {
  return jwt.sign(
    {
      sub: usuarioId,
      id: usuarioId,
      userId: usuarioId,
      email: 'smoke-convenio@test.com',
      perfil: 'COOPERADO',
      cooperadoId: COOPERADO_PJ_ID,
      cooperativaId: COOPEREBR_ID,
    },
    JWT_SECRET!,
    { expiresIn: '1h' },
  );
}

const CPF_SMOKE = '99988877766'; // CPF sintético reservado pro smoke
const EMAIL_SMOKE = 'lucbragatto+smoke-convenio-origem@gmail.com';

// P3 review financeiro-token (20/06): janela de tempo do smoke como
// discriminador — evita apagar compras AGUARDANDO_PAGAMENTO legítimas
// (Asaas indisponível em prod) de SISGDSOLAR. Inicializado no boot do
// smoke; cleanup só apaga compras criadas DEPOIS desse momento.
const SMOKE_INICIO = new Date();

async function cleanup() {
  console.log('\n[CLEANUP] Restaurando estado');
  // Compras criadas no smoke (AGUARDANDO_PAGAMENTO, sem asaasId real,
  // criadas dentro da janela do smoke).
  const compras = await prisma.cooperTokenCompra.deleteMany({
    where: {
      cooperativaId: COOPEREBR_ID,
      compradorCooperadoId: COOPERADO_PJ_ID,
      status: 'AGUARDANDO_PAGAMENTO',
      asaasId: null,
      createdAt: { gte: SMOKE_INICIO },
    },
  });
  // Cooperado SEM_UC criado no cenário 1.
  const coops = await prisma.cooperado.deleteMany({
    where: {
      OR: [{ cpf: CPF_SMOKE }, { email: EMAIL_SMOKE }],
      cooperativaId: COOPEREBR_ID,
    },
  });
  console.log(`  Limpou ${compras.count} compra(s) + ${coops.count} cooperado(s) smoke`);
}

async function main() {
  await cleanup(); // pré-cleanup

  // Pré-condição: o cooperado PJ existe + é PJ.
  const pj = await prisma.cooperado.findUnique({
    where: { id: COOPERADO_PJ_ID },
    select: { id: true, tipoPessoa: true, status: true },
  });
  if (!pj || pj.tipoPessoa !== 'PJ') {
    fail('Cooperado SISGDSOLAR não é PJ — rode seed M40 antes');
    await cleanup();
    return;
  }
  // Busca Usuario do cooperado pra JWT — match por cpf/email (Usuario não
  // tem cooperadoId direto).
  const cooperadoFull = await prisma.cooperado.findUnique({
    where: { id: COOPERADO_PJ_ID },
    select: { cpf: true, email: true },
  });
  const usuario = await prisma.usuario.findFirst({
    where: {
      cooperativaId: COOPEREBR_ID,
      OR: [
        ...(cooperadoFull?.email ? [{ email: cooperadoFull.email }] : []),
        ...(cooperadoFull?.cpf ? [{ cpf: cooperadoFull.cpf }] : []),
      ],
    },
    select: { id: true },
  });
  if (!usuario) {
    fail('Usuário do cooperado SISGDSOLAR não encontrado — rode seed M40');
    await cleanup();
    return;
  }
  const token = jwtPj(usuario.id);

  // Busca convênio existente da CoopereBR + de outro tenant pra cenários
  // 3 e 4. Se não tem, smoke pula esses cenários.
  const convenioA = await prisma.contratoConvenio.findFirst({
    where: { cooperativaId: COOPEREBR_ID },
    select: { id: true },
  });
  const convenioB = await prisma.contratoConvenio.findFirst({
    where: { cooperativaId: { not: COOPEREBR_ID } },
    select: { id: true, cooperativaId: true },
  });
  if (!convenioA) {
    console.log(
      '\n⚠ Sem convênio na CoopereBR — cenários 3 e 4 serão pulados (não há fixture)',
    );
  }

  // ─── CENÁRIO 1: cadastro público SEM_UC com flags GD ───
  console.log('\n[CASO 1] Cadastro público /publico/cadastro-sem-uc com jaRecebeCreditosGd=true');
  const r1 = await call('POST', `/publico/cadastro-sem-uc?tenant=${COOPEREBR_ID}`, {
    body: {
      nome: 'Smoke Convênio Origem Dado',
      cpf: CPF_SMOKE,
      email: EMAIL_SMOKE,
      telefone: '27981341348',
      tipoPessoa: 'PF',
      jaRecebeCreditosGd: true,
      fornecedorGdAtual: 'Cooperativa Solar Concorrente XYZ',
    },
  });
  if (r1.status === 200 || r1.status === 201) {
    pass(`/publico/cadastro-sem-uc respondeu ${r1.status}`);
  } else {
    fail(`/publico/cadastro-sem-uc status=${r1.status} body=${JSON.stringify(r1.json).slice(0, 200)}`);
  }
  // Confere persistência via Prisma direto.
  const cooperadoCriado = await prisma.cooperado.findFirst({
    where: { cpf: CPF_SMOKE, cooperativaId: COOPEREBR_ID },
    select: {
      id: true,
      jaRecebeCreditosGd: true,
      fornecedorGdAtual: true,
    },
  });
  if (cooperadoCriado?.jaRecebeCreditosGd === true) {
    pass(`Cooperado.jaRecebeCreditosGd=true persistido`);
  } else {
    fail(`jaRecebeCreditosGd NÃO persistido: ${cooperadoCriado?.jaRecebeCreditosGd}`);
  }
  if (cooperadoCriado?.fornecedorGdAtual === 'Cooperativa Solar Concorrente XYZ') {
    pass(`fornecedorGdAtual persistido: "${cooperadoCriado.fornecedorGdAtual}"`);
  } else {
    fail(`fornecedorGdAtual NÃO persistido: "${cooperadoCriado?.fornecedorGdAtual}"`);
  }

  // ─── CENÁRIO 2: comprarTokensCooperado SEM convenioId ───
  console.log('\n[CASO 2] comprarTokensCooperado SEM convenioId (caminho legado)');
  const r2 = await call('POST', '/cooper-token/cooperado/comprar', {
    token,
    body: {
      quantidade: 1,
      formaPagamento: 'PIX',
      // sem convenioId
    },
  });
  if (r2.status >= 200 && r2.status < 300 && r2.json?.compraId) {
    pass(`compra criada (sem convenioId): ${r2.json.compraId.slice(0, 8)}…`);
    const compraDb = await prisma.cooperTokenCompra.findUnique({
      where: { id: r2.json.compraId },
      select: { convenioId: true },
    });
    if (compraDb?.convenioId === null) {
      pass(`CooperTokenCompra.convenioId=null (default legado)`);
    } else {
      fail(`convenioId esperado null, veio ${compraDb?.convenioId}`);
    }
  } else if (r2.status === 400 && /Asaas/i.test(JSON.stringify(r2.json))) {
    console.log(`  ⚠ Asaas indisponível em DEV — caso 2 pulado (esperado em ambiente sem credencial)`);
  } else {
    fail(`compra falhou inesperado: status=${r2.status} body=${JSON.stringify(r2.json).slice(0, 200)}`);
  }

  // ─── CENÁRIO 3: comprarTokensCooperado COM convenioId válido ───
  if (convenioA) {
    console.log('\n[CASO 3] comprarTokensCooperado COM convenioId válido do mesmo tenant');
    const r3 = await call('POST', '/cooper-token/cooperado/comprar', {
      token,
      body: {
        quantidade: 1,
        formaPagamento: 'PIX',
        convenioId: convenioA.id,
      },
    });
    if (r3.status >= 200 && r3.status < 300 && r3.json?.compraId) {
      pass(`compra criada (com convenioId): ${r3.json.compraId.slice(0, 8)}…`);
      const compraDb = await prisma.cooperTokenCompra.findUnique({
        where: { id: r3.json.compraId },
        select: { convenioId: true },
      });
      if (compraDb?.convenioId === convenioA.id) {
        pass(`CooperTokenCompra.convenioId=${convenioA.id.slice(0, 8)}… (rastreio Salvaguarda 4)`);
      } else {
        fail(`convenioId esperado ${convenioA.id}, veio ${compraDb?.convenioId}`);
      }
    } else if (r3.status === 400 && /Asaas/i.test(JSON.stringify(r3.json))) {
      console.log(`  ⚠ Asaas indisponível em DEV — caso 3 pulado`);
    } else {
      fail(`compra falhou inesperado: status=${r3.status} body=${JSON.stringify(r3.json).slice(0, 200)}`);
    }
  }

  // ─── CENÁRIO 4: convenioId de OUTRO tenant → 404 ───
  if (convenioB) {
    console.log('\n[CASO 4] convenioId de OUTRO tenant → 404 (defense in depth multi-tenant)');
    const r4 = await call('POST', '/cooper-token/cooperado/comprar', {
      token,
      body: {
        quantidade: 1,
        formaPagamento: 'PIX',
        convenioId: convenioB.id, // de OUTRO tenant
      },
    });
    if (r4.status === 404) {
      pass(`anti-spoof multi-tenant ativo: convenioId de outro tenant rejeitado (404)`);
    } else {
      fail(`esperado 404, veio status=${r4.status} body=${JSON.stringify(r4.json).slice(0, 200)}`);
    }
  } else {
    console.log('\n⚠ Sem convênio de outro tenant pra testar cenário 4 — pulando');
  }

  // ─── CENÁRIO 5: convenioId INEXISTENTE → 404 (CUID válido mas não existe) ───
  console.log('\n[CASO 5] convenioId INEXISTENTE → 404 (CUID válido inexistente)');
  // CUID válido (formato c+24 chars) mas que não existe no banco.
  // Garante que o request passa do DTO @Matches CUID e cai no service.
  const cuidValidoInexistente = 'cfantasma' + 'x'.repeat(16);
  const r5 = await call('POST', '/cooper-token/cooperado/comprar', {
    token,
    body: {
      quantidade: 1,
      formaPagamento: 'PIX',
      convenioId: cuidValidoInexistente,
    },
  });
  if (r5.status === 404) {
    pass(`convenioId inexistente rejeitado pelo service (404)`);
  } else if (r5.status === 400 && /CUID/i.test(JSON.stringify(r5.json))) {
    fail(`DTO rejeitou CUID gerado (verificar regex): "${cuidValidoInexistente}"`);
  } else {
    fail(`esperado 404, veio status=${r5.status} body=${JSON.stringify(r5.json).slice(0, 200)}`);
  }

  // ─── CENÁRIO 5b: convenioId malformado (NÃO-CUID) → 400 (DTO rejeita) ───
  console.log('\n[CASO 5b] convenioId malformado (NÃO-CUID) → 400 (DTO @Matches rejeita)');
  const r5b = await call('POST', '/cooper-token/cooperado/comprar', {
    token,
    body: {
      quantidade: 1,
      formaPagamento: 'PIX',
      convenioId: 'nao-eh-cuid',
    },
  });
  if (r5b.status === 400 && /CUID/i.test(JSON.stringify(r5b.json))) {
    pass(`DTO @Matches CUID rejeita formato inválido (400)`);
  } else {
    fail(`esperado 400 CUID, veio status=${r5b.status} body=${JSON.stringify(r5b.json).slice(0, 200)}`);
  }

  await cleanup();
  await prisma.$disconnect();

  console.log('\n═══════════════════════════════════════════════════');
  console.log(`Resultado: ${passCount} PASS / ${failCount} FAIL`);
  console.log('═══════════════════════════════════════════════════');
  process.exit(failCount > 0 ? 1 : 0);
}

main().catch(async (e) => {
  console.error('[ERRO FATAL]', e?.message ?? e);
  try {
    await cleanup();
  } catch {
    /* ignore */
  }
  await prisma.$disconnect();
  process.exit(1);
});
