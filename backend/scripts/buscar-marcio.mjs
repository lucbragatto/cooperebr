import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();
const r = await prisma.cooperado.findMany({
  where: { nomeCompleto: { contains: 'marcio', mode: 'insensitive' } },
  include: { ucs: true, contratos: { include: { plano: true } } }
});
console.log(JSON.stringify(r, null, 2));
await prisma.$disconnect();
