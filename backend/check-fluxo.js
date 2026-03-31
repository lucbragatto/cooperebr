const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient({ datasources: { db: { url: process.env.DATABASE_URL } } });

async function main() {
  // Buscar etapas com estado MENU_PRINCIPAL
  const etapas = await prisma.fluxoEtapa.findMany({
    where: { estado: 'MENU_PRINCIPAL', ativo: true },
    select: { id: true, nome: true, estado: true, gatilhos: true, modeloMensagemId: true }
  });
  console.log('Etapas MENU_PRINCIPAL:', JSON.stringify(etapas, null, 2));
  
  // Verificar se há etapa que faz transição para MENU_CONVITE_INDICACAO
  const todasEtapas = await prisma.fluxoEtapa.findMany({
    where: { ativo: true },
    select: { id: true, nome: true, estado: true, gatilhos: true }
  });
  
  const comConvite = todasEtapas.filter(e => {
    const g = e.gatilhos;
    if (Array.isArray(g)) return g.some(x => x.proximoEstado === 'MENU_CONVITE_INDICACAO');
    return false;
  });
  console.log('Etapas com transição para MENU_CONVITE_INDICACAO:', JSON.stringify(comConvite, null, 2));
}

require('dotenv').config({ path: 'C:\\Users\\Luciano\\cooperebr\\backend\\.env' });
main().catch(console.error).finally(() => prisma.$disconnect());
