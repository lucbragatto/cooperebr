/**
 * Seed SISGD Teste Interno — converge-aware (17/06/2026 v2).
 *
 * Sprint "Abrir Cadastros — Teste SISGD".
 *
 * MUDANCA v2 (re-fatorado pos-descoberta read-only):
 *   Existia no banco desde 08/06/2026:
 *     - Cooperado SISGDSOLAR SISTEMAS LTDA (cpf 11222333000181,
 *       email lucbragatto+sisgd@gmail.com)
 *     - ContratoConvenio CV-SISGD-TESTE-001 (pagadorCooperadoId =
 *       SISGDSOLAR, status ATIVO, statusAprovacao APROVADO, 0 membros)
 *   A v1 deste seed (commit e84eada) criou DUPLICATAS (Cooperado
 *   "SISGD — Teste Interno" + ContratoConvenio CV-SISGD-INTERNO) por
 *   nao detectar os recursos pre-existentes na Fase 1 read-only.
 *
 *   v2 *converge* pro existente:
 *     - Garante SISGDSOLAR (cpf 11222333000181) ATIVO + ambienteTeste=true
 *     - Garante CV-SISGD-TESTE-001 ATIVO + APROVADO + pagador=EMPRESA
 *     - Garante Usuario lucbragatto+sisgd@gmail.com / SISGD@2026
 *       (idempotente — reset senha Supabase)
 *     - DESATIVA os 2 orfaos da v1 (status=ENCERRADO, NAO deleta —
 *       salvaguarda preservada porque um deles tem email
 *       institucional+sisgd@sisgd.invalid).
 *
 * Re-executar nao duplica — todas as ops sao findFirst/findUnique + update.
 *
 * Pos-execucao:
 *  - /dashboard/convenios mostra "SISGDSOLAR SISTEMAS LTDA" (CV-SISGD-TESTE-001).
 *  - Login direto: lucbragatto+sisgd@gmail.com / SISGD@2026.
 *  - PagadorCooperadoGuard resolve Usuario.email -> Cooperado SISGDSOLAR
 *    (match por email), destravando /conveniada/convenio/<CV-SISGD-TESTE-001>.
 *  - Os 2 orfaos da v1 ficam ENCERRADOS (auditoria preservada, zero
 *    referencias externas — read-only ja confirmou).
 *
 * Uso: cd backend ; npx ts-node scripts/seed-sisgd-teste-interno.ts
 */
import { PrismaClient } from '@prisma/client';
import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import * as path from 'node:path';

dotenv.config({ path: path.resolve(__dirname, '..', '.env') });

const COOPEREBR_ID = 'cmn0ho8bx0000uox8wu96u6fd';

// Recurso PRE-EXISTENTE (criado 08/06/2026, nao-meu) — convergir, NAO recriar.
const ALVO = {
  // Cooperado pagador
  cooperadoIdEsperado: 'cmq57khne0002vavsis4v9oxk',
  cnpjLimpo: '11222333000181',
  emailLogavel: 'lucbragatto+sisgd@gmail.com',
  // Convenio
  convenioNumero: 'CV-SISGD-TESTE-001',
  convenioIdEsperado: 'cmq57khys0005vavshti9gst9',
  // Telefone whitelist Luciano (14/05).
  telefone: '5527981341348',
  senha: 'SISGD@2026',
};

// Orfaos da v1 deste seed (commit e84eada) — DESATIVAR, NUNCA DELETAR.
// O cooperado orfao tem email institucional+sisgd@sisgd.invalid
// (salvaguarda CLAUDE.md "Cooperados institucionais" preservada).
const ORFAOS = {
  cooperadoId: 'cmqggn42n0002vaooytmpzafg', // "SISGD — Teste Interno", cpf 99999999000199
  convenioId: 'cmqggn5pj0007vaoo1gs24i5b',  // CV-SISGD-INTERNO
};

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
  console.log('🧪 Seed SISGD Teste Interno v2 — converge-aware');
  console.log('═══════════════════════════════════════════════════════════════════\n');

  // ──────────────────────────────────────────────────────────────
  // 1) Garante Cooperado SISGDSOLAR SISTEMAS LTDA (pre-existente)
  // ──────────────────────────────────────────────────────────────
  console.log('── Etapa 1: garante Cooperado SISGDSOLAR SISTEMAS LTDA (CONVERGE) ──');
  const cooperado = await prisma.cooperado.findFirst({
    where: {
      OR: [{ cpf: ALVO.cnpjLimpo }, { email: ALVO.emailLogavel }],
      cooperativaId: COOPEREBR_ID,
    },
  });

  if (!cooperado) {
    console.error(`[seed-sisgd] FALHA: Cooperado SISGDSOLAR (cpf ${ALVO.cnpjLimpo} OU email ${ALVO.emailLogavel}) NAO encontrado.`);
    console.error('  Expected pre-existing (criado 08/06/2026). Aborta — investigar antes de proceder.');
    await prisma.$disconnect();
    process.exit(1);
  }

  // Defesa adicional: confirma que e o id esperado (descoberta read-only ja datou).
  if (cooperado.id !== ALVO.cooperadoIdEsperado) {
    console.warn(
      `  ⚠️ Cooperado encontrado tem id=${cooperado.id} mas esperado=${ALVO.cooperadoIdEsperado}.`,
    );
    console.warn('  Prossegue mesmo assim (busca por cpf/email casou) — pode ser id novo.');
  }

  // Update minimo: garante campos essenciais SEM mexer em nome/cpf/razaoSocial.
  const cooperadoOK = await prisma.cooperado.update({
    where: { id: cooperado.id },
    data: {
      status: 'ATIVO',
      ambienteTeste: true,
      cooperativaId: COOPEREBR_ID,
      tipoCooperado: cooperado.tipoCooperado ?? 'SEM_UC',
    },
  });
  console.log(`  ✅ Cooperado convergido id=${cooperadoOK.id}`);
  console.log(`     nomeCompleto: ${cooperadoOK.nomeCompleto}  (preservado, NAO alterado)`);
  console.log(`     cpf: ${cooperadoOK.cpf}  email: ${cooperadoOK.email}`);
  console.log(`     status: ${cooperadoOK.status}  ambienteTeste: ${cooperadoOK.ambienteTeste}`);
  console.log(`     tipoCooperado: ${cooperadoOK.tipoCooperado}`);

  // ──────────────────────────────────────────────────────────────
  // 2) Garante Usuario logavel lucbragatto+sisgd@gmail.com
  // ──────────────────────────────────────────────────────────────
  console.log('\n── Etapa 2: Usuario logavel (Supabase + Postgres) ──');
  let usuario = await prisma.usuario.findUnique({ where: { email: ALVO.emailLogavel } });

  if (usuario) {
    if (usuario.supabaseId) {
      const { error } = await supabase.auth.admin.updateUserById(usuario.supabaseId, {
        password: ALVO.senha,
        email_confirm: true,
      });
      if (error) {
        console.error(`  ⚠️ Erro Supabase updateUser: ${error.message}`);
      } else {
        console.log(`  🔄 SENHA resetada no Supabase pra "${ALVO.senha}"`);
      }
    }
    usuario = await prisma.usuario.update({
      where: { id: usuario.id },
      data: {
        nome: cooperadoOK.nomeCompleto, // nome do Cooperado real
        perfil: 'COOPERADO',
        cooperativaId: COOPEREBR_ID,
        ativo: true,
      },
    });
    console.log(`  🔄 ATUALIZADO Usuario id=${usuario.id} perfil=${usuario.perfil}`);
  } else {
    console.log('  🆕 Criando Usuario novo no Supabase + Postgres...');
    const { data: sb, error } = await supabase.auth.admin.createUser({
      email: ALVO.emailLogavel,
      password: ALVO.senha,
      email_confirm: true,
    });
    if (error || !sb.user) {
      console.error(`  ❌ Erro Supabase createUser: ${error?.message}`);
      process.exit(1);
    }
    usuario = await prisma.usuario.create({
      data: {
        nome: cooperadoOK.nomeCompleto,
        email: ALVO.emailLogavel,
        supabaseId: sb.user.id,
        perfil: 'COOPERADO',
        cooperativaId: COOPEREBR_ID,
        ativo: true,
      },
    });
    console.log(`  ✅ CRIADO Usuario id=${usuario.id}  supabaseId=${sb.user.id}`);
  }

  // Defesa: PagadorCooperadoGuard resolve via match por email.
  if (usuario.email !== cooperadoOK.email) {
    console.error(
      `[seed-sisgd] FALHA INVARIANTE: Usuario.email (${usuario.email}) != Cooperado.email (${cooperadoOK.email}). PagadorCooperadoGuard nao vai resolver.`,
    );
    await prisma.$disconnect();
    process.exit(1);
  }
  console.log(`  ✓ Invariante guard OK: Usuario.email == Cooperado.email == ${usuario.email}`);

  // ──────────────────────────────────────────────────────────────
  // 3) Garante ContratoConvenio CV-SISGD-TESTE-001 (pre-existente)
  // ──────────────────────────────────────────────────────────────
  console.log('\n── Etapa 3: garante ContratoConvenio CV-SISGD-TESTE-001 (CONVERGE) ──');
  const convenio = await prisma.contratoConvenio.findUnique({
    where: { numero: ALVO.convenioNumero },
  });

  if (!convenio) {
    console.error(`[seed-sisgd] FALHA: ContratoConvenio ${ALVO.convenioNumero} NAO encontrado.`);
    console.error('  Expected pre-existing (criado 08/06/2026). Aborta — investigar antes de proceder.');
    await prisma.$disconnect();
    process.exit(1);
  }

  if (convenio.id !== ALVO.convenioIdEsperado) {
    console.warn(
      `  ⚠️ ContratoConvenio tem id=${convenio.id} mas esperado=${ALVO.convenioIdEsperado}. Prossegue (busca por numero unique).`,
    );
  }

  // Update minimo: garante essenciais sem mexer em nome/cnpj/tipoBeneficio.
  const convenioOK = await prisma.contratoConvenio.update({
    where: { id: convenio.id },
    data: {
      status: 'ATIVO',
      statusAprovacao: 'APROVADO',
      pagador: 'EMPRESA',
      pagadorCooperadoId: cooperadoOK.id, // garante apontamento correto
      cooperativaId: COOPEREBR_ID,
    },
  });
  console.log(`  ✅ ContratoConvenio convergido id=${convenioOK.id}`);
  console.log(`     numero: ${convenioOK.numero}`);
  console.log(`     empresaNome: ${convenioOK.empresaNome}  (preservado)`);
  console.log(`     pagador: ${convenioOK.pagador}  pagadorCooperadoId: ${convenioOK.pagadorCooperadoId}`);
  console.log(`     status: ${convenioOK.status}  statusAprovacao: ${convenioOK.statusAprovacao}`);

  // ──────────────────────────────────────────────────────────────
  // 4) Bloco DESATIVAR ORFAOS da v1 (NUNCA DELETA — salvaguarda)
  // ──────────────────────────────────────────────────────────────
  console.log('\n── Etapa 4: desativa orfaos da v1 (status=ENCERRADO, idempotente) ──');

  // 4a) Cooperado orfao
  const orfaoCoop = await prisma.cooperado.findUnique({
    where: { id: ORFAOS.cooperadoId },
    select: { id: true, nomeCompleto: true, email: true, status: true },
  });
  if (orfaoCoop) {
    console.log(
      `  Orfao Cooperado ANTES: id=${orfaoCoop.id} status=${orfaoCoop.status} email=${orfaoCoop.email}`,
    );
    if (orfaoCoop.status === 'ENCERRADO') {
      console.log('  ✓ ja estava ENCERRADO — no-op idempotente');
    } else {
      const aposCoop = await prisma.cooperado.update({
        where: { id: orfaoCoop.id },
        data: { status: 'ENCERRADO' },
        select: { id: true, status: true },
      });
      console.log(`  🔻 Orfao Cooperado DEPOIS: id=${aposCoop.id} status=${aposCoop.status}`);
      console.log(`     (NUNCA DELETADO — email ${orfaoCoop.email} institucional+@sisgd.invalid preservado por salvaguarda)`);
    }
  } else {
    console.log(`  (orfao Cooperado ${ORFAOS.cooperadoId} nao existe no banco — no-op)`);
  }

  // 4b) ContratoConvenio orfao
  const orfaoConv = await prisma.contratoConvenio.findUnique({
    where: { id: ORFAOS.convenioId },
    select: { id: true, numero: true, status: true },
  });
  if (orfaoConv) {
    console.log(
      `\n  Orfao ContratoConvenio ANTES: id=${orfaoConv.id} numero=${orfaoConv.numero} status=${orfaoConv.status}`,
    );
    if (orfaoConv.status === 'ENCERRADO') {
      console.log('  ✓ ja estava ENCERRADO — no-op idempotente');
    } else {
      const aposConv = await prisma.contratoConvenio.update({
        where: { id: orfaoConv.id },
        data: { status: 'ENCERRADO' },
        select: { id: true, numero: true, status: true },
      });
      console.log(
        `  🔻 Orfao ContratoConvenio DEPOIS: id=${aposConv.id} numero=${aposConv.numero} status=${aposConv.status}`,
      );
      console.log('     (NUNCA DELETADO — preserva trilha de auditoria do commit e84eada)');
    }
  } else {
    console.log(`  (orfao ContratoConvenio ${ORFAOS.convenioId} nao existe no banco — no-op)`);
  }

  // ──────────────────────────────────────────────────────────────
  // 5) Tabela de credenciais
  // ──────────────────────────────────────────────────────────────
  console.log('\n═══ CREDENCIAIS DE TESTE — SISGD TESTE INTERNO ═══');
  console.log('┌──────────────────────────────────────────────────────────────────┐');
  console.log('│  papel:         Empresa conveniada PJ (teste interno SISGD)      │');
  console.log(`│  email login:   ${ALVO.emailLogavel.padEnd(48)} │`);
  console.log(`│  senha:         ${ALVO.senha.padEnd(48)} │`);
  console.log(`│  telefone:      ${ALVO.telefone.padEnd(48)} │`);
  console.log(`│  cooperadoId:   ${cooperadoOK.id.padEnd(48)} │`);
  console.log(`│  usuarioId:     ${usuario.id.padEnd(48)} │`);
  console.log(`│  convenioId:    ${convenioOK.id.padEnd(48)} │`);
  console.log(`│  convenio nr:   ${convenioOK.numero.padEnd(48)} │`);
  console.log(`│  rota portal:   /conveniada                                      │`);
  console.log(`│  rota admin:    /dashboard/convenios                             │`);
  console.log(`│  impersonate:   /dashboard/dev/credenciais-teste                 │`);
  console.log('└──────────────────────────────────────────────────────────────────┘');

  console.log('\n⚠️  REGRA SALVAGUARDA:');
  console.log('   - ContratoConvenio CV-SISGD-TESTE-001 + Cooperado SISGDSOLAR (cpf 11222333000181)');
  console.log('     sao registros de SISTEMA (teste interno). NAO deletar em rotinas de limpeza.');
  console.log('   - Orfaos ENCERRADOS da v1 ficam preservados pra auditoria do commit e84eada.');
  console.log('\n✅ Seed v2 concluido. CV-SISGD-TESTE-001 pronto pra receber convites OTP.');

  await prisma.$disconnect();
}

main().catch(async (err) => {
  console.error('[seed-sisgd] FALHOU:', err);
  process.exit(1);
});
