import { PrismaClient } from '@prisma/client';
const p = new PrismaClient();

// Ver campos disponíveis no model Usuario
const sample = await p.usuario.findFirst();
console.log('Campos do Usuario:', sample ? Object.keys(sample) : 'nenhum registro');

// Tentar criar sem senha (auth via Supabase)
try {
  const user = await p.usuario.create({
    data: {
      email: 'superadmin@cooperebr.com.br',
      nome: 'Super Admin',
      perfil: 'SUPER_ADMIN',
    }
  });
  console.log(`✅ SUPER_ADMIN criado: ${user.email} | id: ${user.id}`);
} catch(e) {
  console.error('Erro ao criar:', e.message?.split('\n')[0]);
}

await p.$disconnect();
