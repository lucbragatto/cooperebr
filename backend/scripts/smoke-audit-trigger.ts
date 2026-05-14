import { PrismaClient } from '@prisma/client';
import * as jwt from 'jsonwebtoken';

const prisma = new PrismaClient();

async function main() {
  const admin = await prisma.usuario.findFirst({
    where: { perfil: 'ADMIN', cooperativaId: { not: null } },
    select: { id: true, perfil: true, cooperativaId: true, email: true },
  });

  if (!admin) {
    console.error('Nenhum admin encontrado.');
    process.exit(1);
  }

  const cooperativaId = admin.cooperativaId;
  console.log(`Admin: ${admin.email} (cooperativaId=${cooperativaId})`);

  const cooperado = await prisma.cooperado.findFirst({
    where: { cooperativaId: cooperativaId as string, ambienteTeste: true },
    select: { id: true, nomeCompleto: true, telefone: true },
  });

  if (!cooperado) {
    console.error('Nenhum cooperado de teste encontrado.');
    process.exit(1);
  }

  const secret = process.env.JWT_SECRET;
  if (!secret) {
    console.error('JWT_SECRET nao configurado.');
    process.exit(1);
  }

  const token = jwt.sign(
    {
      sub: admin.id,
      userId: admin.id,
      id: admin.id,
      email: admin.email,
      perfil: admin.perfil,
      cooperativaId,
    },
    secret,
    { expiresIn: '5m' },
  );

  console.log(`\nDisparando PUT /cooperados/${cooperado.id} com payload trivial...`);
  const res = await fetch(`http://localhost:3000/cooperados/${cooperado.id}`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ telefone: cooperado.telefone ?? '5527999999999' }),
  });
  console.log(`HTTP ${res.status}`);

  await new Promise((r) => setTimeout(r, 500));

  const total = await prisma.auditLog.count();
  const ultima = await prisma.auditLog.findFirst({ orderBy: { createdAt: 'desc' } });
  console.log(`\nAuditLog total: ${total}`);
  if (ultima) console.log('Última entrada:', JSON.stringify(ultima, null, 2));
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
