/**
 * Sprint Portal Empresa 9.0 (04/06/2026) — Seed do usuário de teste do
 * portal da empresa conveniada (CV-2026-0001 = Clínica teste).
 *
 * REGRA INEGOCIÁVEL (14/05): em dev, contato é lucbragatto@gmail.com.
 * O Cooperado PJ pagador do CV-2026-0001 já tem email cadastrado — buscamos
 * dinâmicamente e criamos o Usuario com o MESMO email pra match em
 * obterContextosUsuario (branch empresa_conveniada).
 *
 * Idempotente: rerunnable sem duplicar.
 *
 * D-novo-PORTAL-EMPRESA-SEED-TESTE (P3): remover este seed + box de credenciais
 * na tela de login antes de produção. Risco baixo (só dev, !isAmbienteReal()).
 */
import { PrismaClient } from '@prisma/client';
import { createClient } from '@supabase/supabase-js';

const prisma = new PrismaClient();

const EMAIL_TESTE_PADRAO = 'lucbragatto+empresa-teste@gmail.com';
const SENHA_TESTE = 'Teste@123';

async function main() {
  console.log('[seed-portal-empresa] Iniciando seed do usuário de teste...');

  // 1. Localiza convênio Caso 1 (pagador EMPRESA) com pagadorCooperadoId
  const conv = await prisma.contratoConvenio.findFirst({
    where: { pagador: 'EMPRESA', pagadorCooperadoId: { not: null }, status: 'ATIVO' },
    select: {
      id: true,
      numero: true,
      empresaNome: true,
      pagadorCooperadoId: true,
      cooperativaId: true,
    },
    orderBy: { createdAt: 'asc' },
  });
  if (!conv) {
    console.error('[seed-portal-empresa] Nenhum convênio EMPRESA ATIVO encontrado. Crie um primeiro.');
    return;
  }
  console.log(`[seed-portal-empresa] Convênio alvo: ${conv.numero} — ${conv.empresaNome}`);

  // 2. Cooperado pagador
  const cooperado = await prisma.cooperado.findUnique({
    where: { id: conv.pagadorCooperadoId! },
    select: { id: true, nomeCompleto: true, email: true, cooperativaId: true },
  });
  if (!cooperado) {
    console.error('[seed-portal-empresa] Cooperado pagador inexistente.');
    return;
  }
  console.log(`[seed-portal-empresa] Cooperado pagador: ${cooperado.nomeCompleto} (${cooperado.email})`);

  // 3. Decide email do usuário: usa o do Cooperado se já for alias lucbragatto+*
  //    Caso contrário (legado/dado real), reseta pro padrão lucbragatto+empresa-teste@gmail.com
  //    e ATUALIZA o email do Cooperado pra match (consistência regra 14/05).
  const isAliasLuciano = cooperado.email?.startsWith('lucbragatto+');
  const emailUsuario = isAliasLuciano ? cooperado.email! : EMAIL_TESTE_PADRAO;

  if (!isAliasLuciano) {
    console.log(`[seed-portal-empresa] Atualizando email do Cooperado pagador: ${cooperado.email} → ${emailUsuario}`);
    await prisma.cooperado.update({
      where: { id: cooperado.id },
      data: { email: emailUsuario },
    });
  }

  // 4. Cria Usuario EMPRESA_CONVENIADA (idempotente)
  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY;
  if (!supabaseUrl || !supabaseServiceKey) {
    console.error('[seed-portal-empresa] SUPABASE_URL/SERVICE_KEY ausentes no .env');
    return;
  }
  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  const usuarioExistente = await prisma.usuario.findUnique({
    where: { email: emailUsuario },
    select: { id: true, perfil: true, supabaseId: true },
  });

  if (usuarioExistente) {
    if (usuarioExistente.perfil !== 'EMPRESA_CONVENIADA') {
      console.log(`[seed-portal-empresa] Promovendo Usuario existente (${usuarioExistente.id}) pro perfil EMPRESA_CONVENIADA`);
      await prisma.usuario.update({
        where: { id: usuarioExistente.id },
        data: { perfil: 'EMPRESA_CONVENIADA' as any, ativo: true },
      });
    } else {
      console.log(`[seed-portal-empresa] Usuario já existe (${usuarioExistente.id}) com perfil EMPRESA_CONVENIADA.`);
    }
    // Reset de senha pra valor conhecido (idempotência)
    if (usuarioExistente.supabaseId) {
      await supabase.auth.admin.updateUserById(usuarioExistente.supabaseId, {
        password: SENHA_TESTE,
        email_confirm: true,
      });
      console.log('[seed-portal-empresa] Senha resetada pro valor de teste.');
    }
  } else {
    console.log('[seed-portal-empresa] Criando Usuario novo no Supabase + Postgres...');
    const { data: sb, error } = await supabase.auth.admin.createUser({
      email: emailUsuario,
      password: SENHA_TESTE,
      email_confirm: true,
    });
    if (error || !sb.user) {
      console.error(`[seed-portal-empresa] Erro Supabase: ${error?.message}`);
      return;
    }
    await prisma.usuario.create({
      data: {
        nome: cooperado.nomeCompleto,
        email: emailUsuario,
        supabaseId: sb.user.id,
        perfil: 'EMPRESA_CONVENIADA' as any,
        cooperativaId: cooperado.cooperativaId,
        ativo: true,
      },
    });
    console.log('[seed-portal-empresa] Usuario criado.');
  }

  console.log('');
  console.log('═══ CREDENCIAIS DE TESTE — PORTAL DA EMPRESA ═══');
  console.log(`  Email: ${emailUsuario}`);
  console.log(`  Senha: ${SENHA_TESTE}`);
  console.log(`  Convênio: ${conv.numero} — ${conv.empresaNome}`);
  console.log('  Rota: /conveniada');
  console.log('════════════════════════════════════════════════════');
}

main()
  .catch((err) => {
    console.error('[seed-portal-empresa] FALHOU:', err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
