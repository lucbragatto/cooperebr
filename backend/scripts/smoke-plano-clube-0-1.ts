/**
 * Smoke E2E programático — Fatia 0.1 (PlanoClube CRUD multi-tenant).
 *
 * Roda via Prisma direto (sem HTTP) cobrindo:
 *  - Criar plano em CoopereBR (TENANT_A)
 *  - Criar plano em CoopereBR Teste (TENANT_B)
 *  - Listar TENANT_A → vê só o seu
 *  - Atualizar valor mensal
 *  - Soft-delete (ativo=false) → não aparece em listagem padrão
 *  - Cleanup automático
 *
 * Não dispara WhatsApp/email — operação pura sobre PlanoClube.
 */
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
const TENANT_A = 'cmn0ho8bx0000uox8wu96u6fd'; // CoopereBR

const failures: string[] = [];
function fail(msg: string) { console.error('❌', msg); failures.push(msg); }
function ok(msg: string) { console.log('✅', msg); }

async function main() {
  const inicio = Date.now();

  // Pega outro tenant qualquer pra cross-tenant
  const outroTenant = await prisma.cooperativa.findFirst({
    where: { id: { not: TENANT_A }, ativo: true },
    select: { id: true, nome: true },
  });
  if (!outroTenant) {
    fail('Não há 2ª cooperativa ativa pra testar cross-tenant — abortar.');
    process.exit(1);
  }
  const TENANT_B = outroTenant.id;
  console.log(`Tenants: A=${TENANT_A.slice(-6)} (CoopereBR) · B=${TENANT_B.slice(-6)} (${outroTenant.nome})`);

  // ── Limpar smokes anteriores ──────────────────────────────────────
  const limpos = await prisma.planoClube.deleteMany({
    where: { nome: { startsWith: 'SMOKE-' } },
  });
  if (limpos.count > 0) console.log(`🧹 Limpou ${limpos.count} smoke(s) anterior(es)\n`);

  let pA1: string | null = null;
  let pA2: string | null = null;
  let pB1: string | null = null;

  try {
    // ── 1) Criar plano PAGO no TENANT A ────────────────────────────
    const planoA = await prisma.planoClube.create({
      data: {
        cooperativaId: TENANT_A,
        nome: 'SMOKE-Ouro',
        descricao: 'Plano de teste pago',
        valorMensal: 19.9,
        cobra: true,
        ativo: true,
      },
    });
    pA1 = planoA.id;
    ok(`1) Criado plano PAGO em TENANT_A: id=${planoA.id} valorMensal=${planoA.valorMensal}`);

    // ── 2) Criar plano GRATIS no TENANT A ──────────────────────────
    const planoGratis = await prisma.planoClube.create({
      data: {
        cooperativaId: TENANT_A,
        nome: 'SMOKE-Gratis',
        valorMensal: 0,
        cobra: false,
        ativo: true,
      },
    });
    pA2 = planoGratis.id;
    ok(`2) Criado plano GRÁTIS em TENANT_A: id=${planoGratis.id} cobra=${planoGratis.cobra}`);

    // ── 3) Criar plano no TENANT B (isolamento) ────────────────────
    const planoB = await prisma.planoClube.create({
      data: {
        cooperativaId: TENANT_B,
        nome: 'SMOKE-CrossTenant',
        valorMensal: 99.99,
        cobra: true,
      },
    });
    pB1 = planoB.id;
    ok(`3) Criado plano no TENANT_B: id=${planoB.id}`);

    // ── 4) Listar TENANT A (ativos) → 2 planos, NÃO inclui TENANT B ──
    const listaA = await prisma.planoClube.findMany({
      where: { cooperativaId: TENANT_A, ativo: true, nome: { startsWith: 'SMOKE-' } },
      orderBy: { nome: 'asc' },
    });
    if (listaA.length !== 2) fail(`4) listar TENANT_A esperado 2 smokes, obteve ${listaA.length}`);
    else ok(`4) Listar TENANT_A retornou 2 planos (zero do tenant B)`);
    if (listaA.some((p) => p.cooperativaId === TENANT_B)) {
      fail('4) VAZAMENTO cross-tenant: TENANT_A retornou plano do TENANT_B');
    }

    // ── 5) Atualizar valorMensal do PAGO ──────────────────────────
    const atualizado = await prisma.planoClube.update({
      where: { id: pA1 },
      data: { valorMensal: 29.9 },
    });
    if (Number(atualizado.valorMensal) !== 29.9) fail(`5) update valorMensal não aplicou: ${atualizado.valorMensal}`);
    else ok(`5) Atualizado valorMensal: 19.9 → 29.9`);

    // ── 6) Soft-delete (ativo=false) ─────────────────────────────
    await prisma.planoClube.update({
      where: { id: pA2 },
      data: { ativo: false },
    });
    const listaAtivos = await prisma.planoClube.findMany({
      where: { cooperativaId: TENANT_A, ativo: true, nome: { startsWith: 'SMOKE-' } },
    });
    if (listaAtivos.length !== 1) fail(`6) Lista ativos esperado 1, obteve ${listaAtivos.length}`);
    else ok(`6) Soft-delete: lista ativos agora tem 1 plano (o GRÁTIS sumiu)`);

    const listaTudo = await prisma.planoClube.findMany({
      where: { cooperativaId: TENANT_A, nome: { startsWith: 'SMOKE-' } },
    });
    if (listaTudo.length !== 2) fail(`6) Lista geral esperado 2 (incluindo inativos), obteve ${listaTudo.length}`);
    else ok(`6) Lista incluirInativos=true continua retornando ambos`);

    // ── 7) Cross-tenant 404: tentar buscar plano de B em contexto A ──
    const cross = await prisma.planoClube.findFirst({
      where: { id: pB1, cooperativaId: TENANT_A },
    });
    if (cross !== null) fail('7) Cross-tenant retornou plano do outro tenant (VAZAMENTO).');
    else ok(`7) Cross-tenant defensivo: findFirst com tenant A filtra plano de B → null`);

    // ── 8) Helper resolverParaCobranca-like (simulação da Fatia 0.4) ──
    const paraCobranca = await prisma.planoClube.findFirst({
      where: { id: pA1, cooperativaId: TENANT_A, ativo: true },
      select: { id: true, valorMensal: true, cobra: true, nome: true },
    });
    if (!paraCobranca || !paraCobranca.cobra || Number(paraCobranca.valorMensal) !== 29.9) {
      fail(`8) Helper Fatia 0.4 não retornou snapshot esperado: ${JSON.stringify(paraCobranca)}`);
    } else {
      ok(`8) Helper Fatia 0.4: snapshot { cobra=${paraCobranca.cobra}, valorMensal=${paraCobranca.valorMensal}, nome=${paraCobranca.nome} }`);
    }
  } finally {
    // ── Cleanup ─────────────────────────────────────────────────
    const ids = [pA1, pA2, pB1].filter(Boolean) as string[];
    if (ids.length) {
      await prisma.planoClube.deleteMany({ where: { id: { in: ids } } });
      console.log(`\n🧹 Cleanup OK: ${ids.length} plano(s) deletado(s).`);
    }
  }

  const dur = ((Date.now() - inicio) / 1000).toFixed(1);
  console.log(`\n══════ RESUMO ══════`);
  console.log(`Duração: ${dur}s`);
  console.log(`Falhas:  ${failures.length}`);
  if (failures.length === 0) {
    console.log('\n✅ TODOS OS PASSOS PASSARAM');
  } else {
    console.log('\n❌ FALHAS:');
    failures.forEach((f) => console.log(`  - ${f}`));
  }
  process.exit(failures.length === 0 ? 0 : 1);
}

main()
  .catch((e) => {
    console.error('FATAL:', e);
    process.exit(2);
  })
  .finally(() => prisma.$disconnect());
