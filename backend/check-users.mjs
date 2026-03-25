import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();
const usuarios = await prisma.usuario.findMany({ select: { id: true, email: true, perfil: true, cooperativaId: true }, take: 10 });
const cooperados = await prisma.cooperado.findMany({ select: { id: true, nomeCompleto: true, email: true, telefone: true, status: true, codigoIndicacao: true }, take: 10 });
console.log('USUARIOS:', JSON.stringify(usuarios, null, 2));
console.log('COOPERADOS:', JSON.stringify(cooperados, null, 2));
await prisma.$disconnect();
