/* Read-only — diagnóstico das 4 cobranças piloto invisíveis no GET /cobrancas. */
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const COOP_ID = 'cmn0ho8bx0000uox8wu96u6fd';
const CONTRATOS = [
  'cmp4jpk2o000bvagcgxaai4t3',
  'cmp4ktx2p000fva3kd5t47u3q',
  'cmp4ku08w000zva3kt6zxohkp',
  'cmp4ku3bw001jva3k1zqi7uj4',
];

async function main() {
  // 1. Count direto
  const countCoopereBR = await prisma.cobranca.count({ where: { cooperativaId: COOP_ID } });
  console.log(`Count cobrancas cooperativaId=CoopereBR: ${countCoopereBR}`);

  const countTotalGlobal = await prisma.cobranca.count();
  console.log(`Count cobrancas global: ${countTotalGlobal}`);

  // 2. As 4 cobranças dos pilotos
  const cobrancasPilotos = await prisma.cobranca.findMany({
    where: { contratoId: { in: CONTRATOS } },
    select: {
      id: true,
      contratoId: true,
      cooperativaId: true,
      modeloCobrancaUsado: true,
      valorLiquido: true,
      mesReferencia: true,
      anoReferencia: true,
      status: true,
      createdAt: true,
      contrato: { select: { numero: true, cooperativaId: true, cooperadoId: true } },
    },
  });
  console.log(`\nCobranças piloto encontradas: ${cobrancasPilotos.length}`);
  for (const c of cobrancasPilotos) {
    console.log(JSON.stringify(c, null, 2));
  }

  // 3. Reproduzir findAll exatamente como o service faz (assumindo cooperativaId filter)
  const findAllSimulado = await prisma.cobranca.findMany({
    where: { cooperativaId: COOP_ID },
    select: { id: true, contratoId: true, cooperativaId: true, createdAt: true, modeloCobrancaUsado: true },
    orderBy: { createdAt: 'desc' },
  });
  console.log(`\nfindAll simulado (where cooperativaId=CoopereBR): ${findAllSimulado.length}`);
  console.log('Top 6 mais recentes:');
  findAllSimulado.slice(0, 6).forEach((c) => console.log(`  - ${c.id} contrato=${c.contratoId} modelo=${c.modeloCobrancaUsado} criada=${c.createdAt.toISOString()} cooperativaId=${c.cooperativaId}`));

  // 4. Cross-check — quais das 4 pilotos têm cooperativaId NULL na cobrança?
  const semCoopId = cobrancasPilotos.filter((c) => !c.cooperativaId);
  console.log(`\nCobranças piloto com cooperativaId NULL: ${semCoopId.length}`);

  // 5. Distribuição de cooperativaId nas cobranças
  const distrib = await prisma.cobranca.groupBy({
    by: ['cooperativaId'],
    _count: { id: true },
  });
  console.log('\nDistribuição cooperativaId em todas as cobranças:');
  distrib.forEach((d) => console.log(`  - cooperativaId=${d.cooperativaId} count=${d._count.id}`));

  await prisma.$disconnect();
}

main().catch(async (e) => {
  console.error('ERRO:', e);
  await prisma.$disconnect();
  process.exit(1);
});
