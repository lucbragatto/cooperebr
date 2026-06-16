/**
 * Seed SISGD Teste Interno (17/06/2026) — Sprint "Abrir Cadastros — Teste SISGD".
 *
 * Cria/atualiza (idempotente):
 *  - Cooperado PJ INSTITUCIONAL com email RFC 2606 (institucional+sisgd@sisgd.invalid,
 *    domain reservado, nunca roteavel). ambienteTeste=true. NUNCA DELETAR
 *    (salvaguarda CLAUDE.md "Cooperados institucionais").
 *  - Usuario Supabase logavel: lucbragatto+sisgd@gmail.com / SISGD@2026.
 *  - ContratoConvenio CV-SISGD-INTERNO (tipo=EMPRESA, pagador=EMPRESA,
 *    pagadorCooperadoId = Cooperado PJ acima, statusAprovacao=APROVADO).
 *
 * Re-executar nao duplica — usa findUnique/findFirst + update.
 *
 * Pos-execucao:
 *  - /dashboard/convenios mostra "SISGD — Teste Interno" (status ATIVO).
 *  - /dashboard/dev/credenciais-teste mostra o login do Usuario (impersonate).
 *  - Login direto funciona: lucbragatto+sisgd@gmail.com / SISGD@2026.
 *  - Convenio pronto pra receber convites OTP da turma de teste interno
 *    do SISGD validar onboarding ponta a ponta antes da Santi/Triad.
 *
 * Uso: cd backend ; npx ts-node scripts/seed-sisgd-teste-interno.ts
 */
import { Prisma, PrismaClient } from '@prisma/client';
import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import * as path from 'node:path';

dotenv.config({ path: path.resolve(__dirname, '..', '.env') });

const COOPEREBR_ID = 'cmn0ho8bx0000uox8wu96u6fd';

// Identidade institucional — registro de sistema, NUNCA DELETAR.
// CLAUDE.md "Cooperados institucionais — SALVAGUARDA".
const SISGD = {
  nomeFantasia: 'SISGD — Teste Interno',
  razaoSocial: 'SISGDSOLAR — Teste Interno (Institucional)',
  // CNPJ placeholder unico (ambiente teste). NUNCA usar como real.
  cnpjMascarado: '99.999.999/0001-99',
  cnpjLimpo: '99999999000199',
  // Email institucional RFC 2606 — domain reservado, nunca roteavel.
  emailInstitucional: 'institucional+sisgd@sisgd.invalid',
  // Email do Usuario logavel — alias Gmail +suffix do Luciano (whitelist 14/05).
  emailUsuario: 'lucbragatto+sisgd@gmail.com',
  // Telefone whitelist Luciano (14/05).
  telefone: '5527981341348',
  senha: 'SISGD@2026',
  endereco: {
    cep: '29050-902',
    logradouro: 'Av. Americo Buaiz',
    numero: '200',
    bairro: 'Enseada do Sua',
    cidade: 'Vitoria',
    estado: 'ES',
  },
};

const NUMERO_CV = 'CV-SISGD-INTERNO';

function exigirEnv(nome: string): string {
  const v = process.env[nome];
  if (!v) {
    console.error(`[seed-sisgd] FALTA env ${nome} no backend/.env`);
    process.exit(1);
  }
  return v;
}

async function main(): Promise<void> {
  const prisma = new PrismaClient();
  const supabase = createClient(
    exigirEnv('SUPABASE_URL'),
    exigirEnv('SUPABASE_SERVICE_KEY'),
  );

  console.log('═══════════════════════════════════════════════════════════════════');
  console.log('🧪 Seed SISGD — Teste Interno (convenio para turma de teste do SISGD)');
  console.log('═══════════════════════════════════════════════════════════════════\n');

  // ──────────────────────────────────────────────────────────────
  // 1) Cooperado PJ Institucional SISGD
  // ──────────────────────────────────────────────────────────────
  console.log('── Etapa 1: Cooperado PJ Institucional SISGD ──');
  let cooperado = await prisma.cooperado.findFirst({
    where: {
      OR: [{ cpf: SISGD.cnpjLimpo }, { email: SISGD.emailInstitucional }],
    },
  });

  const dadosCooperado = {
    nomeCompleto: SISGD.nomeFantasia,
    razaoSocial: SISGD.razaoSocial,
    cpf: SISGD.cnpjLimpo,
    email: SISGD.emailInstitucional,
    telefone: SISGD.telefone,
    tipoPessoa: 'PJ',
    tipoCooperado: 'SEM_UC' as const,
    status: 'ATIVO' as const,
    cooperativaId: COOPEREBR_ID,
    ambienteTeste: true,
    cep: SISGD.endereco.cep,
    logradouro: SISGD.endereco.logradouro,
    numero: SISGD.endereco.numero,
    bairro: SISGD.endereco.bairro,
    cidade: SISGD.endereco.cidade,
    estado: SISGD.endereco.estado,
  };

  if (cooperado) {
    cooperado = await prisma.cooperado.update({
      where: { id: cooperado.id },
      data: dadosCooperado,
    });
    console.log(`  🔄 ATUALIZADO Cooperado PJ id=${cooperado.id}`);
  } else {
    cooperado = await prisma.cooperado.create({ data: dadosCooperado });
    console.log(`  ✅ CRIADO Cooperado PJ id=${cooperado.id}`);
  }
  console.log(`     nomeCompleto: ${cooperado.nomeCompleto}`);
  console.log(`     razaoSocial: ${cooperado.razaoSocial}`);
  console.log(`     cpf(CNPJ): ${cooperado.cpf}  (placeholder ambiente teste)`);
  console.log(`     email: ${cooperado.email}  (RFC 2606 — NUNCA DELETAR)`);
  console.log(`     tipoPessoa: ${cooperado.tipoPessoa}  tipoCooperado: ${cooperado.tipoCooperado}`);
  console.log(`     status: ${cooperado.status}  ambienteTeste: ${cooperado.ambienteTeste}`);

  // ──────────────────────────────────────────────────────────────
  // 2) Usuario Supabase + Postgres (login logavel)
  // ──────────────────────────────────────────────────────────────
  console.log('\n── Etapa 2: Usuario logavel (Supabase + Postgres) ──');
  let usuario = await prisma.usuario.findUnique({ where: { email: SISGD.emailUsuario } });

  if (usuario) {
    if (usuario.supabaseId) {
      const { error } = await supabase.auth.admin.updateUserById(usuario.supabaseId, {
        password: SISGD.senha,
        email_confirm: true,
      });
      if (error) {
        console.error(`  ⚠️ Erro Supabase updateUser: ${error.message}`);
      } else {
        console.log(`  🔄 SENHA resetada no Supabase pra "${SISGD.senha}"`);
      }
    }
    usuario = await prisma.usuario.update({
      where: { id: usuario.id },
      data: {
        nome: SISGD.nomeFantasia,
        perfil: 'COOPERADO',
        cooperativaId: COOPEREBR_ID,
        ativo: true,
      },
    });
    console.log(`  🔄 ATUALIZADO Usuario id=${usuario.id} perfil=${usuario.perfil}`);
  } else {
    console.log('  🆕 Criando Usuario novo no Supabase + Postgres...');
    const { data: sb, error } = await supabase.auth.admin.createUser({
      email: SISGD.emailUsuario,
      password: SISGD.senha,
      email_confirm: true,
    });
    if (error || !sb.user) {
      console.error(`  ❌ Erro Supabase createUser: ${error?.message}`);
      process.exit(1);
    }
    usuario = await prisma.usuario.create({
      data: {
        nome: SISGD.nomeFantasia,
        email: SISGD.emailUsuario,
        supabaseId: sb.user.id,
        perfil: 'COOPERADO',
        cooperativaId: COOPEREBR_ID,
        ativo: true,
      },
    });
    console.log(`  ✅ CRIADO Usuario id=${usuario.id}  supabaseId=${sb.user.id}`);
  }

  // ──────────────────────────────────────────────────────────────
  // 3) ContratoConvenio CV-SISGD-INTERNO
  // ──────────────────────────────────────────────────────────────
  console.log('\n── Etapa 3: ContratoConvenio CV-SISGD-INTERNO ──');
  const dadosConv: Prisma.ContratoConvenioUncheckedCreateInput = {
    numero: NUMERO_CV,
    empresaNome: SISGD.nomeFantasia,
    empresaCnpj: SISGD.cnpjMascarado,
    empresaEmail: SISGD.emailUsuario,
    empresaTelefone: SISGD.telefone,
    status: 'ATIVO',
    cooperativaId: COOPEREBR_ID,
    tipo: 'EMPRESA',
    tipoBeneficioConveniado: 'DESCONTO',
    percentualBeneficioToken: new Prisma.Decimal('0'),
    tipoDesconto: 'PERCENTUAL',
    pagador: 'EMPRESA',
    pagadorCooperadoId: cooperado.id,
    tipoTarifaEmpresa: 'PERCENTUAL_DESCONTO',
    statusAprovacao: 'APROVADO',
    modalidade: 'STANDALONE',
    registrarComoIndicacao: false,
    geraLancamentoContabil: false,
  };

  let convenio = await prisma.contratoConvenio.findUnique({ where: { numero: NUMERO_CV } });
  if (convenio) {
    convenio = await prisma.contratoConvenio.update({
      where: { id: convenio.id },
      data: {
        empresaNome: dadosConv.empresaNome,
        empresaCnpj: dadosConv.empresaCnpj,
        empresaEmail: dadosConv.empresaEmail,
        empresaTelefone: dadosConv.empresaTelefone,
        status: dadosConv.status,
        cooperativaId: dadosConv.cooperativaId,
        tipo: dadosConv.tipo,
        tipoBeneficioConveniado: dadosConv.tipoBeneficioConveniado,
        percentualBeneficioToken: dadosConv.percentualBeneficioToken,
        pagador: dadosConv.pagador,
        pagadorCooperadoId: dadosConv.pagadorCooperadoId,
        tipoTarifaEmpresa: dadosConv.tipoTarifaEmpresa,
        statusAprovacao: dadosConv.statusAprovacao,
        modalidade: dadosConv.modalidade,
      },
    });
    console.log(`  🔄 ATUALIZADO ContratoConvenio id=${convenio.id}`);
  } else {
    convenio = await prisma.contratoConvenio.create({ data: dadosConv });
    console.log(`  ✅ CRIADO ContratoConvenio id=${convenio.id}`);
  }
  console.log(`     numero: ${convenio.numero}`);
  console.log(`     empresaNome: ${convenio.empresaNome}`);
  console.log(`     empresaCnpj: ${convenio.empresaCnpj}`);
  console.log(`     tipoBeneficioConveniado: ${convenio.tipoBeneficioConveniado}`);
  console.log(`     pagador: ${convenio.pagador}  pagadorCooperadoId: ${convenio.pagadorCooperadoId}`);
  console.log(`     status: ${convenio.status}  statusAprovacao: ${convenio.statusAprovacao}`);

  // ──────────────────────────────────────────────────────────────
  // 4) Tabela de credenciais
  // ──────────────────────────────────────────────────────────────
  console.log('\n═══ CREDENCIAIS DE TESTE — SISGD TESTE INTERNO ═══');
  console.log('┌──────────────────────────────────────────────────────────────────┐');
  console.log('│  papel:         Empresa conveniada PJ (teste interno SISGD)      │');
  console.log(`│  email login:   ${SISGD.emailUsuario.padEnd(48)} │`);
  console.log(`│  senha:         ${SISGD.senha.padEnd(48)} │`);
  console.log(`│  telefone:      ${SISGD.telefone.padEnd(48)} │`);
  console.log(`│  cooperadoId:   ${cooperado.id.padEnd(48)} │`);
  console.log(`│  usuarioId:     ${usuario.id.padEnd(48)} │`);
  console.log(`│  convenioId:    ${convenio.id.padEnd(48)} │`);
  console.log(`│  convenio nr:   ${convenio.numero.padEnd(48)} │`);
  console.log(`│  rota portal:   /conveniada                                      │`);
  console.log(`│  rota admin:    /dashboard/convenios                             │`);
  console.log(`│  impersonate:   /dashboard/dev/credenciais-teste                 │`);
  console.log('└──────────────────────────────────────────────────────────────────┘');

  console.log('\n⚠️  REGRA SALVAGUARDA (CLAUDE.md):');
  console.log('   - Cooperado institucional NUNCA pode ser deletado.');
  console.log(`   - Email "${SISGD.emailInstitucional}" e LIKE 'institucional+%@sisgd.invalid'`);
  console.log('     devem ser EXPLICITAMENTE excluidos de qualquer rotina de limpeza.');
  console.log('\n✅ Seed SISGD Teste Interno concluido. Convenio pronto pra receber convites.');

  await prisma.$disconnect();
}

main().catch(async (err) => {
  console.error('[seed-sisgd] FALHOU:', err);
  process.exit(1);
});
