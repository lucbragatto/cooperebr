import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();
async function main() {
  const t = await prisma.$queryRawUnsafe<any[]>(`SELECT tablename FROM pg_tables WHERE schemaname='public' ORDER BY tablename`);
  console.log('TABELAS PUBLIC:');
  t.forEach(r => console.log(' ', r.tablename));
  const audit = t.filter((r: any) => r.tablename.toLowerCase().includes('audit'));
  console.log('AUDIT match:', audit);
  const tenant = t.filter((r: any) => r.tablename.toLowerCase().includes('config') || r.tablename.toLowerCase().includes('tenant'));
  console.log('CONFIG/TENANT match:', tenant);
  await prisma.$disconnect();
}
main();
