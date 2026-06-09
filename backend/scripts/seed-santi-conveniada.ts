/**
 * F1 Santi (09/06/2026) — Primeiro convênio de teste da CoopereBR.
 *
 * Cria/atualiza (idempotente):
 *  - Cooperado PJ "Santi Medicina Diagnostica" na CoopereBR (cnpj real,
 *    contatos whitelisted, ambienteTeste=true).
 *  - Usuario logavel no Supabase + Postgres vinculado pelo email.
 *  - ContratoConvenio CV-SANTI-001 com tipoBeneficioConveniado=MISTO
 *    (energia + token, 20% beneficio token), pagador=EMPRESA com FK pro
 *    Cooperado PJ.
 *
 * Re-executar nao duplica — usa findUnique/findFirst + update.
 *
 * Pos-execucao:
 *  - /dashboard/convenios mostra "Santi Medicina Diagnostica" (status ATIVO).
 *  - /dashboard/dev/credenciais-teste mostra o login do Usuario (impersonate).
 *  - Login direto funciona: lucbragatto+santi@gmail.com / Santi@2026.
 *
 * Uso: cd backend ; npx ts-node scripts/seed-santi-conveniada.ts
 */
import { Prisma, PrismaClient } from '@prisma/client';
import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import * as path from 'node:path';

dotenv.config({ path: path.resolve(__dirname, '..', '.env') });

const COOPEREBR_ID = 'cmn0ho8bx0000uox8wu96u6fd';

// Dados reais (CNPJ mantido) + contatos whitelisted (regra inegociavel).
const SANTI = {
  nomeFantasia: 'Santi Medicina Diagnostica',
  razaoSocial: 'MAIS DIAGNOSTICO SV LTDA',
  cnpjMascarado: '12.033.286/0001-90',
  cnpjLimpo: '12033286000190',
  email: 'lucbragatto+santi@gmail.com',
  telefone: '5527981341348',
  senha: 'Santi@2026',
  endereco: {
    cep: '29050-902',
    logradouro: 'Av. Americo Buaiz',
    numero: '200',
    bairro: 'Enseada do Sua',
    cidade: 'Vitoria',
    estado: 'ES',
  },
};

const NUMERO_CV = 'CV-SANTI-001';

function exigirEnv(nome: string): string {
  const v = process.env[nome];
  if (!v) {
    console.error(`[seed-santi] FALTA env ${nome} no backend/.env`);
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
  console.log('🩺 Seed Santi Medicina Diagnostica — 1o convenio da CoopereBR');
  console.log('═══════════════════════════════════════════════════════════════════\n');

  // ──────────────────────────────────────────────────────────────
  // 1) Cooperado PJ Santi
  // ──────────────────────────────────────────────────────────────
  console.log('── Etapa 1: Cooperado PJ Santi ──');
  let cooperado = await prisma.cooperado.findFirst({
    where: {
      OR: [{ cpf: SANTI.cnpjLimpo }, { email: SANTI.email }],
    },
  });

  const dadosCooperado = {
    nomeCompleto: SANTI.nomeFantasia,
    razaoSocial: SANTI.razaoSocial,
    cpf: SANTI.cnpjLimpo,
    email: SANTI.email,
    telefone: SANTI.telefone,
    tipoPessoa: 'PJ',
    tipoCooperado: 'SEM_UC' as const,
    status: 'ATIVO' as const,
    cooperativaId: COOPEREBR_ID,
    ambienteTeste: true,
    cep: SANTI.endereco.cep,
    logradouro: SANTI.endereco.logradouro,
    numero: SANTI.endereco.numero,
    bairro: SANTI.endereco.bairro,
    cidade: SANTI.endereco.cidade,
    estado: SANTI.endereco.estado,
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
  console.log(`     cpf(CNPJ): ${cooperado.cpf}`);
  console.log(`     tipoPessoa: ${cooperado.tipoPessoa}  tipoCooperado: ${cooperado.tipoCooperado}`);
  console.log(`     status: ${cooperado.status}  ambienteTeste: ${cooperado.ambienteTeste}`);

  // ──────────────────────────────────────────────────────────────
  // 2) Usuario Supabase + Postgres
  // ──────────────────────────────────────────────────────────────
  console.log('\n── Etapa 2: Usuario logavel (Supabase + Postgres) ──');
  let usuario = await prisma.usuario.findUnique({ where: { email: SANTI.email } });

  if (usuario) {
    if (usuario.supabaseId) {
      const { error } = await supabase.auth.admin.updateUserById(usuario.supabaseId, {
        password: SANTI.senha,
        email_confirm: true,
      });
      if (error) {
        console.error(`  ⚠️ Erro Supabase updateUser: ${error.message}`);
      } else {
        console.log(`  🔄 SENHA resetada no Supabase pra "${SANTI.senha}"`);
      }
    }
    usuario = await prisma.usuario.update({
      where: { id: usuario.id },
      data: {
        nome: SANTI.nomeFantasia,
        perfil: 'COOPERADO',
        cooperativaId: COOPEREBR_ID,
        ativo: true,
      },
    });
    console.log(`  🔄 ATUALIZADO Usuario id=${usuario.id} perfil=${usuario.perfil}`);
  } else {
    console.log('  🆕 Criando Usuario novo no Supabase + Postgres...');
    const { data: sb, error } = await supabase.auth.admin.createUser({
      email: SANTI.email,
      password: SANTI.senha,
      email_confirm: true,
    });
    if (error || !sb.user) {
      console.error(`  ❌ Erro Supabase createUser: ${error?.message}`);
      process.exit(1);
    }
    usuario = await prisma.usuario.create({
      data: {
        nome: SANTI.nomeFantasia,
        email: SANTI.email,
        supabaseId: sb.user.id,
        perfil: 'COOPERADO',
        cooperativaId: COOPEREBR_ID,
        ativo: true,
      },
    });
    console.log(`  ✅ CRIADO Usuario id=${usuario.id}  supabaseId=${sb.user.id}`);
  }

  // ──────────────────────────────────────────────────────────────
  // 3) ContratoConvenio CV-SANTI-001
  // ──────────────────────────────────────────────────────────────
  console.log('\n── Etapa 3: ContratoConvenio CV-SANTI-001 ──');
  const dadosConv: Prisma.ContratoConvenioUncheckedCreateInput = {
    numero: NUMERO_CV,
    empresaNome: SANTI.nomeFantasia,
    empresaCnpj: SANTI.cnpjMascarado,
    empresaEmail: SANTI.email,
    empresaTelefone: SANTI.telefone,
    status: 'ATIVO',
    cooperativaId: COOPEREBR_ID,
    tipo: 'EMPRESA',
    tipoBeneficioConveniado: 'MISTO',
    percentualBeneficioToken: new Prisma.Decimal('20'),
    tipoDesconto: 'PERCENTUAL',
    pagador: 'EMPRESA',
    pagadorCooperadoId: cooperado.id,
    tipoTarifaEmpresa: 'PERCENTUAL_DESCONTO',
    statusAprovacao: 'APROVADO',
    modalidade: 'STANDALONE',
    registrarComoIndicacao: true,
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
  console.log(`     tipoBeneficioConveniado: ${convenio.tipoBeneficioConveniado}  (% token: ${convenio.percentualBeneficioToken})`);
  console.log(`     pagador: ${convenio.pagador}  pagadorCooperadoId: ${convenio.pagadorCooperadoId}`);
  console.log(`     status: ${convenio.status}  statusAprovacao: ${convenio.statusAprovacao}`);

  // ──────────────────────────────────────────────────────────────
  // 4) Tabela de credenciais
  // ──────────────────────────────────────────────────────────────
  console.log('\n═══ CREDENCIAIS DE TESTE — SANTI MEDICINA DIAGNOSTICA ═══');
  console.log('┌──────────────────────────────────────────────────────────────────┐');
  console.log('│  papel:         Empresa conveniada PJ                            │');
  console.log(`│  email:         ${SANTI.email.padEnd(48)} │`);
  console.log(`│  senha:         ${SANTI.senha.padEnd(48)} │`);
  console.log(`│  telefone:      ${SANTI.telefone.padEnd(48)} │`);
  console.log(`│  cooperadoId:   ${cooperado.id.padEnd(48)} │`);
  console.log(`│  usuarioId:     ${usuario.id.padEnd(48)} │`);
  console.log(`│  convenioId:    ${convenio.id.padEnd(48)} │`);
  console.log(`│  convenio nr:   ${convenio.numero.padEnd(48)} │`);
  console.log(`│  rota portal:   /conveniada                                      │`);
  console.log(`│  rota admin:    /dashboard/convenios                             │`);
  console.log(`│  impersonate:   /dashboard/dev/credenciais-teste                 │`);
  console.log('└──────────────────────────────────────────────────────────────────┘');

  console.log('\n✅ Seed Santi concluido. Login pronto + convenio MISTO 20% token ativo.');

  await prisma.$disconnect();
}

main().catch(async (err) => {
  console.error('[seed-santi] FALHOU:', err);
  process.exit(1);
});
