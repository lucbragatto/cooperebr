/**
 * Smoke M13.B helper — confirma estado fase 4 pré e pós-smoke regression.
 * Uso: node scripts/smoke-m13b-check-fase4.js
 */
require('dotenv').config();
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
(async () => {
  const c = await prisma.contrato.findUnique({
    where: { id: 'cmpb9e4z40007vahs4xb6tmbj' },
    select: {
      id: true, numero: true, status: true, dataAtivacao: true,
      cooperado: { select: { id: true, nomeCompleto: true, ambienteTeste: true, email: true, telefone: true } },
      usina: { select: { id: true, nome: true, apelidoInterno: true, cooperativa: { select: { id: true, nome: true } } } },
    },
  });
  console.log(JSON.stringify(c, null, 2));
  await prisma.$disconnect();
})().catch(async (e) => { console.error(e.message); await prisma.$disconnect(); process.exit(1); });
