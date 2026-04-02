const { PrismaClient } = require('@prisma/client');
require('dotenv').config({ path: 'C:\\Users\\Luciano\\cooperebr\\backend\\.env' });
const prisma = new PrismaClient();

async function main() {
  // Desativar TODAS as etapas do motor dinâmico
  // O código hardcoded já trata todos os estados com lógica muito mais rica
  const { count } = await prisma.fluxoEtapa.updateMany({
    where: { ativo: true },
    data: { ativo: false }
  });
  console.log(`${count} etapas desativadas no motor dinâmico.`);
  console.log('O bot agora usa 100% o código hardcoded — sem interceptações.');
}

main().catch(console.error).finally(() => prisma.$disconnect());
