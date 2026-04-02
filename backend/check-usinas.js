const { PrismaClient } = require('@prisma/client');
require('dotenv').config({ path: 'C:\\Users\\Luciano\\cooperebr\\backend\\.env' });
const prisma = new PrismaClient();

async function main() {
  const usinas = await prisma.usina.findMany({
    select: { id: true, nome: true, distribuidora: true, capacidadeKwh: true, statusHomologacao: true }
  });
  console.log('Usinas:', JSON.stringify(usinas, null, 2));
}
main().catch(console.error).finally(() => prisma.$disconnect());
