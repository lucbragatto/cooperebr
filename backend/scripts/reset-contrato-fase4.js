/**
 * Reset do contrato fase 4 pro novo smoke pós-fix 3 camadas.
 * Volta status pra PENDENTE_ATIVACAO + dataAtivacao=NULL.
 * Envio anterior (HOMOLOGADO_TOTAL) fica como histórico.
 */
require('dotenv').config();
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
(async () => {
  const contratoId = 'cmpb9e4z40007vahs4xb6tmbj';
  const before = await prisma.contrato.findUnique({
    where: { id: contratoId },
    select: { id: true, numero: true, status: true, dataAtivacao: true },
  });
  console.log('ANTES:', JSON.stringify(before, null, 2));

  const after = await prisma.contrato.update({
    where: { id: contratoId },
    data: { status: 'PENDENTE_ATIVACAO', dataAtivacao: null },
    select: { id: true, numero: true, status: true, dataAtivacao: true },
  });
  console.log('DEPOIS:', JSON.stringify(after, null, 2));

  await prisma.$disconnect();
})().catch(async (e) => {
  console.error('ERRO:', e.message);
  await prisma.$disconnect();
  process.exit(1);
});
