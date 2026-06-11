/**
 * Audit pós-delta F2 Bloco 1 — confirma 3 colunas novas em cooper_token_compras
 * + COMPRA_PJ_COOPERADA no enum CooperTokenTipo.
 */
import { PrismaClient } from '@prisma/client';
const p = new PrismaClient();
(async () => {
  const cols = await p.$queryRawUnsafe<any[]>(
    `SELECT column_name, data_type, column_default, is_nullable
     FROM information_schema.columns
     WHERE table_name='cooper_token_compras'
     ORDER BY ordinal_position`,
  );
  console.log(`[audit-post] cooper_token_compras: ${cols.length} colunas`);
  for (const c of cols) {
    console.log(`  ${c.column_name.padEnd(24)} | ${c.data_type.padEnd(15)} | null=${c.is_nullable} | default=${c.column_default ?? '-'}`);
  }

  const enumValues = await p.$queryRawUnsafe<any[]>(
    `SELECT e.enumlabel FROM pg_enum e
     JOIN pg_type t ON e.enumtypid = t.oid
     WHERE t.typname = 'CooperTokenTipo'
     ORDER BY e.enumsortorder`,
  );
  console.log(`\n[audit-post] enum CooperTokenTipo: ${enumValues.length} valores`);
  for (const r of enumValues) console.log(`  - ${r.enumlabel}`);

  const total = await p.cooperTokenCompra.count();
  console.log(`\n[audit-post] total CooperTokenCompra rows: ${total}`);

  await p.$disconnect();
})();
