import { PrismaClient } from '@prisma/client';
import { createHash } from 'crypto';

// bcrypt hash de 'Admin@123'
// Como não temos bcrypt aqui, vamos gerar via Prisma direto
const prisma = new PrismaClient();

// Ver senha atual (hash)
const admin = await prisma.usuario.findFirst({ 
  where: { perfil: 'ADMIN' }, 
  select: { email: true, password: true, id: true } 
});
console.log('Admin email:', admin?.email);
console.log('Password hash (primeiros 20):', admin?.password?.substring(0, 20));

await prisma.$disconnect();
