import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();
(async () => {
  const lanc = await prisma.lancamentoCaixa.findFirst({
    where: { origemTipo: 'CONVENIO', competencia: '2026-07', descricao: { contains: 'teste' } },
    select: { id: true, descricao: true, competencia: true },
  });
  if (!lanc) {
    console.log('Nenhum movimento de teste com competência errada encontrado.');
  } else {
    console.log(`Deletando ${lanc.id} — "${lanc.descricao}" compet=${lanc.competencia}`);
    await prisma.lancamentoCaixa.delete({ where: { id: lanc.id } });
    console.log('OK deletado.');
  }
  await prisma.$disconnect();
})();
