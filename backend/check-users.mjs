import { PrismaClient } from '@prisma/client';
const p = new PrismaClient();
const users = await p.usuario.findMany({ select: { email: true, perfil: true, cooperativaId: true } });
console.log(JSON.stringify(users, null, 2));
await p.$disconnect();
