import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();
const telefone = process.argv[2] || '5527981341348';
await prisma.conversaWhatsapp.updateMany({
  where: { telefone },
  data: { estado: 'INICIAL', dadosTemp: null, contadorFallback: 0 },
});
console.log(`✅ Conversa de ${telefone} resetada para INICIAL`);
await prisma.$disconnect();
