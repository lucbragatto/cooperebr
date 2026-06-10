import { PrismaClient } from '@prisma/client';
const p = new PrismaClient();
(async () => {
  const cols = await p.$queryRawUnsafe<any[]>(
    `SELECT column_name, data_type, column_default
     FROM information_schema.columns
     WHERE table_name='config_cooper_token'
     ORDER BY ordinal_position`,
  );
  console.log(`[audit-post] colunas: ${cols.length}`);
  for (const c of cols) {
    console.log(`  ${c.column_name.padEnd(28)} | ${c.data_type.padEnd(20)} | default=${c.column_default ?? '-'}`);
  }
  await p.$disconnect();
})();
