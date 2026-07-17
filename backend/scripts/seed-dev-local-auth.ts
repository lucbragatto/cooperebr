/**
 * Seed mínimo para login local sem Supabase.
 * Uso: npx ts-node -r dotenv/config --project tsconfig.seed.json scripts/seed-dev-local-auth.ts
 */
import { PrismaClient, PerfilUsuario } from '@prisma/client';

const prisma = new PrismaClient();

const COOP_CNPJ = '00000000000191';
const SENHA_INFO = 'Teste@123';

async function main() {
  console.log('[seed-dev-local-auth] Criando tenant + usuários de teste...');

  const cooperativa = await prisma.cooperativa.upsert({
    where: { cnpj: COOP_CNPJ },
    update: { nome: 'CoopereBR Teste', statusSaas: 'TRIAL' },
    create: {
      nome: 'CoopereBR Teste',
      cnpj: COOP_CNPJ,
      statusSaas: 'TRIAL',
    },
  });
  console.log(`[OK] Cooperativa: ${cooperativa.nome} (${cooperativa.id})`);

  const usuarios: Array<{
    email: string;
    nome: string;
    perfil: PerfilUsuario;
    cooperativaId: string | null;
  }> = [
    {
      email: 'superadmin@cooperebr.com.br',
      nome: 'Super Admin',
      perfil: PerfilUsuario.SUPER_ADMIN,
      cooperativaId: null,
    },
    {
      email: 'admin@cooperebr.com.br',
      nome: 'Administrador CoopereBR',
      perfil: PerfilUsuario.ADMIN,
      cooperativaId: cooperativa.id,
    },
    {
      email: 'teste@cooperebr.com',
      nome: 'Cooperado Teste',
      perfil: PerfilUsuario.COOPERADO,
      cooperativaId: null,
    },
  ];

  for (const u of usuarios) {
    const row = await prisma.usuario.upsert({
      where: { email: u.email },
      update: { nome: u.nome, perfil: u.perfil, cooperativaId: u.cooperativaId, ativo: true },
      create: {
        nome: u.nome,
        email: u.email,
        perfil: u.perfil,
        cooperativaId: u.cooperativaId,
        ativo: true,
      },
    });
    console.log(`[OK] Usuario: ${row.email} (${row.perfil})`);
  }

  const cooperado = await prisma.cooperado.upsert({
    where: { email: 'teste@cooperebr.com' },
    update: {
      nomeCompleto: 'Luciano Teste',
      status: 'ATIVO',
      cooperativaId: cooperativa.id,
    },
    create: {
      nomeCompleto: 'Luciano Teste',
      cpf: '12345678901',
      email: 'teste@cooperebr.com',
      telefone: '27981341348',
      status: 'ATIVO',
      cooperativaId: cooperativa.id,
      termoAdesaoAceito: true,
      termoAdesaoAceitoEm: new Date(),
    },
  });
  console.log(`[OK] Cooperado: ${cooperado.nomeCompleto} (${cooperado.email})`);

  console.log('');
  console.log('Login local (sem Supabase):');
  console.log(`  Senha para todos: ${SENHA_INFO}`);
  console.log('  superadmin@cooperebr.com.br  → SUPER_ADMIN');
  console.log('  admin@cooperebr.com.br      → ADMIN');
  console.log('  teste@cooperebr.com         → COOPERADO');
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
