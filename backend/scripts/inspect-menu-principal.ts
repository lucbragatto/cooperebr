import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();
(async () => {
  const tenantId = 'cmn0ho8bx0000uox8wu96u6fd';
  for (const ten of [null, tenantId]) {
    const e = await prisma.fluxoEtapa.findFirst({
      where: { estado: 'MENU_PRINCIPAL', cooperativaId: ten },
      select: { id: true, ativo: true, gatilhos: true, modeloMensagemId: true },
    });
    console.log(`MENU_PRINCIPAL [${ten ?? 'global'}]:`, JSON.stringify(e, null, 2));
  }
  // Conferir tenant CoopereBR também
  console.log('\n--- MENU_COOPERADO ---');
  for (const ten of [null, tenantId]) {
    const e = await prisma.fluxoEtapa.findFirst({
      where: { estado: 'MENU_COOPERADO', cooperativaId: ten },
      select: { id: true, ativo: true, modeloMensagemId: true, gatilhos: true },
    });
    console.log(`MENU_COOPERADO [${ten ?? 'global'}]:`, JSON.stringify(e, null, 2));
  }
  await prisma.$disconnect();
})();
