require('dotenv').config();
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
(async () => {
  const r = await prisma.$queryRawUnsafe(
    `SELECT column_name, data_type, is_nullable FROM information_schema.columns
     WHERE table_name='contratos' AND (column_name ILIKE '%ativacao%' OR column_name='status')
     ORDER BY column_name`
  );
  console.log(JSON.stringify(r, null, 2));
  await prisma.$disconnect();
})();
