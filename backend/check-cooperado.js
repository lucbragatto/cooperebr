const { PrismaClient } = require('@prisma/client');
require('dotenv').config({ path: 'C:\\Users\\Luciano\\cooperebr\\backend\\.env' });
const prisma = new PrismaClient();

async function main() {
  // Verificar cooperado do número de teste (Luciano)
  const tel = '5527981341348';
  const telSem = '27981341348';
  const c = await prisma.cooperado.findFirst({
    where: { OR: [{ telefone: tel }, { telefone: telSem }, { telefone: `55${telSem}` }] },
    select: { id: true, nomeCompleto: true, status: true, telefone: true }
  });
  console.log('Cooperado encontrado:', JSON.stringify(c));
}
main().catch(console.error).finally(() => prisma.$disconnect());
