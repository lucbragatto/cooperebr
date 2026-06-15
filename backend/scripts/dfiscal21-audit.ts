import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();
(async () => {
  const total = await prisma.contratoConvenio.count();
  const ativos = await prisma.contratoConvenio.count({ where: { status: 'ATIVO' } });
  console.log(`AUDITORIA PRÉ-MIGRATION: contrato_convenio = ${total} (${ativos} ATIVO)`);
  await prisma.$disconnect();
})();
