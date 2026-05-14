import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const total = await prisma.auditLog.count();
  console.log(`AuditLog total entries: ${total}`);

  const recentes = await prisma.auditLog.findMany({
    orderBy: { createdAt: 'desc' },
    take: 10,
    select: {
      id: true,
      acao: true,
      recurso: true,
      recursoId: true,
      usuarioId: true,
      usuarioPerfil: true,
      cooperativaId: true,
      createdAt: true,
    },
  });

  console.log('\nÚltimas 10 entradas:');
  console.table(recentes);
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
