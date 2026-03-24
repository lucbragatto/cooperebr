import { PrismaClient } from '@prisma/client';
const p = new PrismaClient();

const COOPEREBR_ID = 'cmn0ho8bx0000uox8wu96u6fd';

// Vincular as usinas sem cooperativaId à CoopereBR
const result = await p.usina.updateMany({
  where: { cooperativaId: null },
  data: { cooperativaId: COOPEREBR_ID }
});

console.log(`Usinas vinculadas à CoopereBR: ${result.count}`);

// Confirmar
const usinas = await p.usina.findMany({ select: { nome: true, cooperativaId: true } });
usinas.forEach(u => console.log(` - ${u.nome}: ${u.cooperativaId}`));

await p.$disconnect();
