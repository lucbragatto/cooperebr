require('dotenv').config();
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
(async () => {
  const r = await prisma.$queryRawUnsafe(`
    SELECT c.id as contrato_id, c.numero, c.status, c."percentualUsina",
           co.id as cooperado_id, co."nomeCompleto", co.telefone, co.email,
           u.id as usina_id, u.nome as usina_nome, u."apelidoInterno",
           coop.nome as cooperativa_nome
    FROM contratos c
    JOIN cooperados co ON co.id = c."cooperadoId"
    LEFT JOIN usinas u ON u.id = c."usinaId"
    JOIN cooperativas coop ON coop.id = c."cooperativaId"
    WHERE c.status = 'PENDENTE_ATIVACAO'
    ORDER BY c."createdAt" DESC
    LIMIT 10
  `);
  console.log(`Total PENDENTE_ATIVACAO: ${r.length}`);
  console.log(JSON.stringify(r, null, 2));
  await prisma.$disconnect();
})();
