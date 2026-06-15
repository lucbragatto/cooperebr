import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
  console.log('=== CTR-2026-0003 detalhado ===');
  const ctr = await prisma.contrato.findFirst({
    where: { numero: 'CTR-2026-0003' },
    include: {
      cooperado: { select: { id: true, nomeCompleto: true, cpf: true, ambienteTeste: true, cooperativaId: true, cooperativa: { select: { nome: true } } } },
      usina: { select: { id: true, nome: true, cooperativaId: true, cooperativa: { select: { nome: true } } } },
      plano: { select: { id: true, nome: true, modeloCobranca: true, cooperativaId: true } },
      uc: { select: { id: true, numero: true, distribuidora: true } },
    },
  });
  console.log(JSON.stringify(ctr, null, 2));

  if (ctr) {
    console.log('\n=== Cobranças do CTR-2026-0003 ===');
    const cobs = await prisma.cobranca.findMany({
      where: { contratoId: ctr.id },
      select: { id: true, status: true, modeloCobrancaUsado: true, valorLiquido: true,
        mesReferencia: true, anoReferencia: true, createdAt: true },
      orderBy: { createdAt: 'desc' },
      take: 10,
    });
    console.log(`Total cobranças: ${cobs.length}`);
    console.log(JSON.stringify(cobs, null, 2));

    console.log('\n=== createdAt do contrato + outras pistas ===');
    console.log(`createdAt: ${ctr.createdAt}`);
    console.log(`Cooperado ambienteTeste: ${ctr.cooperado.ambienteTeste}`);
    console.log(`Cooperado tenant: ${ctr.cooperado.cooperativa?.nome} (id=${ctr.cooperado.cooperativaId})`);
    console.log(`Usina tenant: ${ctr.usina?.cooperativa?.nome} (id=${ctr.usina?.cooperativaId})`);
    console.log(`Status atual: ${ctr.status}`);
  }
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
