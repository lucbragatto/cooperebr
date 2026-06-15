import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();
(async () => {
  // Lança que veio com TZ shift (CT.9): origemTipo=CONVENIO + descrição "teste"
  const candidatos = await prisma.lancamentoCaixa.findMany({
    where: { origemTipo: 'CONVENIO' },
    select: { id: true, descricao: true, competencia: true, dataPagamento: true, convenioContabilId: true },
    orderBy: { createdAt: 'desc' },
  });
  console.log(`Total movimentos de convênio: ${candidatos.length}`);
  candidatos.forEach(c => {
    const dia = c.dataPagamento?.toISOString().slice(0,10) ?? '—';
    console.log(`${c.id.slice(0,8)} compet=${c.competencia} data=${dia} conv=${c.convenioContabilId?.slice(0,8)} "${c.descricao}"`);
  });
  await prisma.$disconnect();
})();
