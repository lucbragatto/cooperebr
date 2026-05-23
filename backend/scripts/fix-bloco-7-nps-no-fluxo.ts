/**
 * Sprint Bot Autoatendimento — Bloco 7 (23/05).
 *
 * Liga a etapa NPS_AGUARDANDO_NOTA ao motor dinamico via gatilho wildcard
 * com acao REGISTRAR_NPS (implementada em Etapa B, commit 2b207e4).
 *
 * Decisoes Luciano 23/05 (Fase 2 Bloco 7):
 *  - Estado pos-NPS = MENU_COOPERADO (consistente Blocos 4/1.b)
 *  - Gatilho wildcard '*' valida 0-10 inline (1 gatilho vs 11)
 *  - Estado NPS_RECEBIDO NAO criado (mensagem de agradecimento eh parte da
 *    propria acao, motor transiciona direto pra MENU_COOPERADO)
 *
 * Sequencia idempotente em 2 partes:
 *
 *  1. (read-only) Confirma que o modelo `nps_aguardando_nota` (pergunta de
 *     nota) existe no banco. Aborta com erro claro se faltar.
 *
 *  2. UPDATE etapa NPS_AGUARDANDO_NOTA (id 'f-nps', global cooperativaId
 *     null):
 *      - modeloMensagemId = nps_aguardando_nota.id
 *      - gatilhos = [{ resposta: '*', proximoEstado: 'MENU_COOPERADO',
 *                      acao: 'REGISTRAR_NPS' }]
 *      - acaoAutomatica: null (acao dispara via Gatilho.acao do wildcard,
 *        nao via entrada na etapa)
 *      - ativo: true
 *
 * Idempotente: skip se ja alinhada.
 */
import { PrismaClient, Prisma } from '@prisma/client';

const prisma = new PrismaClient();

interface GatilhoComAcao {
  resposta: string;
  proximoEstado: string;
  acao?: string;
}

const GATILHOS_NPS_NOVOS: GatilhoComAcao[] = [
  {
    resposta: '*',
    proximoEstado: 'MENU_COOPERADO',
    acao: 'REGISTRAR_NPS',
  },
];

function gatilhosIguais(a: GatilhoComAcao[], b: GatilhoComAcao[]): boolean {
  if (a.length !== b.length) return false;
  const sortFn = (x: GatilhoComAcao, y: GatilhoComAcao) =>
    `${x.resposta}|${x.proximoEstado}`.localeCompare(
      `${y.resposta}|${y.proximoEstado}`,
    );
  const aSorted = [...a].sort(sortFn);
  const bSorted = [...b].sort(sortFn);
  return aSorted.every((g, i) => {
    const o = bSorted[i];
    return (
      g.resposta === o.resposta &&
      g.proximoEstado === o.proximoEstado &&
      (g.acao ?? null) === (o.acao ?? null)
    );
  });
}

async function main(): Promise<void> {
  try {
    console.log('═══ Bloco 7 — Liga NPS ao motor dinâmico ═══\n');
    console.log(
      '  Decisao Luciano 23/05: gatilho wildcard com acao REGISTRAR_NPS,\n' +
        '  estado pos-NPS = MENU_COOPERADO.\n',
    );

    // ─────────────────────────────────────────────────────────────
    // PARTE 1 — Confirma modelo nps_aguardando_nota
    // ─────────────────────────────────────────────────────────────
    console.log('── Parte 1: confirma modelo nps_aguardando_nota ──');
    const modeloPergunta = await prisma.modeloMensagem.findFirst({
      where: { nome: 'nps_aguardando_nota', cooperativaId: null, ativo: true },
      select: { id: true, nome: true },
    });
    if (!modeloPergunta) {
      throw new Error(
        'Modelo `nps_aguardando_nota` nao encontrado no banco (global, ativo). ' +
          'Verifique se foi seedado em algum ponto historico (referencia em ' +
          'scripts/fix-r2-coopereb-para-parceiro.ts:12).',
      );
    }
    console.log(`   ✓ Modelo confirmado: id=${modeloPergunta.id}\n`);

    // Tambem confirma modelo nps_recebido (Bloco 2)
    const modeloAgradecimento = await prisma.modeloMensagem.findFirst({
      where: { nome: 'nps_recebido', cooperativaId: null, ativo: true },
      select: { id: true, nome: true },
    });
    if (!modeloAgradecimento) {
      console.log(
        '   ⚠️  Modelo `nps_recebido` nao encontrado (global, ativo). ' +
          'A acao REGISTRAR_NPS vai cair no fallback hardcoded curto. ' +
          'Verificar fix-bloco-2-modelos-novos.ts.',
      );
    } else {
      console.log(`   ✓ Modelo nps_recebido confirmado: id=${modeloAgradecimento.id}\n`);
    }

    // ─────────────────────────────────────────────────────────────
    // PARTE 2 — UPDATE etapa NPS_AGUARDANDO_NOTA
    // ─────────────────────────────────────────────────────────────
    console.log('── Parte 2: liga etapa NPS_AGUARDANDO_NOTA ──');
    const etapa = await prisma.fluxoEtapa.findFirst({
      where: { estado: 'NPS_AGUARDANDO_NOTA', cooperativaId: null },
    });
    if (!etapa) {
      throw new Error(
        'Etapa NPS_AGUARDANDO_NOTA (global) nao encontrada no banco. ' +
          'Verifique se seed-fluxos-bot.mjs foi rodado (ordem 21).',
      );
    }

    const atualGatilhos = Array.isArray(etapa.gatilhos)
      ? (etapa.gatilhos as unknown as GatilhoComAcao[])
      : [];
    const precisaAtualizar =
      !gatilhosIguais(atualGatilhos, GATILHOS_NPS_NOVOS) ||
      etapa.modeloMensagemId !== modeloPergunta.id ||
      etapa.acaoAutomatica !== null ||
      !etapa.ativo;

    if (!precisaAtualizar) {
      console.log('   = SKIP NPS_AGUARDANDO_NOTA (ja alinhada)');
    } else {
      console.log(`   ~ ATUALIZAR NPS_AGUARDANDO_NOTA (id=${etapa.id})`);
      console.log(`     ANTES modeloMensagemId: ${etapa.modeloMensagemId}`);
      console.log(`     ANTES gatilhos: ${JSON.stringify(atualGatilhos)}`);
      console.log(`     ANTES acaoAutomatica: ${etapa.acaoAutomatica}`);
      console.log(`     DEPOIS modeloMensagemId: ${modeloPergunta.id}`);
      console.log(`     DEPOIS gatilhos: ${JSON.stringify(GATILHOS_NPS_NOVOS)}`);
      console.log('     DEPOIS acaoAutomatica: null');
      await prisma.fluxoEtapa.update({
        where: { id: etapa.id },
        data: {
          modeloMensagemId: modeloPergunta.id,
          gatilhos: GATILHOS_NPS_NOVOS as unknown as Prisma.InputJsonValue,
          acaoAutomatica: null,
          ativo: true,
        },
      });
      console.log('   ✓ Etapa atualizada.');
    }

    console.log('\n═══ Bloco 7 aplicado com sucesso ═══');
  } catch (err) {
    console.error('\n❌ ERRO:', err instanceof Error ? err.message : err);
    process.exitCode = 1;
  } finally {
    await prisma.$disconnect();
  }
}

main();
