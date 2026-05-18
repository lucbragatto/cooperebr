require('dotenv').config();
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
(async () => {
  const contrato = await prisma.$queryRawUnsafe(
    `SELECT id, numero, status, "dataAtivacao", "updatedAt" FROM contratos WHERE id = 'cmpb9e4z40007vahs4xb6tmbj'`
  );
  console.log('CONTRATO:', JSON.stringify(contrato, null, 2));

  const audit = await prisma.$queryRawUnsafe(
    `SELECT recurso, acao, "recursoId", "createdAt", payload::text as payload_short
     FROM audit_log
     WHERE "createdAt" > NOW() - INTERVAL '30 minutes'
       AND recurso = 'EnvioListaConcessionaria'
     ORDER BY "createdAt" DESC LIMIT 10`
  );
  console.log('\nAUDIT LOG (últimos 30min, EnvioListaConcessionaria):', JSON.stringify(audit, null, 2));

  const emailLog = await prisma.$queryRawUnsafe(
    `SELECT destinatario, assunto, status, "criadoEm" FROM email_logs
     WHERE "criadoEm" > NOW() - INTERVAL '30 minutes'
       AND assunto LIKE '%homologad%'
     ORDER BY "criadoEm" DESC LIMIT 5`
  );
  console.log('\nEMAIL_LOG (últimos 30min):', JSON.stringify(emailLog, null, 2));

  await prisma.$disconnect();
})().catch(async (e) => {
  console.error('ERRO:', e.message);
  await prisma.$disconnect();
  process.exit(1);
});
