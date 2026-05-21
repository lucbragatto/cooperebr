/**
 * Sprint Bot Autoatendimento — Bloco 0 (Quick wins, ~2h).
 *
 * (a) Gatilho "5" do MENU_COOPERADO ("Indicar um amigo") hoje volta pra
 *     MENU_COOPERADO (loop — "o 5 nao faz nada"). Apontar pra ENVIAR_CONVITE
 *     (caminho ja existe — R5 do 20/05).
 *
 * (b) Modelo "ajuda" cita "acesse: {{site}}" mas a Cooperativa nao tem campo
 *     `site` no schema (verificado 21/05). Trocar texto pra usar
 *     {{telefone_suporte}} (que ja existe em extrairVariaveis: coop.telefone).
 *
 * Idempotente: skip se ja aplicado. Mostra ANTES/DEPOIS de cada update.
 */
import { PrismaClient } from '@prisma/client';

const TEXTO_AJUDA_NOVO =
  'Estou aqui para ajudar! Para falar com nossa equipe da {{parceiro}}, é só responder por aqui — ou ligue para {{telefone_suporte}}.\n\nOu envie a foto da sua conta de luz para gerar uma simulação gratuita! 📸';

async function main(): Promise<void> {
  const prisma = new PrismaClient();
  try {
    console.log('═══ Bloco 0 — Quick wins ═══\n');

    // ─────────────────────────────────────────────────────────────
    // (a) Gatilho "5" do MENU_COOPERADO -> ENVIAR_CONVITE
    // ─────────────────────────────────────────────────────────────
    console.log('[a] Gatilho "5" do MENU_COOPERADO -> ENVIAR_CONVITE');

    const etapaMenuCoop = await prisma.fluxoEtapa.findFirst({
      where: { estado: 'MENU_COOPERADO', cooperativaId: null, ativo: true },
    });

    if (!etapaMenuCoop) {
      console.log('  ⚠️ Etapa MENU_COOPERADO GLOBAL ativa nao encontrada (skip)\n');
    } else {
      const gatilhos = Array.isArray(etapaMenuCoop.gatilhos)
        ? (etapaMenuCoop.gatilhos as unknown as Array<{ resposta: string; proximoEstado: string; acao?: string }>)
        : [];

      const idx5 = gatilhos.findIndex((g) => g.resposta === '5');
      if (idx5 < 0) {
        console.log('  ⚠️ Gatilho "5" nao existe na etapa (skip — pode ter sido renomeado)\n');
      } else if (gatilhos[idx5].proximoEstado === 'ENVIAR_CONVITE') {
        console.log('  JA OK (gatilho 5 ja aponta pra ENVIAR_CONVITE, skip)\n');
      } else {
        const gatilhoAntes = { ...gatilhos[idx5] };
        gatilhos[idx5] = {
          ...gatilhos[idx5],
          proximoEstado: 'ENVIAR_CONVITE',
        };

        console.log(`  ANTES: ${JSON.stringify(gatilhoAntes)}`);
        console.log(`  DEPOIS: ${JSON.stringify(gatilhos[idx5])}`);

        await prisma.fluxoEtapa.update({
          where: { id: etapaMenuCoop.id },
          data: { gatilhos: gatilhos as any },
        });
        console.log('  → UPDATE aplicado.\n');
      }
    }

    // ─────────────────────────────────────────────────────────────
    // (b) Modelo "ajuda" -> trocar {{site}} por texto util
    // ─────────────────────────────────────────────────────────────
    console.log('[b] Modelo "ajuda" — trocar {{site}} por {{telefone_suporte}}');

    const modeloAjuda = await prisma.modeloMensagem.findFirst({
      where: { nome: 'ajuda', cooperativaId: null },
    });

    if (!modeloAjuda) {
      console.log('  ⚠️ Modelo "ajuda" GLOBAL nao encontrado (skip)\n');
    } else if (modeloAjuda.conteudo === TEXTO_AJUDA_NOVO) {
      console.log(`  JA OK id=${modeloAjuda.id} (conteudo ja atualizado, skip)\n`);
    } else {
      console.log(`  ANTES:  ${JSON.stringify(modeloAjuda.conteudo)}`);
      console.log(`  DEPOIS: ${JSON.stringify(TEXTO_AJUDA_NOVO)}`);

      await prisma.modeloMensagem.update({
        where: { id: modeloAjuda.id },
        data: { conteudo: TEXTO_AJUDA_NOVO },
      });
      console.log('  → UPDATE aplicado.\n');
    }

    // ─────────────────────────────────────────────────────────────
    // Validacao pos-update
    // ─────────────────────────────────────────────────────────────
    console.log('═══ Validacao pos-update ═══');
    const etapaPos = await prisma.fluxoEtapa.findFirst({
      where: { estado: 'MENU_COOPERADO', cooperativaId: null, ativo: true },
    });
    const gatilhosPos = Array.isArray(etapaPos?.gatilhos)
      ? (etapaPos!.gatilhos as unknown as Array<{ resposta: string; proximoEstado: string }>)
      : [];
    const g5 = gatilhosPos.find((g) => g.resposta === '5');
    console.log(`  Gatilho 5 MENU_COOPERADO: ${g5?.proximoEstado === 'ENVIAR_CONVITE' ? '✅' : '❌'} -> ${g5?.proximoEstado}`);

    const modeloPos = await prisma.modeloMensagem.findFirst({ where: { nome: 'ajuda', cooperativaId: null } });
    const temSite = modeloPos?.conteudo.includes('{{site}}');
    const temTelefoneSuporte = modeloPos?.conteudo.includes('{{telefone_suporte}}');
    console.log(`  Modelo "ajuda" {{site}} removido: ${!temSite ? '✅' : '❌'}`);
    console.log(`  Modelo "ajuda" {{telefone_suporte}} presente: ${temTelefoneSuporte ? '✅' : '❌'}`);

    console.log('\n[bloco-0] Concluido.');
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((e) => { console.error(e); process.exit(1); });
