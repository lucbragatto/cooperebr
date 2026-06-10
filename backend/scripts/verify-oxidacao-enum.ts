import { PrismaClient } from '@prisma/client';
const p = new PrismaClient();
(async () => {
  const r = await p.$queryRawUnsafe<any[]>(
    `SELECT e.enumlabel FROM pg_enum e
     JOIN pg_type t ON e.enumtypid = t.oid
     WHERE t.typname = 'CooperTokenOperacao'
     ORDER BY e.enumsortorder`,
  );
  console.log('[enum] valores em CooperTokenOperacao:');
  for (const row of r) console.log(`  - ${row.enumlabel}`);
  await p.$disconnect();
})();
