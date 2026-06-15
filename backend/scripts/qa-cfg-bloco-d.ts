import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();
async function main() {
  const cfg = await prisma.$queryRawUnsafe<any[]>(
    `SELECT "cooperativaId", chave, valor FROM config_tenant WHERE chave LIKE 'cron_%' OR chave LIKE 'lembrete_%' OR chave LIKE 'email_admin_alertas' OR chave LIKE 'email_institucional_parceiro' ORDER BY "cooperativaId", chave`
  );
  console.log(`Total Bloco D candidates: ${cfg.length}`);
  cfg.forEach(c => console.log(`  tenant=${c.cooperativaId ?? '<global>'} | ${c.chave} = ${c.valor}`));

  console.log('\n=== Decorator @AuditLog em envio-lista ===');
  const fs = require('fs');
  const f = fs.readFileSync('src/envio-lista-concessionaria/envio-lista-concessionaria.controller.ts', 'utf8');
  const matches = f.match(/@AuditLog/g);
  console.log('Ocorrências @AuditLog no controller envio-lista:', matches?.length ?? 0);

  console.log('\n=== Hosts cooperativas (referência ID) ===');
  const c = await prisma.$queryRawUnsafe<any[]>(`SELECT id, nome FROM cooperativas`);
  c.forEach(x => console.log(`  ${x.id} | ${x.nome}`));

  await prisma.$disconnect();
}
main().catch(e => { console.error(e); process.exit(1); });
