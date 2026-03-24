import { PrismaClient } from '@prisma/client';
const p = new PrismaClient();

// Usuários e suas cooperativas
const users = await p.usuario.findMany({ select: { email: true, perfil: true, cooperativaId: true, nome: true } });
console.log('=== USUÁRIOS ===');
users.forEach(u => console.log(` ${u.email} | ${u.perfil} | cooperativaId: ${u.cooperativaId}`));

// Cooperativas
const coops = await p.cooperativa.findMany({ select: { id: true, nome: true, tipoParceiro: true } });
console.log('\n=== COOPERATIVAS ===');
coops.forEach(c => console.log(` ${c.id} | ${c.nome} | tipo: ${c.tipoParceiro}`));

// Cooperados por cooperativa
console.log('\n=== COOPERADOS POR COOPERATIVA ===');
for (const c of coops) {
  const count = await p.cooperado.count({ where: { cooperativaId: c.id } });
  const semCoop = await p.cooperado.count({ where: { cooperativaId: null } });
  console.log(` ${c.nome}: ${count} cooperados`);
  if (c === coops[coops.length-1]) console.log(` SEM cooperativaId (null): ${semCoop}`);
}

const total = await p.cooperado.count();
console.log(`\n Total cooperados no banco: ${total}`);

await p.$disconnect();
