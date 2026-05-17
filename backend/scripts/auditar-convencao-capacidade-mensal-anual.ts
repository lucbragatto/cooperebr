import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
  console.log('═══ Auditar convenção: capacidadeKwh mensal ou anual? ═══\n');

  const usinas = await prisma.usina.findMany({
    where: { capacidadeKwh: { not: null } },
    select: {
      id: true, nome: true, apelidoInterno: true,
      capacidadeKwh: true, producaoMensalKwh: true,
    },
  });

  for (const u of usinas) {
    const agg = await prisma.contrato.aggregate({
      where: { usinaId: u.id, status: { in: ['ATIVO', 'PENDENTE_ATIVACAO'] } },
      _sum: { kwhContrato: true, kwhContratoAnual: true },
      _count: { id: true },
    });
    const cap = Number(u.capacidadeKwh ?? 0);
    const prod = Number(u.producaoMensalKwh ?? 0);
    const somaContratoMensal = Number(agg._sum.kwhContrato ?? 0);
    const somaContratoAnual = Number(agg._sum.kwhContratoAnual ?? 0);

    console.log(`──── ${u.nome} (${u.apelidoInterno ?? '-'})`);
    console.log(`  capacidadeKwh:        ${cap}`);
    console.log(`  producaoMensalKwh:    ${prod} (campo separado — mensal)`);
    console.log(`  contratos ATIVOS:     ${agg._count.id}`);
    console.log(`  Σ kwhContrato:        ${somaContratoMensal}`);
    console.log(`  Σ kwhContratoAnual:   ${somaContratoAnual}`);
    if (cap > 0) {
      const razaoSomaSobreCap = somaContratoMensal / cap;
      const razaoSomaAnualSobreCap = somaContratoAnual / cap;
      console.log(`  Σ kwhContrato/cap:    ${(razaoSomaSobreCap * 100).toFixed(2)}%`);
      console.log(`  Σ kwhContratoAnual/cap: ${(razaoSomaAnualSobreCap * 100).toFixed(2)}%`);
      if (somaContratoMensal <= cap * 1.01) console.log(`  → CONSISTENTE com cap MENSAL (Σ kwh ≤ cap)`);
      if (somaContratoMensal > cap * 1.01 && somaContratoMensal <= cap * 12 * 1.01) console.log(`  → POSSÍVEL cap ANUAL (Σ kwh entre cap e cap*12)`);
      if (cap === prod) console.log(`  → cap == producaoMensalKwh — sugere AMBOS mensais`);
    }
    console.log('');
  }
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
