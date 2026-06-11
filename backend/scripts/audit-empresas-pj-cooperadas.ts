/**
 * Audit F2 — quantas empresas PJ cooperadas (tipoPessoa=PJ) existem hoje no
 * banco, por status. Pré-requisito da Decisão 23 (saber a base antes do F2).
 */
import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();
(async () => {
  const total = await prisma.cooperado.count({
    where: { tipoPessoa: 'PJ' },
  });
  const ativosOuRecebendo = await prisma.cooperado.count({
    where: { tipoPessoa: 'PJ', status: { in: ['ATIVO', 'ATIVO_RECEBENDO_CREDITOS'] } },
  });
  const porStatus = await prisma.cooperado.groupBy({
    by: ['status'],
    where: { tipoPessoa: 'PJ' },
    _count: { _all: true },
  });
  const porCoop = await prisma.cooperado.groupBy({
    by: ['cooperativaId'],
    where: { tipoPessoa: 'PJ', status: { in: ['ATIVO', 'ATIVO_RECEBENDO_CREDITOS'] } },
    _count: { _all: true },
  });
  console.log(`[audit-PJ] total cooperados PJ: ${total}`);
  console.log(`[audit-PJ] PJ ATIVO/ATIVO_RECEBENDO_CREDITOS: ${ativosOuRecebendo}`);
  console.log(`[audit-PJ] distribuicao por status:`);
  for (const r of porStatus) {
    console.log(`  ${r.status.padEnd(30)} | ${r._count._all}`);
  }
  console.log(`[audit-PJ] PJ ativos por cooperativa:`);
  for (const r of porCoop) {
    if (!r.cooperativaId) continue;
    const coop = await prisma.cooperativa.findUnique({
      where: { id: r.cooperativaId },
      select: { nome: true },
    });
    console.log(`  ${(coop?.nome ?? '?').padEnd(35)} | ${r._count._all}`);
  }
  // Quantas CooperTokenCompra existem hoje
  const totalCompras = await prisma.cooperTokenCompra.count();
  const comprasPorStatus = await prisma.cooperTokenCompra.groupBy({
    by: ['status'],
    _count: { _all: true },
  });
  console.log(`[audit-compra] total CooperTokenCompra: ${totalCompras}`);
  for (const r of comprasPorStatus) {
    console.log(`  ${r.status.padEnd(25)} | ${r._count._all}`);
  }
  await prisma.$disconnect();
})();
