import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
  console.log('═══ Auditoria percentualUsina corrompido (ratio vs percent) ═══\n');

  const todos = await prisma.contrato.findMany({
    where: {
      status: { in: ['ATIVO', 'PENDENTE_ATIVACAO'] },
      percentualUsina: { not: null },
    },
    include: {
      cooperado: { select: { id: true, nomeCompleto: true, cpf: true, cooperativaId: true } },
      usina: { select: { id: true, nome: true, capacidadeKwh: true } },
    },
  });

  console.log(`>> total contratos ATIVO/PENDENTE com percentualUsina != null: ${todos.length}\n`);

  const corrompidoCandidato: typeof todos = [];
  const normais: typeof todos = [];
  const acima100: typeof todos = [];

  for (const c of todos) {
    const p = Number(c.percentualUsina ?? 0);
    if (p > 0 && p < 1) corrompidoCandidato.push(c);
    else if (p > 100.0001) acima100.push(c);
    else normais.push(c);
  }

  console.log(`>> categorização:`);
  console.log(`  - percentualUsina entre 0 e <1 (CANDIDATO ratio corrompido): ${corrompidoCandidato.length}`);
  console.log(`  - percentualUsina >= 1 e <= 100 (formato percent inteiro): ${normais.length}`);
  console.log(`  - percentualUsina > 100 (inconsistente, investigar): ${acima100.length}\n`);

  if (corrompidoCandidato.length > 0) {
    console.log('>> CANDIDATOS A CORROMPIDO (ordem updatedAt desc):');
    corrompidoCandidato
      .sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime())
      .forEach((c) => {
        const p = Number(c.percentualUsina ?? 0);
        const kwh = Number(c.kwhContrato ?? 0);
        const cap = Number(c.usina?.capacidadeKwh ?? 0);
        const percentInferido = cap > 0 ? Math.round((kwh * 12 / cap) * 10000) / 100 : 0;
        const looksLikeRatio = Math.abs(p * 100 - percentInferido) < 0.5;
        const flag = looksLikeRatio ? '🔴 RATIO' : '🟡 INVESTIGAR';
        console.log(`  ${flag} | ${c.cooperado.nomeCompleto.slice(0, 28).padEnd(28)} | ${c.numero.padEnd(15)} | %=${String(p).padEnd(10)} | kwh=${String(kwh).padEnd(10)} | cap=${String(cap).padEnd(8)} | percSeKwhCerto=${percentInferido}% | upd=${c.updatedAt.toISOString().slice(0,16)}`);
      });
  }

  if (acima100.length > 0) {
    console.log('\n>> ACIMA DE 100% (inconsistência grave):');
    acima100.forEach((c) => {
      console.log(`  ${c.cooperado.nomeCompleto} | ${c.numero} | %=${Number(c.percentualUsina)} | kwh=${c.kwhContrato}`);
    });
  }

  console.log('\n>> Histórico MigracaoUsina — registros com %novo<1 (origem do bug):');
  const histRatio = await prisma.migracaoUsina.findMany({
    where: { percentualNovo: { gt: 0, lt: 1 } },
    orderBy: { criadoEm: 'asc' },
    take: 15,
    select: { criadoEm: true, tipo: true, percentualNovo: true, kwhNovo: true, cooperadoId: true },
  });
  console.log(`  total registros migracao com %novo<1: ${histRatio.length} (até 15 mais antigos)`);
  for (const m of histRatio) {
    console.log(`  ${m.criadoEm.toISOString().slice(0,19)} | ${m.tipo} | %novo=${m.percentualNovo} | kwhNovo=${m.kwhNovo} | coopId=${m.cooperadoId.slice(-8)}`);
  }
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
