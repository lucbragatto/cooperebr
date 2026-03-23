import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();
const admin = await prisma.usuario.findFirst({ where: { perfil: 'ADMIN' }, select: { email: true, id: true } });
console.log('Admin:', JSON.stringify(admin));
await prisma.$disconnect();
