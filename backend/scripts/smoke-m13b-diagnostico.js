/**
 * Diagnóstico smoke M13.B — investiga ausência de disparos.
 * Frentes 1, 2, 4b consultadas via Prisma.
 */
require('dotenv').config();
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

(async () => {
  console.log('═══ FRENTE 1 — Envios cooperebr2 recentes ═══');
  const envios = await prisma.envioListaConcessionaria.findMany({
    where: { numeroInterno: { startsWith: 'LIST-cooperebr2-' } },
    orderBy: { createdAt: 'desc' },
    take: 5,
    select: {
      id: true,
      numeroInterno: true,
      status: true,
      liberadaEm: true,
      updatedAt: true,
      createdAt: true,
      cooperados: {
        select: {
          cooperadoId: true,
          statusIndividual: true,
          dataHomologacao: true,
          contratoId: true,
        },
      },
    },
  });
  console.log(JSON.stringify(envios, null, 2));

  console.log('\n═══ FRENTE 2 — Contrato fase 4 estado atual ═══');
  const contrato = await prisma.contrato.findUnique({
    where: { id: 'cmpb9e4z40007vahs4xb6tmbj' },
    select: { id: true, numero: true, status: true, dataAtivacao: true, updatedAt: true },
  });
  console.log(JSON.stringify(contrato, null, 2));

  console.log('\n═══ FRENTE 4b — Email logs (homologado + fase4banco) ═══');
  const emailLogs = await prisma.$queryRawUnsafe(
    `SELECT id, destinatario, assunto, status, "erro", "createdAt" FROM email_logs WHERE destinatario IN ($1, $2) ORDER BY "createdAt" DESC LIMIT 10`,
    'lucbragatto+homologado@gmail.com',
    'lucbragatto+fase4banco@gmail.com',
  );
  console.log(JSON.stringify(emailLogs, null, 2));

  console.log('\n═══ AuditLog recente para envio-lista ═══');
  try {
    const audit = await prisma.$queryRawUnsafe(
      `SELECT id, acao, recurso, "recursoId", "createdAt" FROM audit_log WHERE acao LIKE 'envio-lista%' ORDER BY "createdAt" DESC LIMIT 8`,
    );
    console.log(JSON.stringify(audit, null, 2));
  } catch (e) {
    console.log('audit_log query erro:', e.message);
  }

  await prisma.$disconnect();
})().catch(async (e) => { console.error('ERRO:', e.message); await prisma.$disconnect(); process.exit(1); });
