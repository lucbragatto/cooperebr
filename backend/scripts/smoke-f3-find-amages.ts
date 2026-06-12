import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

const AMAGES_ID = 'cmp7034d70002vaf0af5ws4ud';
const COOPEREBR_ID = 'cmn0ho8bx0000uox8wu96u6fd';

async function main() {
  // Busca 2 PF ATIVOs ambienteTeste pra serem funcionários no smoke
  const candidatos = await prisma.cooperado.findMany({
    where: {
      cooperativaId: COOPEREBR_ID,
      ambienteTeste: true,
      status: 'ATIVO',
      tipoPessoa: { not: 'PJ' },
      id: { not: AMAGES_ID },
    },
    select: { id: true, nomeCompleto: true, email: true, status: true, tipoPessoa: true },
    take: 5,
  });
  console.log('CANDIDATOS funcionários (PF teste):', JSON.stringify(candidatos, null, 2));

  await prisma.$disconnect();
}
main();
