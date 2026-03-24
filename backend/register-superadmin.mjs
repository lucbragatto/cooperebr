// Registra via API (cria no Supabase + banco)
const res = await fetch('http://localhost:3000/auth/register', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    nome: 'Super Admin',
    email: 'superadmin@cooperebr.com.br',
    senha: 'SuperAdmin@2026'
  })
});

const data = await res.json();
console.log('Status:', res.status);
console.log('Resposta:', JSON.stringify(data, null, 2));

// Se criou com sucesso, promove para SUPER_ADMIN
if (res.ok || res.status === 201) {
  const { PrismaClient } = await import('@prisma/client');
  const p = new PrismaClient();
  await p.usuario.update({
    where: { email: 'superadmin@cooperebr.com.br' },
    data: { perfil: 'SUPER_ADMIN', cooperativaId: null }
  });
  console.log('✅ Perfil atualizado para SUPER_ADMIN');
  await p.$disconnect();
}
