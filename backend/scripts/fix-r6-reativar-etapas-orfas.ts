/**
 * Fix R6 — Sprint Saneamento (parte 2): reativar etapas dinamicas para os
 * 5 estados orfaos (gatilhos apontam pra eles mas nao tem etapa ativa).
 *
 * Banco dev — idempotente. ANTES de ativar cada uma, conferir hardcode e
 * modelo. Reporta cada acao + ANTES/DEPOIS.
 *
 * Estados alvo (5):
 *   AGUARDANDO_ATENDENTE          (ordem=20, modelo aguardando_atendente)
 *   AGUARDANDO_FOTO_FATURA        (ordem=7,  modelo aguardando_foto_fatura)
 *   ATUALIZACAO_CONTRATO          (ordem=19, modelo menu_atualizar_contrato)
 *   AGUARDANDO_DISTRIBUIDORA      (ordem=6,  modelo aguardando_distribuidora)
 *   AGUARDANDO_DISPOSITIVO_EMAIL  (ordem=5,  SEM MODELO — criar antes)
 */
import { PrismaClient } from '@prisma/client';

const MODELO_DISPOSITIVO_EMAIL_NOME = 'aguardando_dispositivo_email';
const MODELO_DISPOSITIVO_EMAIL_CONTEUDO =
  '📧 Em qual dispositivo voce vai abrir o email da {{distribuidora}}?\n\n1️⃣ Celular\n2️⃣ Computador\n\n_Responda 1 ou 2 — te oriento o melhor caminho._';

const ESTADOS_ALVO = [
  'AGUARDANDO_ATENDENTE',
  'AGUARDANDO_FOTO_FATURA',
  'ATUALIZACAO_CONTRATO',
  'AGUARDANDO_DISTRIBUIDORA',
  'AGUARDANDO_DISPOSITIVO_EMAIL',
];

async function main(): Promise<void> {
  const prisma = new PrismaClient();
  try {
    console.log('═══ Fix R6 — Reativar etapas orfas ═══\n');

    // ────────────────────────────────────────────────────────────────
    // 1. Modelo "aguardando_dispositivo_email" GLOBAL (criar/upsert)
    // ────────────────────────────────────────────────────────────────
    console.log('[pre] Modelo GLOBAL "aguardando_dispositivo_email"');
    let modeloDispositivoEmail = await prisma.modeloMensagem.findFirst({
      where: { nome: MODELO_DISPOSITIVO_EMAIL_NOME, cooperativaId: null },
    });
    if (!modeloDispositivoEmail) {
      modeloDispositivoEmail = await prisma.modeloMensagem.create({
        data: {
          nome: MODELO_DISPOSITIVO_EMAIL_NOME,
          categoria: 'BOT',
          conteudo: MODELO_DISPOSITIVO_EMAIL_CONTEUDO,
          cooperativaId: null,
          ativo: true,
        },
      });
      console.log(`  CRIADO id=${modeloDispositivoEmail.id}`);
      console.log(`  conteudo: ${JSON.stringify(modeloDispositivoEmail.conteudo)}\n`);
    } else if (modeloDispositivoEmail.conteudo !== MODELO_DISPOSITIVO_EMAIL_CONTEUDO) {
      const antes = modeloDispositivoEmail.conteudo;
      modeloDispositivoEmail = await prisma.modeloMensagem.update({
        where: { id: modeloDispositivoEmail.id },
        data: { conteudo: MODELO_DISPOSITIVO_EMAIL_CONTEUDO },
      });
      console.log(`  ATUALIZADO id=${modeloDispositivoEmail.id}`);
      console.log(`  ANTES:  ${JSON.stringify(antes)}`);
      console.log(`  DEPOIS: ${JSON.stringify(modeloDispositivoEmail.conteudo)}\n`);
    } else {
      console.log(`  JA OK id=${modeloDispositivoEmail.id} (skip)\n`);
    }

    // ────────────────────────────────────────────────────────────────
    // 2. Conferir hardcodes nos modelos das outras 4 etapas
    // ────────────────────────────────────────────────────────────────
    console.log('[pre] Conferindo modelos das 4 etapas restantes');
    const etapasAlvo = await prisma.fluxoEtapa.findMany({
      where: { estado: { in: ESTADOS_ALVO }, cooperativaId: null },
      orderBy: { ordem: 'asc' },
    });

    const hardcodesEncontrados: Array<{ etapa: string; modelo: string; antes: string; depois: string }> = [];

    for (const etapa of etapasAlvo) {
      if (!etapa.modeloMensagemId) {
        if (etapa.estado === 'AGUARDANDO_DISPOSITIVO_EMAIL') continue; // sera apontada abaixo
        console.log(`  ⚠️ Etapa "${etapa.nome}" estado=${etapa.estado} sem modelo — anotar.`);
        continue;
      }
      const m = await prisma.modeloMensagem.findUnique({
        where: { id: etapa.modeloMensagemId },
        select: { id: true, nome: true, conteudo: true },
      });
      if (!m) {
        console.log(`  ⚠️ Etapa "${etapa.nome}" aponta pra modelo inexistente id=${etapa.modeloMensagemId}`);
        continue;
      }
      const temHardcode = /CoopereBR/i.test(m.conteudo);
      console.log(`  - "${etapa.nome}" estado=${etapa.estado} modelo="${m.nome}" hardcode? ${temHardcode ? 'SIM ⚠️' : 'NAO ✅'}`);
      if (temHardcode) {
        const antes = m.conteudo;
        const depois = m.conteudo.replace(/CoopereBR/g, '{{parceiro}}');
        await prisma.modeloMensagem.update({
          where: { id: m.id },
          data: { conteudo: depois },
        });
        hardcodesEncontrados.push({ etapa: etapa.nome, modelo: m.nome, antes, depois });
        console.log(`    ANTES:  ${JSON.stringify(antes.slice(0, 120))}`);
        console.log(`    DEPOIS: ${JSON.stringify(depois.slice(0, 120))}`);
      }
    }
    console.log();

    // ────────────────────────────────────────────────────────────────
    // 3. Apontar etapa AGUARDANDO_DISPOSITIVO_EMAIL pro novo modelo
    // ────────────────────────────────────────────────────────────────
    console.log('[1/2] Apontar etapa AGUARDANDO_DISPOSITIVO_EMAIL pro modelo recem-criado');
    const etapaDispositivoEmail = await prisma.fluxoEtapa.findFirst({
      where: { estado: 'AGUARDANDO_DISPOSITIVO_EMAIL', cooperativaId: null },
    });
    if (!etapaDispositivoEmail) {
      console.log('  ⚠️ Etapa AGUARDANDO_DISPOSITIVO_EMAIL nao encontrada (skip)\n');
    } else if (etapaDispositivoEmail.modeloMensagemId !== modeloDispositivoEmail.id) {
      const antes = etapaDispositivoEmail.modeloMensagemId;
      await prisma.fluxoEtapa.update({
        where: { id: etapaDispositivoEmail.id },
        data: { modeloMensagemId: modeloDispositivoEmail.id },
      });
      console.log(`  ATUALIZADA id=${etapaDispositivoEmail.id}`);
      console.log(`  ANTES modeloMensagemId: ${antes}`);
      console.log(`  DEPOIS modeloMensagemId: ${modeloDispositivoEmail.id}\n`);
    } else {
      console.log(`  JA OK (modelo apontado corretamente, skip)\n`);
    }

    // ────────────────────────────────────────────────────────────────
    // 4. Ativar as 5 etapas
    // ────────────────────────────────────────────────────────────────
    console.log('[2/2] Ativar as 5 etapas orfas');
    const ativadas: string[] = [];
    const jaAtivas: string[] = [];
    for (const estado of ESTADOS_ALVO) {
      const etapa = await prisma.fluxoEtapa.findFirst({
        where: { estado, cooperativaId: null },
      });
      if (!etapa) {
        console.log(`  - estado=${estado}: NAO ENCONTRADA (skip)`);
        continue;
      }
      if (etapa.ativo) {
        console.log(`  - "${etapa.nome}" estado=${estado}: JA ATIVA (skip)`);
        jaAtivas.push(etapa.nome);
        continue;
      }
      await prisma.fluxoEtapa.update({
        where: { id: etapa.id },
        data: { ativo: true },
      });
      console.log(`  - "${etapa.nome}" estado=${estado}: ✅ ATIVADA (era inativa)`);
      ativadas.push(etapa.nome);
    }

    // ────────────────────────────────────────────────────────────────
    // 5. Decisoes pendentes (apenas reporta)
    // ────────────────────────────────────────────────────────────────
    console.log('\n═══ Decisoes pendentes (reportar Luciano) ═══');

    // a) Gatilhos da ATUALIZACAO_CONTRATO voltam pra MENU_COOPERADO (sem acao real)
    const atualizacaoContrato = await prisma.fluxoEtapa.findFirst({
      where: { estado: 'ATUALIZACAO_CONTRATO', cooperativaId: null },
    });
    if (atualizacaoContrato) {
      const gat = Array.isArray(atualizacaoContrato.gatilhos)
        ? (atualizacaoContrato.gatilhos as unknown as Array<{ resposta: string; proximoEstado: string }>)
        : [];
      const todosVoltam = gat.every((g) => g.proximoEstado === 'MENU_COOPERADO');
      if (todosVoltam && gat.length > 0) {
        console.log(`  - ATUALIZACAO_CONTRATO: TODOS os ${gat.length} gatilhos voltam pra MENU_COOPERADO sem implementar acao real.`);
        console.log(`    Cooperado escolhe "Aumentar kWh" / "Diminuir" / "Suspender" / "Encerrar" e o bot soh volta pro menu.`);
        console.log(`    Sub-debito pra catalogar.`);
      }
    }

    // b) Verificar estados destino dos gatilhos das etapas recem-ativadas
    console.log('\n  - Encadeamentos das etapas reativadas:');
    const etapasReativadas = await prisma.fluxoEtapa.findMany({
      where: { estado: { in: ESTADOS_ALVO }, ativo: true, cooperativaId: null },
    });
    const estadosAtivos = new Set<string>();
    const todasAtivas = await prisma.fluxoEtapa.findMany({
      where: { ativo: true },
      select: { estado: true },
    });
    todasAtivas.forEach((e) => estadosAtivos.add(e.estado));

    for (const etapa of etapasReativadas) {
      const gat = Array.isArray(etapa.gatilhos)
        ? (etapa.gatilhos as unknown as Array<{ resposta: string; proximoEstado: string }>)
        : [];
      const destinosOrfaos = new Set<string>();
      for (const g of gat) {
        if (!estadosAtivos.has(g.proximoEstado)) destinosOrfaos.add(g.proximoEstado);
      }
      if (destinosOrfaos.size > 0) {
        console.log(`    ⚠️  "${etapa.nome}" -> gatilhos apontam pra estados ainda orfaos: ${[...destinosOrfaos].join(', ')}`);
      }
    }

    if (hardcodesEncontrados.length > 0) {
      console.log(`\n  - ${hardcodesEncontrados.length} hardcode(s) "CoopereBR" corrigido(s) durante o saneamento:`);
      hardcodesEncontrados.forEach((h) => console.log(`    * modelo "${h.modelo}" (etapa "${h.etapa}")`));
    } else {
      console.log('  - Hardcodes "CoopereBR" nos modelos das 4 etapas: nenhum encontrado ✅');
    }

    console.log('\n═══ Resumo ═══');
    console.log(`  Etapas ATIVADAS nesta rodada: ${ativadas.length} (${ativadas.join(', ') || '—'})`);
    console.log(`  Etapas que ja estavam ativas: ${jaAtivas.length} (${jaAtivas.join(', ') || '—'})`);
    console.log(`  Modelo novo criado: aguardando_dispositivo_email`);

    console.log('\n[fix-r6] Concluido.');
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((e) => { console.error(e); process.exit(1); });
