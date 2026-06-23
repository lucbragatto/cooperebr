/**
 * Sprint FAXINA CONTÁBIL DO TOKEN — Fase A migração de dados.
 *
 * Move os N lançamentos cuja descricao começa com '[Token]' que estão
 * indo pra 5.1.01 (Dispendio Operacional Usina — Propria) pra nova conta
 * 5.1.10 (Custo Desconto Token). Os lançamentos REAIS de usina (sem
 * prefixo [Token]) ficam intactos.
 *
 * DRY-RUN obrigatório (CLAUDE.md schema):
 *   node -e "require('dotenv').config({path:'.env'}); require('ts-node').register({transpileOnly:true}); require('./scripts/faxina-contabil-fase-a-migra-lancs.ts');"             # DRY-RUN
 *   FAXINA_APPLY=1 node ... # APLICA
 */
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
const APPLY = process.env.FAXINA_APPLY === '1';

async function main() {
  console.log('\n=== FAXINA Fase A — Migrar lançamentos [Token] de 5.1.01 → 5.1.10 ===');
  console.log(APPLY ? 'MODO: APLICAR' : 'MODO: DRY-RUN');

  const contas5101 = await prisma.planoContas.findMany({
    where: { codigo: '5.1.01', cooperativaId: { not: null } },
    select: { id: true, nome: true, cooperativaId: true },
  });
  const contas5110 = await prisma.planoContas.findMany({
    where: { codigo: '5.1.10', cooperativaId: { not: null } },
    select: { id: true, cooperativaId: true },
  });
  const mapaTenant5110 = new Map(contas5110.map((c) => [c.cooperativaId!, c.id]));

  let totalMigrados = 0;
  for (const c5101 of contas5101) {
    const tenantId = c5101.cooperativaId!;
    const novaContaId = mapaTenant5110.get(tenantId);
    if (!novaContaId) {
      console.log(`[skip] tenant ${tenantId} não tem 5.1.10 — rode faxina-contabil-fase-a-planocontas.ts primeiro`);
      continue;
    }

    const tenant = await prisma.cooperativa.findUnique({
      where: { id: tenantId },
      select: { nome: true },
    });
    console.log(`\n--- Tenant ${tenant?.nome} ---`);
    console.log(`  5.1.01 (id=${c5101.id}): "${c5101.nome}"`);
    console.log(`  5.1.10 (id=${novaContaId}): destino "Custo Desconto Token"`);

    const candidatos = await prisma.lancamentoCaixa.findMany({
      where: {
        planoContasId: c5101.id,
        descricao: { startsWith: '[Token]' },
      },
      select: { id: true, descricao: true, valor: true, competencia: true, status: true, createdAt: true },
      orderBy: { createdAt: 'asc' },
    });

    const naoToken = await prisma.lancamentoCaixa.count({
      where: { planoContasId: c5101.id, NOT: { descricao: { startsWith: '[Token]' } } },
    });

    console.log(`  Candidatos [Token] pra migrar: ${candidatos.length}`);
    console.log(`  Lançamentos USINA REAL (preservar intactos): ${naoToken}`);

    for (const l of candidatos) {
      console.log(`    ANTES: id=${l.id.slice(0, 8)}… valor=R$${l.valor} comp=${l.competencia} desc="${(l.descricao || '').slice(0, 70)}"`);
    }

    if (candidatos.length === 0) {
      console.log('  [skip] nada pra migrar');
      continue;
    }

    if (APPLY) {
      const ids = candidatos.map((c) => c.id);
      const r = await prisma.lancamentoCaixa.updateMany({
        where: {
          id: { in: ids },
          planoContasId: c5101.id, // defense-in-depth
          descricao: { startsWith: '[Token]' },
        },
        data: { planoContasId: novaContaId },
      });
      console.log(`  [APLICADO] ${r.count} lançamentos migrados`);
      totalMigrados += r.count;
    } else {
      console.log(`  [DRY-RUN] ${candidatos.length} lançamentos seriam migrados`);
    }
  }

  console.log('\n=== ESTADO PÓS-OPERAÇÃO ===');
  for (const c5101 of contas5101) {
    const tenantId = c5101.cooperativaId!;
    const novaContaId = mapaTenant5110.get(tenantId);
    if (!novaContaId) continue;
    const tenant = await prisma.cooperativa.findUnique({
      where: { id: tenantId },
      select: { nome: true },
    });
    const lancs5101 = await prisma.lancamentoCaixa.findMany({
      where: { planoContasId: c5101.id },
      select: { descricao: true, valor: true },
      take: 5,
    });
    const lancs5110Total = await prisma.lancamentoCaixa.aggregate({
      where: { planoContasId: novaContaId },
      _count: { _all: true },
      _sum: { valor: true },
    });
    console.log(`\n${tenant?.nome}:`);
    console.log(`  5.1.01 (Usina): amostra de descricoes restantes:`);
    for (const x of lancs5101) console.log(`    R$${Number(x.valor).toFixed(2)} "${(x.descricao || '').slice(0, 80)}"`);
    console.log(`  5.1.10 (Token): TOTAL count=${lancs5110Total._count._all} Σ=R$${Number(lancs5110Total._sum.valor ?? 0).toFixed(2)}`);
  }
  if (APPLY) console.log(`\nTotal migrado: ${totalMigrados}`);
}

main()
  .catch((err) => {
    console.error('FAXINA Fase A migração falhou:', err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
