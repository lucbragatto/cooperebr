import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();
(async () => {
  const [planos, contratoConvenios, membros, contratos, cooperados, cobrancas] = await Promise.all([
    prisma.plano.count(),
    prisma.contratoConvenio.count(),
    prisma.convenioCooperado.count({ where: { ativo: true } }),
    prisma.contrato.count(),
    prisma.cooperado.count(),
    prisma.cobranca.count(),
  ]);
  console.log(`AUDITORIA PRÉ-MIGRATION D-FISCAL-2.4.1:`);
  console.log(`  plano: ${planos}`);
  console.log(`  contrato_convenio: ${contratoConvenios} (esperado 2 — preservar)`);
  console.log(`  convenio_cooperado ativos: ${membros} (esperado 215 — preservar)`);
  console.log(`  contrato: ${contratos}`);
  console.log(`  cooperado: ${cooperados}`);
  console.log(`  cobranca: ${cobrancas}`);
  await prisma.$disconnect();
})();
