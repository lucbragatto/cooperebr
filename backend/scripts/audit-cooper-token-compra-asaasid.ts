import { PrismaClient } from '@prisma/client';
const p = new PrismaClient();
(async () => {
  const total = await p.cooperTokenCompra.count();
  const totalAsaasId = await p.cooperTokenCompra.count({ where: { asaasId: { not: null } } });
  const dupes = await p.$queryRawUnsafe<any[]>(
    `SELECT "asaasId", COUNT(*) c FROM cooper_token_compras WHERE "asaasId" IS NOT NULL GROUP BY "asaasId" HAVING COUNT(*) > 1`,
  );
  console.log(`[audit-asaasid] total rows: ${total}`);
  console.log(`[audit-asaasid] rows com asaasId nao-null: ${totalAsaasId}`);
  console.log(`[audit-asaasid] duplicatas de asaasId: ${dupes.length}`);
  await p.$disconnect();
})();
