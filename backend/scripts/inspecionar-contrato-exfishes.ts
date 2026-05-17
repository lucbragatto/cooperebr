import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
  const contratos = await prisma.contrato.findMany({
    where: {
      cooperado: { nomeCompleto: { contains: 'EXFISHES', mode: 'insensitive' } },
      status: { in: ['ATIVO', 'PENDENTE_ATIVACAO'] },
    },
    include: {
      cooperado: { select: { id: true, nomeCompleto: true } },
      usina: { select: { id: true, nome: true, capacidadeKwh: true } },
    },
  });

  for (const c of contratos) {
    console.log('═══════════════════════════════');
    console.log(`contratoId:        ${c.id}`);
    console.log(`numero:            ${c.numero}`);
    console.log(`status:            ${c.status}`);
    console.log(`cooperado:         ${c.cooperado.nomeCompleto} (${c.cooperado.id})`);
    console.log(`usina:             ${c.usina?.nome} (cap=${c.usina?.capacidadeKwh})`);
    console.log(`kwhContrato:       ${c.kwhContrato} (Decimal raw)`);
    console.log(`kwhContratoAnual:  ${c.kwhContratoAnual}`);
    console.log(`kwhContratoMensal: ${c.kwhContratoMensal}`);
    console.log(`percentualUsina:   ${c.percentualUsina} (Decimal raw)`);
    console.log(`updatedAt:         ${c.updatedAt.toISOString()}`);
  }

  // Histórico migracoes
  console.log('\n═══ Histórico MigracaoUsina (5 últimas) ═══');
  if (contratos[0]) {
    const hist = await prisma.migracaoUsina.findMany({
      where: { cooperadoId: contratos[0].cooperado.id },
      orderBy: { criadoEm: 'desc' },
      take: 5,
    });
    for (const m of hist) {
      console.log(`${m.criadoEm.toISOString()} | ${m.tipo} | kwhAnt=${m.kwhAnterior} kwhNovo=${m.kwhNovo} %ant=${m.percentualAnterior} %novo=${m.percentualNovo} motivo=${m.motivo ?? '-'}`);
    }
  }
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
