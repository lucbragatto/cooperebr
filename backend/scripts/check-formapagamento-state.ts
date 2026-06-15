import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();
async function main() {
  const rows = await prisma.$queryRawUnsafe<Array<{ forma: string | null; count: bigint }>>(
    `SELECT "formaPagamentoDono" AS forma, COUNT(*)::int AS count FROM usinas GROUP BY 1 ORDER BY 1`,
  );
  console.table(rows.map(r => ({ forma: r.forma ?? '(null)', count: Number(r.count) })));
}
main().catch(e => { console.error(e); process.exit(1); }).finally(() => prisma.$disconnect());
