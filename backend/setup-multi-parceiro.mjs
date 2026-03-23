/**
 * Script: setup-multi-parceiro.mjs
 *
 * Tarefas:
 * 1. Criar/garantir admin para cada parceiro
 * 2. Redistribuir 95 cooperados entre 3 parceiros
 * 3. Distribuir listaEspera seguindo cooperado.cooperativaId
 */

import { PrismaClient } from '@prisma/client';
import { createClient } from '@supabase/supabase-js';

const prisma = new PrismaClient();
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY,
);

const PARCEIROS = {
  COOPEREBR: 'cmn0ho8bx0000uox8wu96u6fd',
  CONSORCIO_SUL: 'cmn2yvexr0000uog4li8lsm1q',
  COOPERE_VERDE: 'cmn2yvf5o0001uog4kxy23u2g',
};

// ─── TAREFA 1: Admins por parceiro ─────────────────────────────────

async function garantirAdmin(email, senha, nome, cooperativaId, nomeParceiro) {
  const existente = await prisma.usuario.findUnique({ where: { email } });

  if (existente) {
    // Atualizar perfil e cooperativaId
    await prisma.usuario.update({
      where: { email },
      data: { perfil: 'ADMIN', cooperativaId },
    });
    console.log(`  ✔ ${email} atualizado → ADMIN de ${nomeParceiro}`);
    return;
  }

  // Criar no Supabase
  const { data: supaData, error } = await supabase.auth.admin.createUser({
    email,
    password: senha,
    email_confirm: true,
  });

  if (error) {
    // Se já existe no Supabase, buscar
    if (error.message?.includes('already been registered')) {
      const { data: listData } = await supabase.auth.admin.listUsers();
      const supaUser = listData?.users?.find(u => u.email === email);
      if (supaUser) {
        await prisma.usuario.create({
          data: {
            nome,
            email,
            supabaseId: supaUser.id,
            perfil: 'ADMIN',
            cooperativaId,
          },
        });
        console.log(`  ✔ ${email} criado (Supabase existente) → ADMIN de ${nomeParceiro}`);
        return;
      }
    }
    console.error(`  ✘ Erro ao criar ${email}: ${error.message}`);
    return;
  }

  await prisma.usuario.create({
    data: {
      nome,
      email,
      supabaseId: supaData.user.id,
      perfil: 'ADMIN',
      cooperativaId,
    },
  });
  console.log(`  ✔ ${email} criado → ADMIN de ${nomeParceiro}`);
}

async function tarefa1() {
  console.log('\n═══ TAREFA 1: Admins por parceiro ═══');

  await garantirAdmin(
    'admin@cooperebr.com.br',
    null, // já existe, sem senha
    'Admin CoopereBR',
    PARCEIROS.COOPEREBR,
    'CoopereBR',
  );

  await garantirAdmin(
    'admin@consorciossul.com.br',
    'ConsorSul@2026',
    'Admin Consórcio Sul',
    PARCEIROS.CONSORCIO_SUL,
    'Consórcio Sul',
  );

  await garantirAdmin(
    'admin@coopereverde.com.br',
    'CoopereVerde@2026',
    'Admin CoopereVerde',
    PARCEIROS.COOPERE_VERDE,
    'CoopereVerde',
  );
}

// ─── TAREFA 2: Redistribuir membros ─────────────────────────────────

async function tarefa2() {
  console.log('\n═══ TAREFA 2: Redistribuir membros ═══');

  const cooperados = await prisma.cooperado.findMany({
    orderBy: { createdAt: 'asc' },
    select: { id: true, nomeCompleto: true },
  });

  console.log(`  Total de cooperados: ${cooperados.length}`);

  // CoopereBR: 0-39 (primeiros 40)
  // Consórcio Sul: 40-69 (30)
  // CoopereVerde: 70-94 (25)

  const distribuicao = [
    { parceiro: 'CoopereBR', id: PARCEIROS.COOPEREBR, inicio: 0, fim: 40 },
    { parceiro: 'Consórcio Sul', id: PARCEIROS.CONSORCIO_SUL, inicio: 40, fim: 70 },
    { parceiro: 'CoopereVerde', id: PARCEIROS.COOPERE_VERDE, inicio: 70, fim: cooperados.length },
  ];

  for (const { parceiro, id: cooperativaId, inicio, fim } of distribuicao) {
    const lote = cooperados.slice(inicio, fim);
    if (lote.length === 0) continue;

    const ids = lote.map(c => c.id);

    // Atualizar cooperados
    const resultCoop = await prisma.cooperado.updateMany({
      where: { id: { in: ids } },
      data: { cooperativaId },
    });

    // Atualizar UCs dos cooperados
    const resultUcs = await prisma.uc.updateMany({
      where: { cooperadoId: { in: ids } },
      data: { cooperativaId },
    });

    // Atualizar contratos dos cooperados
    const resultContratos = await prisma.contrato.updateMany({
      where: { cooperadoId: { in: ids } },
      data: { cooperativaId },
    });

    // Atualizar cobranças dos contratos dos cooperados
    const contratos = await prisma.contrato.findMany({
      where: { cooperadoId: { in: ids } },
      select: { id: true },
    });
    const contratoIds = contratos.map(c => c.id);
    let resultCobrancas = { count: 0 };
    if (contratoIds.length > 0) {
      resultCobrancas = await prisma.cobranca.updateMany({
        where: { contratoId: { in: contratoIds } },
        data: { cooperativaId },
      });
    }

    console.log(`  ${parceiro}: ${resultCoop.count} cooperados, ${resultUcs.count} UCs, ${resultContratos.count} contratos, ${resultCobrancas.count} cobranças`);
  }
}

// ─── TAREFA 3: Distribuir lista de espera ───────────────────────────

async function tarefa3() {
  console.log('\n═══ TAREFA 3: Distribuir lista de espera ═══');

  const entradas = await prisma.listaEspera.findMany({
    include: { cooperado: { select: { cooperativaId: true } } },
  });

  console.log(`  Total de entradas na lista de espera: ${entradas.length}`);

  let atualizados = 0;
  for (const entrada of entradas) {
    const cooperativaId = entrada.cooperado?.cooperativaId;
    if (cooperativaId && entrada.cooperativaId !== cooperativaId) {
      await prisma.listaEspera.update({
        where: { id: entrada.id },
        data: { cooperativaId },
      });
      atualizados++;
    }
  }

  console.log(`  Atualizados: ${atualizados} entradas`);
}

// ─── VERIFICAÇÃO ────────────────────────────────────────────────────

async function verificar() {
  console.log('\n═══ VERIFICAÇÃO FINAL ═══');

  const parceiros = await prisma.cooperativa.findMany({
    select: { id: true, nome: true, tipoParceiro: true },
  });

  for (const p of parceiros) {
    const cooperados = await prisma.cooperado.count({ where: { cooperativaId: p.id } });
    const ucs = await prisma.uc.count({ where: { cooperativaId: p.id } });
    const contratos = await prisma.contrato.count({ where: { cooperativaId: p.id } });
    const cobrancas = await prisma.cobranca.count({ where: { cooperativaId: p.id } });
    const espera = await prisma.listaEspera.count({ where: { cooperativaId: p.id } });
    const admins = await prisma.usuario.count({ where: { cooperativaId: p.id, perfil: 'ADMIN' } });

    console.log(`\n  ${p.nome} (${p.tipoParceiro}):`);
    console.log(`    Admins: ${admins} | Cooperados: ${cooperados} | UCs: ${ucs} | Contratos: ${contratos} | Cobranças: ${cobrancas} | Espera: ${espera}`);
  }

  // Verificar órfãos
  const orfaos = await prisma.cooperado.count({ where: { cooperativaId: null } });
  console.log(`\n  Cooperados sem parceiro (órfãos): ${orfaos}`);
}

// ─── MAIN ───────────────────────────────────────────────────────────

async function main() {
  console.log('╔══════════════════════════════════════════╗');
  console.log('║   Setup Multi-Parceiro — CoopereBR       ║');
  console.log('╚══════════════════════════════════════════╝');

  await tarefa1();
  await tarefa2();
  await tarefa3();
  await verificar();

  console.log('\n✅ Setup completo!');
}

main()
  .catch((e) => {
    console.error('Erro:', e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
