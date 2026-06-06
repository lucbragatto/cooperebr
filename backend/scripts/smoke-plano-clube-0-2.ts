/**
 * Smoke E2E programático — Fatia 0.2 (planoClubeId no ContratoConvenio).
 *
 * Cobertura:
 *  - Criar PlanoClube ativo no TENANT_A
 *  - Criar PlanoClube ativo no TENANT_B (pra teste cross-tenant)
 *  - Criar PlanoClube INATIVO no TENANT_A (pra teste de bloqueio)
 *  - Criar ContratoConvenio com planoClubeId válido → persistido + GET retorna
 *  - Atualizar removendo o vínculo (planoClubeId = null) → GET retorna null
 *  - Atualizar com plano de outro tenant → 400 (anti-vazamento)
 *  - Atualizar com plano inativo → 400 com mensagem clara
 *  - Atualizar voltando a vincular plano válido → ok
 *  - Cleanup automático
 *
 * NÃO usa HTTP — bate direto no service (mais rápido + isolado de auth).
 */
import { PrismaClient } from '@prisma/client';
import { ConveniosService } from '../src/convenios/convenios.service';

const prismaDirect = new PrismaClient();
const TENANT_A = 'cmn0ho8bx0000uox8wu96u6fd'; // CoopereBR

const failures: string[] = [];
function fail(msg: string) {
  console.error('❌', msg);
  failures.push(msg);
}
function ok(msg: string) {
  console.log('✅', msg);
}

async function main() {
  const inicio = Date.now();

  // Outro tenant pra cross-tenant
  const outroTenant = await prismaDirect.cooperativa.findFirst({
    where: { id: { not: TENANT_A }, ativo: true },
    select: { id: true, nome: true },
  });
  if (!outroTenant) {
    fail('Sem 2º tenant ativo — abortar.');
    process.exit(1);
  }
  const TENANT_B = outroTenant.id;
  console.log(`Tenants: A=${TENANT_A.slice(-6)} (CoopereBR) · B=${TENANT_B.slice(-6)} (${outroTenant.nome})\n`);

  // Cleanup smokes anteriores
  const limpos = await prismaDirect.planoClube.deleteMany({
    where: { nome: { startsWith: 'SMOKE-0-2' } },
  });
  if (limpos.count > 0) console.log(`🧹 Limpou ${limpos.count} plano(s) smoke anterior(es)\n`);
  await prismaDirect.contratoConvenio.deleteMany({
    where: { numero: { startsWith: 'SMOKE02-' } },
  });

  // Instancia ConveniosService manualmente — só usamos create/update/findOne
  // que dependem só do prisma.contratoConvenio + helpers internos. Outros
  // métodos não são exercitados aqui.
  const convenios = new (ConveniosService as any)(prismaDirect);

  let planoAtivoA: string | null = null;
  let planoInativoA: string | null = null;
  let planoAtivoB: string | null = null;
  let convenioId: string | null = null;

  try {
    // ── Setup: 3 planos ───────────────────────────────────────────
    const pA = await prismaDirect.planoClube.create({
      data: {
        cooperativaId: TENANT_A,
        nome: 'SMOKE-0-2-Ativo-A',
        valorMensal: 29.9,
        cobra: true,
        ativo: true,
      },
    });
    planoAtivoA = pA.id;
    ok(`Setup: PlanoClube ativo TENANT_A id=${pA.id}`);

    const pInat = await prismaDirect.planoClube.create({
      data: {
        cooperativaId: TENANT_A,
        nome: 'SMOKE-0-2-Inativo-A',
        valorMensal: 19.9,
        cobra: true,
        ativo: false, // inativo!
      },
    });
    planoInativoA = pInat.id;
    ok(`Setup: PlanoClube INATIVO TENANT_A id=${pInat.id}`);

    const pB = await prismaDirect.planoClube.create({
      data: {
        cooperativaId: TENANT_B,
        nome: 'SMOKE-0-2-Ativo-B',
        valorMensal: 49.9,
        cobra: true,
        ativo: true,
      },
    });
    planoAtivoB = pB.id;
    ok(`Setup: PlanoClube ativo TENANT_B id=${pB.id}\n`);

    // ── 1) Criar convênio COM planoClubeId válido ─────────────────
    const criado: any = await convenios.create(TENANT_A, {
      nome: `SMOKE02-Clinica-${Date.now().toString().slice(-6)}`,
      tipo: 'OUTRO' as any,
      planoClubeId: planoAtivoA,
    });
    convenioId = criado.id;
    if (criado.planoClubeId !== planoAtivoA) {
      fail(`1) planoClubeId não persistido. Esperado=${planoAtivoA} Got=${criado.planoClubeId}`);
    } else {
      ok(`1) Convênio criado com planoClubeId=${planoAtivoA.slice(-6)} (id=${criado.id})`);
    }

    // ── 2) GET retorna o vínculo ──────────────────────────────────
    const gotten: any = await convenios.findOne(criado.id);
    if (gotten.planoClubeId !== planoAtivoA) {
      fail(`2) GET não retornou planoClubeId esperado. Got=${gotten.planoClubeId}`);
    } else {
      ok(`2) GET /convenios/:id retorna planoClubeId persistido`);
    }

    // ── 3) Update: desvincular (planoClubeId=null) ────────────────
    const semClube: any = await convenios.update(criado.id, { planoClubeId: null });
    if (semClube.planoClubeId !== null) {
      fail(`3) Update planoClubeId=null não desvinculou. Got=${semClube.planoClubeId}`);
    } else {
      ok(`3) Update planoClubeId=null desvincula corretamente`);
    }

    // ── 4) Update com plano de OUTRO TENANT → 400 ─────────────────
    let bloqueouCrossTenant = false;
    try {
      await convenios.update(criado.id, { planoClubeId: planoAtivoB });
    } catch (e: any) {
      if (e?.message?.includes('outra cooperativa') || e?.status === 400) {
        bloqueouCrossTenant = true;
      } else {
        fail(`4) Update cross-tenant lançou erro errado: ${e?.message}`);
      }
    }
    if (!bloqueouCrossTenant) {
      fail(`4) Update aceitou plano cross-tenant — VAZAMENTO`);
    } else {
      ok(`4) Update cross-tenant bloqueado com 400 (anti-vazamento)`);
    }

    // ── 5) Update com plano INATIVO → 400 ─────────────────────────
    let bloqueouInativo = false;
    try {
      await convenios.update(criado.id, { planoClubeId: planoInativoA });
    } catch (e: any) {
      if (e?.message?.includes('inativo') || e?.status === 400) {
        bloqueouInativo = true;
      } else {
        fail(`5) Update plano inativo lançou erro errado: ${e?.message}`);
      }
    }
    if (!bloqueouInativo) {
      fail(`5) Update aceitou plano INATIVO`);
    } else {
      ok(`5) Update plano inativo bloqueado com 400`);
    }

    // ── 6) Voltar a vincular plano válido ─────────────────────────
    const revinculado: any = await convenios.update(criado.id, { planoClubeId: planoAtivoA });
    if (revinculado.planoClubeId !== planoAtivoA) {
      fail(`6) Revincular não aplicou. Got=${revinculado.planoClubeId}`);
    } else {
      ok(`6) Revincular planoClubeId válido aplicou corretamente`);
    }

    // ── 7) Criar convênio com planoClubeId vazio (sem clube) ─────
    const semVinculo: any = await convenios.create(TENANT_A, {
      nome: `SMOKE02-SemClube-${Date.now().toString().slice(-6)}`,
      tipo: 'OUTRO' as any,
    });
    if (semVinculo.planoClubeId !== null) {
      fail(`7) Convênio sem planoClubeId deveria persistir null. Got=${semVinculo.planoClubeId}`);
    } else {
      ok(`7) Convênio sem planoClubeId nasce com null (sem clube)`);
    }

    // Cleanup do extra
    await prismaDirect.contratoConvenio.delete({ where: { id: semVinculo.id } });

    // ── 8) Criar convênio com plano de outro tenant → 400 ─────────
    let bloqueouCriacao = false;
    try {
      await convenios.create(TENANT_A, {
        nome: `SMOKE02-CrossCreate-${Date.now().toString().slice(-6)}`,
        tipo: 'OUTRO' as any,
        planoClubeId: planoAtivoB,
      });
    } catch (e: any) {
      if (e?.message?.includes('outra cooperativa') || e?.status === 400) {
        bloqueouCriacao = true;
      } else {
        fail(`8) Create cross-tenant lançou erro errado: ${e?.message}`);
      }
    }
    if (!bloqueouCriacao) {
      fail(`8) Create aceitou plano cross-tenant`);
    } else {
      ok(`8) Create cross-tenant bloqueado com 400`);
    }
  } finally {
    // ── Cleanup ────────────────────────────────────────────────
    if (convenioId) {
      await prismaDirect.contratoConvenio.delete({ where: { id: convenioId } }).catch(() => null);
    }
    await prismaDirect.contratoConvenio.deleteMany({
      where: { numero: { startsWith: 'SMOKE02-' } },
    });
    const ids = [planoAtivoA, planoInativoA, planoAtivoB].filter(Boolean) as string[];
    if (ids.length) {
      await prismaDirect.planoClube.deleteMany({ where: { id: { in: ids } } });
    }
    console.log(`\n🧹 Cleanup OK`);
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
  .finally(() => prismaDirect.$disconnect());
