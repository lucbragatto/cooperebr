import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

const leads = await prisma.leadExpansao.findMany({
  orderBy: { createdAt: 'desc' },
  take: 5,
  select: {
    id: true,
    nomeCompleto: true,
    telefone: true,
    distribuidora: true,
    status: true,
    createdAt: true,
    economiaEstimada: true,
    valorFatura: true,
    cooperativaId: true,
    intencaoConfirmada: true,
    numeroUC: true,
  }
});
console.log('=== LEADS RECENTES ===');
console.log(JSON.stringify(leads, null, 2));

await prisma.$disconnect();
