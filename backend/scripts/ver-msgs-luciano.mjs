import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();
const msgs = await prisma.mensagemWhatsapp.findMany({
  where: { telefone: '5527981341348' },
  orderBy: { createdAt: 'desc' },
  take: 5,
  select: { direcao: true, conteudo: true, createdAt: true }
});
console.log(JSON.stringify(msgs, null, 2));
await prisma.$disconnect();
