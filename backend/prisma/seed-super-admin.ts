/**
 * Seed: cria o SUPER_ADMIN inicial
 * Uso: npx ts-node prisma/seed-super-admin.ts
 *
 * Requer as variáveis de ambiente: DATABASE_URL, SUPABASE_URL, SUPABASE_SERVICE_KEY
 */

import { PrismaClient } from '@prisma/client';
import { createClient } from '@supabase/supabase-js';

const prisma = new PrismaClient();

async function main() {
  const email = 'superadmin@cooperebr.com.br';
  const senha = 'SuperAdmin@2026';
  const nome = 'Super Admin';

  // Verificar se já existe
  const existente = await prisma.usuario.findUnique({ where: { email } });
  if (existente) {
    console.log(`SUPER_ADMIN já existe: ${email} (id: ${existente.id})`);
    return;
  }

  // Criar no Supabase
  const supabase = createClient(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_KEY!,
  );

  const { data: supabaseData, error } = await supabase.auth.admin.createUser({
    email,
    password: senha,
    email_confirm: true,
  });

  if (error) {
    // Se já existe no Supabase, tentar buscar
    console.log('Supabase:', error.message);
    const { data: signIn } = await supabase.auth.signInWithPassword({ email, password: senha });
    if (!signIn?.user) {
      throw new Error(`Não foi possível criar/localizar usuário no Supabase: ${error.message}`);
    }

    const usuario = await prisma.usuario.create({
      data: {
        nome,
        email,
        supabaseId: signIn.user.id,
        perfil: 'SUPER_ADMIN',
      },
    });
    console.log(`SUPER_ADMIN criado: ${email} (id: ${usuario.id})`);
    return;
  }

  if (!supabaseData.user) throw new Error('Falha ao criar usuário no Supabase');

  const usuario = await prisma.usuario.create({
    data: {
      nome,
      email,
      supabaseId: supabaseData.user.id,
      perfil: 'SUPER_ADMIN',
    },
  });

  console.log(`SUPER_ADMIN criado com sucesso!`);
  console.log(`  Email: ${email}`);
  console.log(`  Senha: ${senha}`);
  console.log(`  ID: ${usuario.id}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
