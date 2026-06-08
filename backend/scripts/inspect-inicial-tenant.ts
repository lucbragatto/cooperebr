import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();
(async () => {
  const tenantId = 'cmn0ho8bx0000uox8wu96u6fd';
  const inicialG = await prisma.fluxoEtapa.findFirst({
    where: { estado: 'INICIAL', cooperativaId: null },
    select: { id: true, ativo: true, gatilhos: true, acaoAutomatica: true, modeloMensagemId: true },
  });
  const inicialT = await prisma.fluxoEtapa.findFirst({
    where: { estado: 'INICIAL', cooperativaId: tenantId },
    select: { id: true, ativo: true, gatilhos: true, acaoAutomatica: true, modeloMensagemId: true },
  });
  console.log('GLOBAL:', JSON.stringify(inicialG, null, 2));
  console.log('TENANT:', JSON.stringify(inicialT, null, 2));
  if (inicialT?.modeloMensagemId) {
    const m = await prisma.modeloMensagem.findUnique({ where: { id: inicialT.modeloMensagemId } });
    console.log('Modelo TENANT INICIAL:', m?.nome, '\n', m?.conteudo);
  }
  if (inicialG?.modeloMensagemId) {
    const m = await prisma.modeloMensagem.findUnique({ where: { id: inicialG.modeloMensagemId } });
    console.log('\nModelo GLOBAL INICIAL:', m?.nome, '\n', m?.conteudo);
  }
  await prisma.$disconnect();
})();
