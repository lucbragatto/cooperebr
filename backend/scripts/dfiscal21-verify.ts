import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();
(async () => {
  const total = await prisma.contratoConvenio.count();
  const sample = await prisma.contratoConvenio.findFirst({
    select: {
      id: true, empresaNome: true, pagador: true, geraLancamentoContabil: true,
      naturezaAtoCooperativo: true, fluxoFinanceiro: true, classificacaoFiscal: true,
      vigenciaInicio: true, vigenciaFim: true,
    },
  });
  console.log(`POS-MIGRATION: contrato_convenio = ${total} (esperado 2 — preservado)`);
  console.log('Sample dos novos campos:', JSON.stringify(sample, null, 2));
  // Confirma defaults aplicados
  const c1 = await prisma.contratoConvenio.findMany({ where: { pagador: 'CADA_MEMBRO' }, select: { id: true } });
  const c2 = await prisma.contratoConvenio.findMany({ where: { geraLancamentoContabil: false }, select: { id: true } });
  console.log(`pagador=CADA_MEMBRO (default): ${c1.length}/${total}`);
  console.log(`geraLancamentoContabil=false (default): ${c2.length}/${total}`);
  await prisma.$disconnect();
})();
