/**
 * Smoke E2E programático — Fatia 0.3 (Cooperado.planoClubeId opt-in).
 *
 * Cobertura:
 *  - Aderir cooperado comum → persiste planoClubeId + adesaoClubeEm
 *  - Cross-tenant (plano de outra coop) → 400
 *  - Plano INATIVO → 400
 *  - Cooperado de outro tenant → 404
 *  - INVARIANTE anti-bug-0.4: aderir cooperado que é membro ATIVO de convênio
 *    com planoClubeId → 400 (bloqueia cobrança dupla na fonte)
 *  - Cancelar adesão → zera ambos campos
 *  - Cancelar 2x (idempotente) → ok
 *  - resolverParaCobrancaIndividual snapshot pra Fatia 0.4
 *
 * Bate direto no service (sem HTTP). Cleanup automático.
 */
import { PrismaClient } from '@prisma/client';
import { CooperadoClubeService } from '../src/cooperado-clube/cooperado-clube.service';

const prisma = new PrismaClient();
const TENANT_A = 'cmn0ho8bx0000uox8wu96u6fd'; // CoopereBR

const failures: string[] = [];
function fail(msg: string) { console.error('❌', msg); failures.push(msg); }
function ok(msg: string) { console.log('✅', msg); }

async function main() {
  const inicio = Date.now();

  const outroTenant = await prisma.cooperativa.findFirst({
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
  await prisma.convenioCooperado.deleteMany({ where: { cooperado: { email: { startsWith: 'smoke03+' } } } });
  await prisma.cooperado.deleteMany({ where: { email: { startsWith: 'smoke03+' } } });
  await prisma.contratoConvenio.deleteMany({ where: { numero: { startsWith: 'SMOKE03-' } } });
  await prisma.planoClube.deleteMany({ where: { nome: { startsWith: 'SMOKE-0-3' } } });

  const service = new (CooperadoClubeService as any)(prisma);

  let coopComum: string | null = null;
  let coopConveniado: string | null = null;
  let coopOutro: string | null = null;
  let planoAtivoA: string | null = null;
  let planoInativoA: string | null = null;
  let planoAtivoB: string | null = null;
  let convenioComClube: string | null = null;
  let membroVinculo: string | null = null;

  try {
    // ── Setup planos ─────────────────────────────────────────────
    const pA = await prisma.planoClube.create({
      data: { cooperativaId: TENANT_A, nome: 'SMOKE-0-3-Ativo-A', valorMensal: 29.9, cobra: true, ativo: true },
    });
    planoAtivoA = pA.id;
    const pInat = await prisma.planoClube.create({
      data: { cooperativaId: TENANT_A, nome: 'SMOKE-0-3-Inativo-A', valorMensal: 19.9, cobra: true, ativo: false },
    });
    planoInativoA = pInat.id;
    const pB = await prisma.planoClube.create({
      data: { cooperativaId: TENANT_B, nome: 'SMOKE-0-3-Ativo-B', valorMensal: 49.9, cobra: true, ativo: true },
    });
    planoAtivoB = pB.id;
    ok(`Setup: 3 PlanosClube (A ativo, A inativo, B ativo)`);

    // ── Setup cooperados ─────────────────────────────────────────
    const ts = Date.now().toString().slice(-6);
    const cComum = await prisma.cooperado.create({
      data: {
        nomeCompleto: 'SMOKE-Cooperado Comum',
        cpf: `030${ts.padStart(8, '0')}`,
        email: `smoke03+comum-${ts}@example.invalid`,
        telefone: `551199998${ts.padStart(4, '0').slice(-4)}`,
        status: 'ATIVO',
        tipoCooperado: 'COM_UC',
        cooperativaId: TENANT_A,
        termoAdesaoAceito: true,
        termoAdesaoAceitoEm: new Date(),
      },
    });
    coopComum = cComum.id;
    ok(`Setup: Cooperado COMUM TENANT_A id=${cComum.id.slice(-6)}`);

    const cConv = await prisma.cooperado.create({
      data: {
        nomeCompleto: 'SMOKE-Funcionário Conveniado',
        cpf: `031${ts.padStart(8, '0')}`,
        email: `smoke03+conv-${ts}@example.invalid`,
        status: 'ATIVO',
        tipoCooperado: 'COM_UC',
        cooperativaId: TENANT_A,
        termoAdesaoAceito: true,
        termoAdesaoAceitoEm: new Date(),
      },
    });
    coopConveniado = cConv.id;

    const cOutro = await prisma.cooperado.create({
      data: {
        nomeCompleto: 'SMOKE-Cooperado Outro Tenant',
        cpf: `032${ts.padStart(8, '0')}`,
        email: `smoke03+outro-${ts}@example.invalid`,
        status: 'ATIVO',
        tipoCooperado: 'COM_UC',
        cooperativaId: TENANT_B,
        termoAdesaoAceito: true,
        termoAdesaoAceitoEm: new Date(),
      },
    });
    coopOutro = cOutro.id;
    ok(`Setup: Cooperados conveniado (A) + outro_tenant (B) criados\n`);

    // ── Setup convênio com clube vinculado + membro ativo ─────────
    const cv = await prisma.contratoConvenio.create({
      data: {
        numero: `SMOKE03-${ts}`,
        empresaNome: 'SMOKE Convênio com Clube',
        cooperativaId: TENANT_A,
        status: 'ATIVO',
        tipo: 'OUTRO' as any,
        tipoDesconto: 'PERCENTUAL',
        planoClubeId: planoAtivoA, // <-- clube vinculado (Fatia 0.2)
      },
    });
    convenioComClube = cv.id;
    const mem = await prisma.convenioCooperado.create({
      data: {
        convenioId: cv.id,
        cooperadoId: coopConveniado,
        ativo: true,
        status: 'MEMBRO_ATIVO' as any,
      },
    });
    membroVinculo = mem.id;
    ok(`Setup: Convênio com clube + membro ativo (funcionário conveniado)\n`);

    // ── 1) Aderir cooperado COMUM → persiste ──────────────────────
    const r1 = await service.aderir({
      cooperadoId: coopComum,
      planoClubeId: planoAtivoA,
      adminCooperativaId: TENANT_A,
    });
    if (r1.planoClubeId !== planoAtivoA || !r1.adesaoClubeEm) {
      fail(`1) Adesão não persistiu: ${JSON.stringify(r1)}`);
    } else {
      ok(`1) Cooperado COMUM aderiu: planoClubeId + adesaoClubeEm setados`);
    }

    // ── 2) Aderir cooperado de outro tenant → 404 ────────────────
    let nf = false;
    try {
      await service.aderir({
        cooperadoId: coopOutro,
        planoClubeId: planoAtivoA,
        adminCooperativaId: TENANT_A,
      });
    } catch (e: any) {
      if (e?.status === 404 || e?.message?.includes('não encontrado')) nf = true;
    }
    if (!nf) fail('2) Cooperado de outro tenant aceito (esperado 404)');
    else ok(`2) Cooperado de outro tenant → 404 (anti-enumeração)`);

    // ── 3) Aderir cooperado válido com plano de OUTRO TENANT → 400 ──
    let bloqXt = false;
    try {
      await service.aderir({
        cooperadoId: coopComum,
        planoClubeId: planoAtivoB,
        adminCooperativaId: TENANT_A,
      });
    } catch (e: any) {
      if (e?.status === 400 || e?.message?.includes('outra cooperativa')) bloqXt = true;
    }
    if (!bloqXt) fail('3) Plano cross-tenant aceito (VAZAMENTO)');
    else ok(`3) Plano cross-tenant bloqueado com 400`);

    // ── 4) Aderir com plano INATIVO → 400 ───────────────────────
    let bloqInat = false;
    try {
      await service.aderir({
        cooperadoId: coopComum,
        planoClubeId: planoInativoA,
        adminCooperativaId: TENANT_A,
      });
    } catch (e: any) {
      if (e?.status === 400 || e?.message?.includes('inativo')) bloqInat = true;
    }
    if (!bloqInat) fail('4) Plano inativo aceito');
    else ok(`4) Plano inativo bloqueado com 400`);

    // ── 5) INVARIANTE: funcionário CONVENIADO em convênio com clube → 400 ──
    let bloqDup = false;
    let msgDup = '';
    try {
      await service.aderir({
        cooperadoId: coopConveniado,
        planoClubeId: planoAtivoA,
        adminCooperativaId: TENANT_A,
      });
    } catch (e: any) {
      if (e?.status === 400 && e?.message?.includes('cobrança dupla')) {
        bloqDup = true;
        msgDup = e.message;
      }
    }
    if (!bloqDup) fail(`5) Conveniado em convênio com clube ACEITOU adesão (bug 0.4 vivo)`);
    else ok(`5) INVARIANTE OK: conveniado em convênio com clube → 400 ("${msgDup.slice(0, 60)}…")`);

    // ── 6) resolverParaCobrancaIndividual snapshot pra Fatia 0.4 ──
    const snap = await service.resolverParaCobrancaIndividual(coopComum, TENANT_A);
    if (!snap || snap.planoClubeId !== planoAtivoA || snap.valorMensal !== 29.9) {
      fail(`6) Snapshot pra Fatia 0.4 errado: ${JSON.stringify(snap)}`);
    } else {
      ok(`6) Helper Fatia 0.4: snapshot { valorMensal=${snap.valorMensal}, nome=${snap.nome} }`);
    }

    // ── 7) Cancelar adesão → zera ────────────────────────────────
    const r7 = await service.cancelar({
      cooperadoId: coopComum,
      adminCooperativaId: TENANT_A,
    });
    if (r7.planoClubeId !== null || r7.adesaoClubeEm !== null) {
      fail(`7) Cancelar não zerou: ${JSON.stringify(r7)}`);
    } else {
      ok(`7) Cancelar adesão: planoClubeId + adesaoClubeEm zerados`);
    }

    // ── 8) Cancelar 2x (idempotente) ─────────────────────────────
    let idempok = false;
    try {
      const r8 = await service.cancelar({ cooperadoId: coopComum, adminCooperativaId: TENANT_A });
      if (r8.planoClubeId === null && r8.adesaoClubeEm === null) idempok = true;
    } catch {
      idempok = false;
    }
    if (!idempok) fail('8) Cancelar 2x quebrou (não idempotente)');
    else ok(`8) Cancelar 2x: idempotente (ok)`);

    // ── 9) Snapshot após cancelar → null (pra Fatia 0.4 não somar) ──
    const snap2 = await service.resolverParaCobrancaIndividual(coopComum, TENANT_A);
    if (snap2 !== null) fail(`9) Snapshot pós-cancelar não é null: ${JSON.stringify(snap2)}`);
    else ok(`9) Snapshot pós-cancelar: null (Fatia 0.4 não soma)`);

    // ── 10) Re-aderir após cancelar → funciona ──────────────────
    const r10 = await service.aderir({
      cooperadoId: coopComum,
      planoClubeId: planoAtivoA,
      adminCooperativaId: TENANT_A,
    });
    if (r10.planoClubeId !== planoAtivoA || !r10.adesaoClubeEm) {
      fail(`10) Re-aderir falhou: ${JSON.stringify(r10)}`);
    } else {
      ok(`10) Re-aderir após cancelar: nova adesaoClubeEm marcada`);
    }
  } finally {
    // Cleanup
    if (membroVinculo) await prisma.convenioCooperado.delete({ where: { id: membroVinculo } }).catch(() => null);
    if (convenioComClube) await prisma.contratoConvenio.delete({ where: { id: convenioComClube } }).catch(() => null);
    if (coopComum) await prisma.cooperado.delete({ where: { id: coopComum } }).catch(() => null);
    if (coopConveniado) await prisma.cooperado.delete({ where: { id: coopConveniado } }).catch(() => null);
    if (coopOutro) await prisma.cooperado.delete({ where: { id: coopOutro } }).catch(() => null);
    const planoIds = [planoAtivoA, planoInativoA, planoAtivoB].filter(Boolean) as string[];
    if (planoIds.length) await prisma.planoClube.deleteMany({ where: { id: { in: planoIds } } });
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
  .finally(() => prisma.$disconnect());
