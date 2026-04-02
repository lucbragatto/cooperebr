const { PrismaClient } = require('@prisma/client');
require('dotenv').config({ path: 'C:\\Users\\Luciano\\cooperebr\\backend\\.env' });
const prisma = new PrismaClient();

async function main() {
  // Ver todas as etapas ativas
  const etapas = await prisma.fluxoEtapa.findMany({
    where: { ativo: true },
    select: { id: true, nome: true, estado: true, gatilhos: true, modeloMensagemId: true }
  });
  
  console.log('Total etapas ativas:', etapas.length);
  
  // Mostrar etapas com estado MENU_COOPERADO
  const menuCoop = etapas.filter(e => e.estado === 'MENU_COOPERADO');
  console.log('\nEtapas MENU_COOPERADO:', JSON.stringify(menuCoop, null, 2));
  
  // Mostrar etapa MENU_PRINCIPAL e seus gatilhos
  const menuPrincipal = etapas.filter(e => e.estado === 'MENU_PRINCIPAL');
  console.log('\nEtapas MENU_PRINCIPAL:', JSON.stringify(menuPrincipal, null, 2));
}

main().catch(console.error).finally(() => prisma.$disconnect());
