import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();
const propostas = await prisma.propostaCooperado.findMany({
  orderBy: { createdAt: 'desc' },
  take: 5,
  include: { cooperado: { select: { nomeCompleto: true } } }
});
console.log(JSON.stringify(propostas.map(p => ({ id: p.id, cooperado: p.cooperado.nomeCompleto, status: p.status, createdAt: p.createdAt })), null, 2));
await prisma.$disconnect();
