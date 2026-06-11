/**
 * Confirma gancho contabil ativado pelo smoke F2.
 * Busca LancamentoCaixa com `[Token]` da Santi nos ultimos 5min.
 */
import { PrismaClient } from '@prisma/client';
const p = new PrismaClient();
(async () => {
  const cincoMinAtras = new Date(Date.now() - 5 * 60 * 1000);
  const lancamentos = await p.lancamentoCaixa.findMany({
    where: {
      cooperadoId: 'cmq6qo4hi0002va2wti5k1sqw',
      descricao: { contains: '[Token]' },
      createdAt: { gte: cincoMinAtras },
    },
    select: {
      id: true,
      tipo: true,
      descricao: true,
      valor: true,
      competencia: true,
      status: true,
      createdAt: true,
    },
    orderBy: { createdAt: 'desc' },
  });
  console.log(`[gancho-contabil] ${lancamentos.length} LancamentoCaixa de Token da Santi (ultimos 5min):`);
  for (const l of lancamentos) {
    console.log(`  ${l.tipo.padEnd(10)} | R$ ${l.valor} | ${l.descricao}`);
  }
  await p.$disconnect();
})();
