import { PrismaClient } from '@prisma/client';
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://jsudavbqbirkirkendws.supabase.co';
const SUPABASE_SERVICE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImpzdWRhdmJxYmlya2lya2VuZHdzIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MzA2MDc5OSwiZXhwIjoyMDg4NjM2Nzk5fQ.AUJGR9VneMSFoioNFXQbeO1cBh0UAJbEPLxxqw-HGzE';

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false }
});

const prisma = new PrismaClient();

// Buscar email do usuário Luciano Bragatto
const usuario = await prisma.usuario.findFirst({
  where: { nome: { contains: 'Bragatto' } }
});

if (!usuario) {
  console.log('Usuário não encontrado!');
  process.exit(1);
}

console.log('Usuário encontrado:', usuario.nome, '|', usuario.email);

// Resetar senha via Supabase Admin API
const { data, error } = await supabase.auth.admin.listUsers();
if (error) { console.error('Erro ao listar:', error); process.exit(1); }

const supaUser = data.users.find(u => u.email === usuario.email);
if (!supaUser) {
  console.log('Usuário não encontrado no Supabase. Email:', usuario.email);
  process.exit(1);
}

console.log('Supabase user ID:', supaUser.id);

const { error: updateError } = await supabase.auth.admin.updateUserById(supaUser.id, {
  password: '123456'
});

if (updateError) {
  console.error('Erro ao resetar senha:', updateError);
} else {
  console.log('Senha resetada com sucesso! Nova senha: 123456');
}

await prisma.$disconnect();
