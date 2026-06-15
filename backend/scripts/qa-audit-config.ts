import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();
async function main() {
  console.log('=== AUDIT LOGS ===');
  const total = await prisma.$queryRawUnsafe<any[]>(`SELECT COUNT(*)::int AS c FROM audit_logs`);
  console.log(`Total entries audit_logs: ${total[0].c}`);
  const logs = await prisma.$queryRawUnsafe<any[]>(
    `SELECT id, "usuarioId", acao, recurso, "recursoId", "createdAt" FROM audit_logs ORDER BY "createdAt" DESC LIMIT 20`
  );
  console.log(`Top 20:`);
  logs.forEach((l, i) => {
    console.log(`  ${i+1}. [${l.createdAt?.toISOString?.()}] ${l.acao} | recurso=${l.recurso} | recursoId=${l.recursoId ?? '-'} | userId=${l.usuarioId ?? '-'}`);
  });

  console.log('\n=== CONFIG TENANT - chaves Bloco D ===');
  const cfg = await prisma.$queryRawUnsafe<any[]>(
    `SELECT "cooperativaId", chave, valor FROM config_tenant WHERE chave LIKE 'cron.%' OR chave LIKE 'lembrete.%' ORDER BY "cooperativaId", chave`
  );
  console.log(`Total: ${cfg.length}`);
  cfg.forEach(c => console.log(`  tenant=${c.cooperativaId} | ${c.chave} = ${c.valor}`));

  console.log('\n=== CONFIG TENANT - todas chaves (top 20) ===');
  const cfgAll = await prisma.$queryRawUnsafe<any[]>(`SELECT DISTINCT chave FROM config_tenant ORDER BY chave LIMIT 30`);
  cfgAll.forEach(c => console.log(`  ${c.chave}`));

  await prisma.$disconnect();
}
main().catch(e => { console.error(e); process.exit(1); });
