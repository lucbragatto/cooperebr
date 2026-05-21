/**
 * Sprint Bot Autoatendimento — Bloco 3 (21/05).
 *
 * Cabea "1 Ver saldo de creditos" + "2 Ver proxima fatura" do MENU_COOPERADO,
 * que hoje viram loop. Sequencia idempotente em 3 partes:
 *
 *  1. INSERE 2 etapas globais novas:
 *      - VER_SALDO_CREDITOS (acaoAutomatica: CONSULTAR_SALDO_CREDITOS, sem modelo
 *        proprio — a acao renderiza saldo_creditos_resultado direto)
 *      - VER_PROXIMA_FATURA (acaoAutomatica: CONSULTAR_PROXIMA_FATURA, sem modelo
 *        proprio — a acao renderiza proxima_fatura_resultado direto)
 *
 *  2. INSERE 2 modelos globais novos (categoria BOT, ativo=true):
 *      - saldo_creditos_resultado (Opcao C aprovada 21/05 — plano + saldo +
 *        validade, com fallback de linhas que somem quando dado ausente)
 *      - proxima_fatura_resultado (valor + vencimento + status + link Asaas
 *        quando houver)
 *
 *  3. REPOINTA 2 gatilhos do MENU_COOPERADO (etapa GLOBAL f-menu-cooperado):
 *      - "1" -> VER_SALDO_CREDITOS (era loop pra MENU_COOPERADO + acao orfa)
 *      - "2" -> VER_PROXIMA_FATURA (era loop pra MENU_COOPERADO + acao orfa)
 *      Remove campo `acao` orfao dos 2 gatilhos (motor nao processa esse
 *      campo — decisao arquitetural memoria sprint_bot_autoatendimento_20_05).
 *
 * Idempotente:
 *  - Etapas: skip se ja existe por estado + nome + cooperativaId null.
 *  - Modelos: skip se ja existe; atualiza conteudo se divergente (mesma
 *    estrategia do fix-bloco-2-modelos-novos.ts).
 *  - Gatilhos: detecta divergencia (proximoEstado atual != esperado OU
 *    campo `acao` ainda presente) e UPDATE, com ANTES/DEPOIS visivel.
 *
 * Bug latente do hardcoded (D-novo-U): whatsapp-bot.service.ts:791-794 usa
 * status: ['PENDENTE','VENCIDO'] mas cobrancas vao pra 'A_VENCER' — handler
 * responde "sem faturas" mesmo com A_VENCER. Acao nova CONSULTAR_PROXIMA_FATURA
 * usa ['A_VENCER','VENCIDO'] corretamente. Catalogar em debitos-tecnicos.md.
 */
import { PrismaClient, Prisma } from '@prisma/client';

const prisma = new PrismaClient();

interface EtapaNova {
  nome: string;
  estado: string;
  ordem: number;
  acaoAutomatica: string;
}

const ETAPAS_NOVAS: EtapaNova[] = [
  {
    nome: 'Ver Saldo de Creditos',
    estado: 'VER_SALDO_CREDITOS',
    ordem: 50,
    acaoAutomatica: 'CONSULTAR_SALDO_CREDITOS',
  },
  {
    nome: 'Ver Proxima Fatura',
    estado: 'VER_PROXIMA_FATURA',
    ordem: 51,
    acaoAutomatica: 'CONSULTAR_PROXIMA_FATURA',
  },
];

interface ModeloNovo {
  nome: string;
  conteudo: string;
}

const MODELOS_NOVOS: ModeloNovo[] = [
  {
    nome: 'saldo_creditos_resultado',
    conteudo:
      '⚡ *Seu plano e créditos:*\n\n' +
      '📋 Plano contratado: {{kwhContratoMensal}} kWh/mês\n' +
      '{{linha_saldo}}{{linha_validade}}{{linha_ultima_fatura}}\n\n' +
      '_Pra atualizar seu saldo, envie sua fatura mais recente (opção 3 do menu)._',
  },
  {
    nome: 'proxima_fatura_resultado',
    conteudo: '📄 *Sua próxima fatura:*\n\n{{bloco_fatura}}{{link_pagamento}}',
  },
];

interface Gatilho {
  resposta: string;
  proximoEstado: string;
  acao?: string;
}

interface RepointGatilho {
  resposta: string;
  proximoEstadoNovo: string;
  removerAcao: boolean;
}

const REPOINT_MENU_COOPERADO: RepointGatilho[] = [
  { resposta: '1', proximoEstadoNovo: 'VER_SALDO_CREDITOS', removerAcao: true },
  { resposta: '2', proximoEstadoNovo: 'VER_PROXIMA_FATURA', removerAcao: true },
];

async function main(): Promise<void> {
  try {
    console.log('═══ Bloco 3 — Cabear "Ver saldo" + "Ver fatura" do MENU_COOPERADO ═══\n');

    // ─────────────────────────────────────────────────────────────
    // PARTE 1 — Etapas novas (GLOBAIS, modeloMensagemId: null)
    // ─────────────────────────────────────────────────────────────
    console.log('── Parte 1: etapas novas ──');
    let etapasCriadas = 0;
    let etapasPuladas = 0;
    let etapasAtualizadas = 0;

    for (const e of ETAPAS_NOVAS) {
      const existente = await prisma.fluxoEtapa.findFirst({
        where: { estado: e.estado, cooperativaId: null },
      });

      if (!existente) {
        const novo = await prisma.fluxoEtapa.create({
          data: {
            cooperativaId: null,
            nome: e.nome,
            ordem: e.ordem,
            estado: e.estado,
            modeloMensagemId: null,
            gatilhos: [] as unknown as Prisma.InputJsonValue,
            acaoAutomatica: e.acaoAutomatica,
            ativo: true,
          },
        });
        console.log(`  ✅ CRIADA etapa "${e.estado}" id=${novo.id} (acao=${e.acaoAutomatica})`);
        etapasCriadas++;
      } else if (
        existente.acaoAutomatica !== e.acaoAutomatica ||
        existente.ativo !== true ||
        existente.modeloMensagemId !== null
      ) {
        await prisma.fluxoEtapa.update({
          where: { id: existente.id },
          data: {
            acaoAutomatica: e.acaoAutomatica,
            ativo: true,
            modeloMensagemId: null,
          },
        });
        console.log(`  🔄 ATUALIZADA etapa "${e.estado}" id=${existente.id}`);
        console.log(`     ANTES:  acao=${existente.acaoAutomatica} ativo=${existente.ativo} modeloId=${existente.modeloMensagemId}`);
        console.log(`     DEPOIS: acao=${e.acaoAutomatica} ativo=true modeloId=null`);
        etapasAtualizadas++;
      } else {
        console.log(`  ⏭️  JA OK etapa "${e.estado}" id=${existente.id} (skip)`);
        etapasPuladas++;
      }
    }

    // ─────────────────────────────────────────────────────────────
    // PARTE 2 — Modelos novos (GLOBAIS, categoria BOT)
    // ─────────────────────────────────────────────────────────────
    console.log('\n── Parte 2: modelos novos ──');
    let modelosCriados = 0;
    let modelosAtualizados = 0;
    let modelosPulados = 0;

    for (const m of MODELOS_NOVOS) {
      const existente = await prisma.modeloMensagem.findFirst({
        where: { nome: m.nome, cooperativaId: null },
      });

      if (!existente) {
        const novo = await prisma.modeloMensagem.create({
          data: {
            nome: m.nome,
            categoria: 'BOT',
            conteudo: m.conteudo,
            cooperativaId: null,
            ativo: true,
          },
        });
        console.log(`  ✅ CRIADO modelo "${m.nome}" id=${novo.id}`);
        console.log(`     conteudo (preview): ${JSON.stringify(m.conteudo.slice(0, 80))}...`);
        modelosCriados++;
      } else if (existente.conteudo !== m.conteudo) {
        const antes = existente.conteudo;
        await prisma.modeloMensagem.update({
          where: { id: existente.id },
          data: { conteudo: m.conteudo, categoria: 'BOT', ativo: true },
        });
        console.log(`  🔄 ATUALIZADO modelo "${m.nome}" id=${existente.id}`);
        console.log(`     ANTES:  ${JSON.stringify(antes.slice(0, 80))}`);
        console.log(`     DEPOIS: ${JSON.stringify(m.conteudo.slice(0, 80))}`);
        modelosAtualizados++;
      } else {
        console.log(`  ⏭️  JA OK modelo "${m.nome}" id=${existente.id} (skip)`);
        modelosPulados++;
      }
    }

    // ─────────────────────────────────────────────────────────────
    // PARTE 3 — Repointar gatilhos "1" e "2" do MENU_COOPERADO
    // ─────────────────────────────────────────────────────────────
    console.log('\n── Parte 3: repointar gatilhos do MENU_COOPERADO ──');

    const menu = await prisma.fluxoEtapa.findFirst({
      where: { estado: 'MENU_COOPERADO', cooperativaId: null, ativo: true },
    });
    if (!menu) {
      console.log('  ❌ Etapa GLOBAL MENU_COOPERADO ativa nao encontrada — pulando repoint.');
    } else {
      const gatilhosAtuais = Array.isArray(menu.gatilhos)
        ? (menu.gatilhos as unknown as Gatilho[])
        : [];
      const gatilhosNovos: Gatilho[] = gatilhosAtuais.map((g) => ({ ...g }));
      let alterouAlgum = false;

      for (const r of REPOINT_MENU_COOPERADO) {
        const idx = gatilhosNovos.findIndex((g) => g.resposta === r.resposta);
        if (idx === -1) {
          console.log(`  ⚠️  Gatilho resposta="${r.resposta}" nao encontrado em MENU_COOPERADO — adicionando.`);
          gatilhosNovos.push({ resposta: r.resposta, proximoEstado: r.proximoEstadoNovo });
          alterouAlgum = true;
          continue;
        }
        const g = gatilhosNovos[idx];
        const precisaUpdate = g.proximoEstado !== r.proximoEstadoNovo || (r.removerAcao && g.acao !== undefined);
        if (!precisaUpdate) {
          console.log(`  ⏭️  Gatilho "${r.resposta}" ja OK (proximoEstado=${g.proximoEstado}, acao=${g.acao ?? 'ausente'})`);
          continue;
        }
        const antes = { ...g };
        const novo: Gatilho = { resposta: g.resposta, proximoEstado: r.proximoEstadoNovo };
        if (!r.removerAcao && g.acao) novo.acao = g.acao;
        gatilhosNovos[idx] = novo;
        console.log(`  🔄 Gatilho "${r.resposta}":`);
        console.log(`     ANTES:  ${JSON.stringify(antes)}`);
        console.log(`     DEPOIS: ${JSON.stringify(novo)}`);
        alterouAlgum = true;
      }

      if (alterouAlgum) {
        await prisma.fluxoEtapa.update({
          where: { id: menu.id },
          data: { gatilhos: gatilhosNovos as unknown as Prisma.InputJsonValue },
        });
        console.log(`  ✅ MENU_COOPERADO gatilhos atualizados (etapa id=${menu.id})`);
      } else {
        console.log('  ⏭️  Nenhuma alteracao necessaria nos gatilhos do MENU_COOPERADO.');
      }
    }

    // ─────────────────────────────────────────────────────────────
    // Validacao pos-update
    // ─────────────────────────────────────────────────────────────
    console.log('\n═══ Validacao pos-update ═══');

    let okEtapas = 0;
    for (const e of ETAPAS_NOVAS) {
      const reg = await prisma.fluxoEtapa.findFirst({
        where: {
          estado: e.estado,
          cooperativaId: null,
          ativo: true,
          acaoAutomatica: e.acaoAutomatica,
        },
      });
      if (reg) okEtapas++;
      else console.log(`  ❌ Etapa "${e.estado}" ausente ou divergente`);
    }
    console.log(`  Etapas: ${okEtapas}/${ETAPAS_NOVAS.length} ${okEtapas === ETAPAS_NOVAS.length ? '✅' : '❌'}`);

    let okModelos = 0;
    for (const m of MODELOS_NOVOS) {
      const reg = await prisma.modeloMensagem.findFirst({
        where: { nome: m.nome, cooperativaId: null, categoria: 'BOT', ativo: true },
      });
      if (reg && reg.conteudo === m.conteudo) okModelos++;
      else console.log(`  ❌ Modelo "${m.nome}" ausente ou divergente`);
    }
    console.log(`  Modelos: ${okModelos}/${MODELOS_NOVOS.length} ${okModelos === MODELOS_NOVOS.length ? '✅' : '❌'}`);

    const menuFinal = await prisma.fluxoEtapa.findFirst({
      where: { estado: 'MENU_COOPERADO', cooperativaId: null, ativo: true },
    });
    if (menuFinal) {
      const gatilhos = Array.isArray(menuFinal.gatilhos)
        ? (menuFinal.gatilhos as unknown as Gatilho[])
        : [];
      const g1 = gatilhos.find((g) => g.resposta === '1');
      const g2 = gatilhos.find((g) => g.resposta === '2');
      const g1OK = g1?.proximoEstado === 'VER_SALDO_CREDITOS' && g1?.acao === undefined;
      const g2OK = g2?.proximoEstado === 'VER_PROXIMA_FATURA' && g2?.acao === undefined;
      console.log(`  Gatilho "1" -> VER_SALDO_CREDITOS (sem acao): ${g1OK ? '✅' : '❌'} ${JSON.stringify(g1)}`);
      console.log(`  Gatilho "2" -> VER_PROXIMA_FATURA (sem acao): ${g2OK ? '✅' : '❌'} ${JSON.stringify(g2)}`);
    }

    console.log('\n═══ Resumo ═══');
    console.log(`  Etapas: criadas=${etapasCriadas} atualizadas=${etapasAtualizadas} puladas=${etapasPuladas}`);
    console.log(`  Modelos: criados=${modelosCriados} atualizados=${modelosAtualizados} pulados=${modelosPulados}`);
    console.log('\n[bloco-3] Concluido. Menu Cooperado "1" e "2" agora cabeados.');
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
