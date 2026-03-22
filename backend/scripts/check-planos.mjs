import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();
const [planos, configs] = await Promise.all([
  prisma.plano.findMany({ where: { ativo: true } }),
  prisma.configTenant.findMany({ where: { chave: { contains: 'desconto' } } })
]);
console.log('PLANOS ATIVOS:', JSON.stringify(planos, null, 2));
console.log('CONFIGS DESCONTO:', JSON.stringify(configs, null, 2));
await prisma.$disconnect();
