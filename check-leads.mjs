import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

const leads = await prisma.leadExpansao.findMany({
  orderBy: { createdAt: 'desc' },
  take: 5,
  select: { id: true, nome: true, telefone: true, email: true, status: true, createdAt: true, indicadorId: true }
});
console.log('=== LEADS ===');
console.log(JSON.stringify(leads, null, 2));

const cooperados = await prisma.cooperado.findMany({
  orderBy: { createdAt: 'desc' },
  take: 3,
  select: { id: true, nome: true, telefone: true, email: true, status: true, createdAt: true }
});
console.log('=== COOPERADOS RECENTES ===');
console.log(JSON.stringify(cooperados, null, 2));

await prisma.$disconnect();
