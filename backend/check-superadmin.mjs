import { PrismaClient } from '@prisma/client';
const p = new PrismaClient();

const u = await p.usuario.findFirst({ where: { email: 'superadmin@cooperebr.com.br' } });
console.log(u ? `✅ Existe: ${u.email} | perfil: ${u.perfil}` : '❌ NÃO ENCONTRADO');

// Listar todos os usuários
const todos = await p.usuario.findMany({ select: { email: true, perfil: true } });
console.log('\nTodos os usuários:');
todos.forEach(x => console.log(` - ${x.email} | ${x.perfil}`));

await p.$disconnect();
