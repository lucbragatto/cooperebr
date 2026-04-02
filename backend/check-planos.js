const { PrismaClient } = require('@prisma/client');
require('dotenv').config({ path: 'C:\\Users\\Luciano\\cooperebr\\backend\\.env' });
const prisma = new PrismaClient();

async function main() {
  const planos = await prisma.plano.findMany({
    where: { ativo: true },
    select: { id: true, nome: true, modeloCobranca: true, descontoBase: true, temPromocao: true, descontoPromocional: true }
  });
  console.log('Planos ativos:', JSON.stringify(planos, null, 2));
  
  const config = await prisma.configuracaoMotor.findFirst();
  console.log('\nConfig motor:', JSON.stringify(config, null, 2));
}
main().catch(console.error).finally(() => prisma.$disconnect());
