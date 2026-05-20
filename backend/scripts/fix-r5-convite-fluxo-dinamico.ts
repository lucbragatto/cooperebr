/**
 * Fix R5 (parte dados) — cabea o "Convidar amigo" no fluxo dinamico do bot.
 *
 * Idempotente:
 *   1. Upsert modelo GLOBAL "convite_indicacao" com mensagem curta.
 *   2. Upsert etapa GLOBAL estado=ENVIAR_CONVITE com acao=ENVIAR_LINK_INDICACAO.
 *   3. Adiciona gatilho { resposta:'4', proximoEstado:'ENVIAR_CONVITE' } em:
 *      - "Entrada Dinamica" (TENANT CoopereBR, estado=INICIAL ordem=28)
 *      - "Menu Principal" (GLOBAL, estado=MENU_PRINCIPAL ordem=1)
 *
 * Mostra ANTES/DEPOIS. Skip se ja aplicado.
 *
 * Roda: cd backend ; npx ts-node scripts/fix-r5-convite-fluxo-dinamico.ts
 */
import { PrismaClient } from '@prisma/client';

const MODELO_NOME = 'convite_indicacao';
// OBS 2 (20/05): modelo CURTO/complementar — apenas avisa que o link ta vindo.
// A ação ENVIAR_LINK_INDICACAO no motor envia o link + frase de CTA logo em
// seguida. Antes, o conteudo do modelo + texto da acao falavam a mesma coisa
// 2x (redundancia "🎁 Seu link..."). Agora ficam complementares.
const MODELO_CONTEUDO = '🎁 Beleza! Vou te enviar seu link de indicação 👇';

const ETAPA_ESTADO = 'ENVIAR_CONVITE';
const ETAPA_NOME = 'Enviar link de indicacao';
const ACAO = 'ENVIAR_LINK_INDICACAO';

const ETAPAS_PARA_CABEAR_GATILHO_4: { estado: string; nomeAlvo: string; cooperativaIdAlvo: string | null }[] = [
  // Tenant CoopereBR — "Entrada Dinamica"
  { estado: 'INICIAL', nomeAlvo: 'Entrada Dinâmica', cooperativaIdAlvo: 'cmn0ho8bx0000uox8wu96u6fd' },
  // Global — "Menu Principal"
  { estado: 'MENU_PRINCIPAL', nomeAlvo: 'Menu Principal', cooperativaIdAlvo: null },
];

async function main(): Promise<void> {
  const prisma = new PrismaClient();
  try {
    console.log('═══ Fix R5 — Convite no fluxo dinamico ═══\n');

    // ────────────────────────────────────────────────────────────────
    // 1. Modelo "convite_indicacao" GLOBAL
    // ────────────────────────────────────────────────────────────────
    console.log('[1/3] Modelo "convite_indicacao" GLOBAL');
    let modelo = await prisma.modeloMensagem.findFirst({
      where: { nome: MODELO_NOME, cooperativaId: null },
    });

    if (!modelo) {
      modelo = await prisma.modeloMensagem.create({
        data: {
          nome: MODELO_NOME,
          categoria: 'BOT',
          conteudo: MODELO_CONTEUDO,
          cooperativaId: null,
          ativo: true,
        },
      });
      console.log(`  CRIADO id=${modelo.id}`);
      console.log(`  conteudo: ${JSON.stringify(modelo.conteudo)}\n`);
    } else if (modelo.conteudo !== MODELO_CONTEUDO) {
      // OBS 2: conteudo divergiu (versao antiga era longa e redundante com a
      // mensagem da acao). Atualiza pra novo formato curto/complementar.
      const antes = modelo.conteudo;
      modelo = await prisma.modeloMensagem.update({
        where: { id: modelo.id },
        data: { conteudo: MODELO_CONTEUDO },
      });
      console.log(`  ATUALIZADO id=${modelo.id} (OBS 2 — eliminar redundancia)`);
      console.log(`  ANTES:  ${JSON.stringify(antes)}`);
      console.log(`  DEPOIS: ${JSON.stringify(modelo.conteudo)}\n`);
    } else {
      console.log(`  JA OK id=${modelo.id} (skip)`);
      console.log(`  conteudo atual: ${JSON.stringify(modelo.conteudo)}\n`);
    }

    // ────────────────────────────────────────────────────────────────
    // 2. Etapa ENVIAR_CONVITE GLOBAL
    // ────────────────────────────────────────────────────────────────
    console.log('[2/3] Etapa GLOBAL estado=ENVIAR_CONVITE');
    let etapa = await prisma.fluxoEtapa.findFirst({
      where: { estado: ETAPA_ESTADO, cooperativaId: null },
    });

    if (!etapa) {
      // Proxima ordem disponivel entre etapas GLOBAIS
      const maxOrdem = await prisma.fluxoEtapa.aggregate({
        where: { cooperativaId: null },
        _max: { ordem: true },
      });
      const proximaOrdem = (maxOrdem._max.ordem ?? 0) + 1;

      etapa = await prisma.fluxoEtapa.create({
        data: {
          nome: ETAPA_NOME,
          estado: ETAPA_ESTADO,
          ordem: proximaOrdem,
          modeloMensagemId: modelo.id,
          gatilhos: [],
          acaoAutomatica: ACAO,
          ativo: true,
          cooperativaId: null,
        },
      });
      console.log(`  CRIADA id=${etapa.id} ordem=${proximaOrdem}`);
      console.log(`  modelo=${modelo.id} acao=${ACAO}\n`);
    } else {
      // Idempotencia: garantir que acao e modelo estao corretos sem sobrescrever
      // ordem/nome se ja foram customizados.
      const precisaAjuste =
        etapa.acaoAutomatica !== ACAO ||
        etapa.modeloMensagemId !== modelo.id ||
        !etapa.ativo;
      if (precisaAjuste) {
        const antes = {
          acao: etapa.acaoAutomatica,
          modelo: etapa.modeloMensagemId,
          ativo: etapa.ativo,
        };
        etapa = await prisma.fluxoEtapa.update({
          where: { id: etapa.id },
          data: { acaoAutomatica: ACAO, modeloMensagemId: modelo.id, ativo: true },
        });
        console.log(`  AJUSTADA id=${etapa.id}`);
        console.log(`  ANTES: ${JSON.stringify(antes)}`);
        console.log(`  DEPOIS: { acao: '${ACAO}', modelo: '${modelo.id}', ativo: true }\n`);
      } else {
        console.log(`  JA OK id=${etapa.id} (skip)\n`);
      }
    }

    // ────────────────────────────────────────────────────────────────
    // 3. Adicionar gatilho 4 -> ENVIAR_CONVITE nas etapas alvo
    // ────────────────────────────────────────────────────────────────
    console.log('[3/3] Gatilhos "4" -> ENVIAR_CONVITE em etapas alvo');

    for (const alvo of ETAPAS_PARA_CABEAR_GATILHO_4) {
      const etapaAlvo = await prisma.fluxoEtapa.findFirst({
        where: {
          estado: alvo.estado,
          cooperativaId: alvo.cooperativaIdAlvo,
          ativo: true,
        },
        orderBy: { ordem: 'asc' },
      });

      if (!etapaAlvo) {
        console.log(`  - ${alvo.nomeAlvo} (estado=${alvo.estado}, tenant=${alvo.cooperativaIdAlvo}): NAO ENCONTRADA (skip)`);
        continue;
      }

      const gatilhosAtuais = Array.isArray(etapaAlvo.gatilhos)
        ? (etapaAlvo.gatilhos as unknown as Array<{ resposta: string; proximoEstado: string }>)
        : [];

      const jaTemGatilho4 = gatilhosAtuais.some(
        (g) => g.resposta === '4' && g.proximoEstado === ETAPA_ESTADO,
      );

      if (jaTemGatilho4) {
        console.log(`  - "${etapaAlvo.nome}" id=${etapaAlvo.id}: gatilho 4 ja existe (skip)`);
        continue;
      }

      const novosGatilhos = [
        ...gatilhosAtuais,
        { resposta: '4', proximoEstado: ETAPA_ESTADO },
      ];

      console.log(`  - "${etapaAlvo.nome}" id=${etapaAlvo.id}`);
      console.log(`    ANTES: ${JSON.stringify(gatilhosAtuais)}`);
      console.log(`    DEPOIS: ${JSON.stringify(novosGatilhos)}`);

      await prisma.fluxoEtapa.update({
        where: { id: etapaAlvo.id },
        data: { gatilhos: novosGatilhos as any },
      });
      console.log(`    UPDATE aplicado.`);
    }

    // ────────────────────────────────────────────────────────────────
    // Validacao pos-update
    // ────────────────────────────────────────────────────────────────
    console.log('\n═══ Validacao pos-update ═══');
    const etapaConvite = await prisma.fluxoEtapa.findFirst({
      where: { estado: ETAPA_ESTADO, cooperativaId: null },
    });
    console.log(`Etapa ${ETAPA_ESTADO}: ${etapaConvite ? '✅' : '❌'} ativa=${etapaConvite?.ativo} acao=${etapaConvite?.acaoAutomatica}`);

    for (const alvo of ETAPAS_PARA_CABEAR_GATILHO_4) {
      const e = await prisma.fluxoEtapa.findFirst({
        where: { estado: alvo.estado, cooperativaId: alvo.cooperativaIdAlvo, ativo: true },
      });
      if (!e) continue;
      const gat = Array.isArray(e.gatilhos)
        ? (e.gatilhos as unknown as Array<{ resposta: string; proximoEstado: string }>)
        : [];
      const tem4 = gat.some((g) => g.resposta === '4' && g.proximoEstado === ETAPA_ESTADO);
      console.log(`  "${e.nome}" (estado=${e.estado}): gatilho 4? ${tem4 ? '✅ SIM' : '❌ NAO'}`);
    }

    console.log('\n[fix-r5] Concluido.');
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((e) => { console.error(e); process.exit(1); });
