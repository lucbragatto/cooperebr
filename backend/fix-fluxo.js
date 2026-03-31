const { PrismaClient } = require('@prisma/client');
require('dotenv').config({ path: 'C:\\Users\\Luciano\\cooperebr\\backend\\.env' });

const prisma = new PrismaClient();

async function main() {
  // Remover o gatilho "4" -> MENU_CONVITE_INDICACAO do menu principal
  // O hardcoded já trata isso com lógica mais completa
  const etapa = await prisma.fluxoEtapa.findUnique({ where: { id: 'f-menu-principal' } });
  
  const gatilhosAtuais = etapa.gatilhos;
  console.log('Gatilhos antes:', JSON.stringify(gatilhosAtuais, null, 2));
  
  // Remover o gatilho de resposta "4"
  const gatilhosFiltrados = gatilhosAtuais.filter(g => g.resposta !== '4');
  console.log('Gatilhos depois:', JSON.stringify(gatilhosFiltrados, null, 2));
  
  await prisma.fluxoEtapa.update({
    where: { id: 'f-menu-principal' },
    data: { gatilhos: gatilhosFiltrados }
  });
  
  console.log('Gatilho "4" removido do motor dinâmico. O hardcoded agora vai tratar.');
}

main().catch(console.error).finally(() => prisma.$disconnect());
