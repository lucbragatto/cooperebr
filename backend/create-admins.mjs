const BASE = 'http://localhost:3000';

const admins = [
  { nome: 'Admin Consórcio Sul', email: 'admin@consorciossul.com.br', senha: 'ConsorSul@2026', cooperativaId: 'cmn2yvexr0000uog4li8lsm1q' },
  { nome: 'Admin CoopereVerde', email: 'admin@coopereverde.com.br', senha: 'CoopereVerde@2026', cooperativaId: 'cmn2yvf5o0001uog4kxy23u2g' },
];

import { PrismaClient } from '@prisma/client';
const p = new PrismaClient();

for (const admin of admins) {
  console.log(`\nCriando ${admin.email}...`);
  
  // Verificar se já existe no banco
  const existing = await p.usuario.findFirst({ where: { email: admin.email } });
  if (existing) {
    console.log(`  Já existe no banco (id: ${existing.id}), garantindo cooperativaId e perfil...`);
    await p.usuario.update({
      where: { id: existing.id },
      data: { cooperativaId: admin.cooperativaId, perfil: 'ADMIN' }
    });
    console.log(`  ✅ Atualizado`);
    continue;
  }

  // Registrar via API (cria no Supabase)
  const res = await fetch(`${BASE}/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ nome: admin.nome, email: admin.email, senha: admin.senha })
  });

  if (res.ok || res.status === 201) {
    // Atualizar cooperativaId e perfil
    const user = await p.usuario.findFirst({ where: { email: admin.email } });
    if (user) {
      await p.usuario.update({
        where: { id: user.id },
        data: { cooperativaId: admin.cooperativaId, perfil: 'ADMIN' }
      });
      console.log(`  ✅ Criado e vinculado`);
    }
  } else {
    const err = await res.json();
    console.log(`  ❌ Erro: ${JSON.stringify(err)}`);
  }
}

// Verificar admin@cooperebr.com.br
const adminCoop = await p.usuario.findFirst({ where: { email: 'admin@cooperebr.com.br' } });
if (adminCoop) {
  await p.usuario.update({
    where: { id: adminCoop.id },
    data: { cooperativaId: 'cmn0ho8bx0000uox8wu96u6fd', perfil: 'ADMIN' }
  });
  console.log('\n✅ admin@cooperebr.com.br vinculado à CoopereBR');
}

// Resumo final
console.log('\n=== RESUMO ===');
const todos = await p.usuario.findMany({ select: { email: true, perfil: true, cooperativaId: true } });
todos.forEach(u => console.log(` ${u.email} | ${u.perfil} | ${u.cooperativaId}`));

await p.$disconnect();
