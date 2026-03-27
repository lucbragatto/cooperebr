import { PrismaClient } from '@prisma/client';
const p = new PrismaClient();

async function main() {
  // Cobranças que receberam WA (enviadas pelo sistema)
  const enviadas = await p.cobranca.findMany({
    where: {
      status: { in: ['PENDENTE', 'VENCIDO'] },
      whatsappEnviadoEm: { not: null },
    },
    include: {
      contrato: {
        include: {
          cooperado: { select: { id: true, nomeCompleto: true, telefone: true } },
        },
      },
    },
    orderBy: { createdAt: 'desc' },
    take: 20,
  });

  // Config financeira das cooperativas (multa/juros)
  const cooperativas = await p.cooperativa.findMany({
    select: { id: true, nome: true, multaAtraso: true, jurosDiarios: true, diasCarencia: true },
  });

  console.log('=== CONFIG FINANCEIRA COOPERATIVAS ===');
  console.log(JSON.stringify(cooperativas, null, 2));

  console.log(`\n=== COBRANÇAS COM WA ENVIADO (${enviadas.length}) ===`);
  console.log(JSON.stringify(enviadas.map(c => ({
    id: c.id,
    status: c.status,
    valorLiquido: Number(c.valorLiquido),
    valorAtualizado: c.valorAtualizado ? Number(c.valorAtualizado) : null,
    valorMulta: c.valorMulta ? Number(c.valorMulta) : null,
    valorJuros: c.valorJuros ? Number(c.valorJuros) : null,
    vencimento: c.dataVencimento,
    whatsappEnviadoEm: c.whatsappEnviadoEm,
    cooperado: c.contrato?.cooperado?.nomeCompleto,
    telefone: c.contrato?.cooperado?.telefone,
    cooperadoId: c.contrato?.cooperado?.id,
    mes: c.mesReferencia,
    ano: c.anoReferencia,
  })), null, 2));

  // Total de cobranças por status
  const stats = await p.cobranca.groupBy({ by: ['status'], _count: true });
  console.log('\n=== TOTAIS POR STATUS ===');
  console.log(JSON.stringify(stats, null, 2));
}

main().then(() => p.$disconnect()).catch(e => { console.error(e); p.$disconnect(); });
