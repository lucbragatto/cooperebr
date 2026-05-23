/**
 * Sprint Bot Autoatendimento — Bloco 6 (23/05).
 *
 * Liga as 4 etapas CADASTRO_PROXY_* ao motor dinamico via gatilho wildcard
 * + acao (padrao Bloco 4 + extensao midia Bloco 6 Etapa B).
 *
 * Decisoes Luciano 23/05:
 *  - (1A) Estende motor pra receber midia — AGUARDANDO_FATURA_PROXY entra
 *    no motor (NAO fica no hardcoded). Etapa B do motor ja implementada.
 *  - (2b) Cria Indicacao formal com status PENDENTE na acao
 *    CRIAR_COOPERADO_PROXY (alem de Cooperado.cooperadoIndicadorId).
 *  - (3i) Modelo proxy_confirmar mapeia {{titular}}/{{telefone}} na acao
 *    (sem renomear o modelo).
 *
 * Sequencia idempotente em 2 partes:
 *
 *  1. (read-only) Confirma que os 4 modelos `proxy_*` existem no banco
 *     (Bloco 2 commit 1097f72). Aborta com erro claro se faltar.
 *
 *  2. UPDATE nas 4 etapas FluxoEtapa globais:
 *
 *     - CADASTRO_PROXY_NOME (f-proxy-nome):
 *       modeloMensagemId = proxy_pedindo_nome
 *       gatilhos = [{ resposta: '*', proximoEstado: 'CADASTRO_PROXY_TELEFONE',
 *                     acao: 'SALVAR_PROXY_NOME' }]
 *
 *     - CADASTRO_PROXY_TELEFONE (f-proxy-tel):
 *       modeloMensagemId = proxy_pedindo_telefone
 *       gatilhos = [{ resposta: '*', proximoEstado: 'AGUARDANDO_FATURA_PROXY',
 *                     acao: 'SALVAR_PROXY_TELEFONE' }]
 *
 *     - AGUARDANDO_FATURA_PROXY (f-proxy-fatura):
 *       modeloMensagemId = proxy_pedindo_fatura
 *       gatilhos = [{ resposta: '*', proximoEstado: 'CONFIRMAR_PROXY',
 *                     acao: 'PROCESSAR_OCR_PROXY' }]
 *       acaoAutomatica: null (acao dispara via gatilho wildcard quando
 *                             cooperado envia midia; motor da Etapa B
 *                             reconhece via temMidia)
 *
 *     - CONFIRMAR_PROXY (f-proxy-confirmar):
 *       modeloMensagemId = proxy_confirmar
 *       gatilhos = [
 *         { resposta: '1', proximoEstado: 'MENU_COOPERADO',
 *           acao: 'CRIAR_COOPERADO_PROXY' },
 *         { resposta: '2', proximoEstado: 'MENU_COOPERADO' },
 *       ]
 *
 * Idempotente (skip se ja alinhada).
 */
import { PrismaClient, Prisma } from '@prisma/client';

const prisma = new PrismaClient();

interface GatilhoComAcao {
  resposta: string;
  proximoEstado: string;
  acao?: string;
}

interface EtapaAjuste {
  estado: string;
  modeloNome: string;
  gatilhos: GatilhoComAcao[];
}

const ETAPAS_AJUSTES: EtapaAjuste[] = [
  {
    estado: 'CADASTRO_PROXY_NOME',
    modeloNome: 'proxy_pedindo_nome',
    gatilhos: [
      {
        resposta: '*',
        proximoEstado: 'CADASTRO_PROXY_TELEFONE',
        acao: 'SALVAR_PROXY_NOME',
      },
    ],
  },
  {
    estado: 'CADASTRO_PROXY_TELEFONE',
    modeloNome: 'proxy_pedindo_telefone',
    gatilhos: [
      {
        resposta: '*',
        proximoEstado: 'AGUARDANDO_FATURA_PROXY',
        acao: 'SALVAR_PROXY_TELEFONE',
      },
    ],
  },
  {
    estado: 'AGUARDANDO_FATURA_PROXY',
    modeloNome: 'proxy_pedindo_fatura',
    gatilhos: [
      {
        resposta: '*',
        proximoEstado: 'CONFIRMAR_PROXY',
        acao: 'PROCESSAR_OCR_PROXY',
      },
    ],
  },
  {
    estado: 'CONFIRMAR_PROXY',
    modeloNome: 'proxy_confirmar',
    gatilhos: [
      {
        resposta: '1',
        proximoEstado: 'MENU_COOPERADO',
        acao: 'CRIAR_COOPERADO_PROXY',
      },
      { resposta: '2', proximoEstado: 'MENU_COOPERADO' },
    ],
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
    console.log('═══ Bloco 6 — Liga Cadastro Proxy ao motor dinâmico ═══\n');
    console.log(
      '  Decisoes Luciano 23/05: motor estendido pra midia, Indicacao formal,\n' +
        '  vars {{titular}}/{{telefone}} mapeadas na acao.\n',
    );

    // ─────────────────────────────────────────────────────────────
    // PARTE 1 — Confirma os 4 modelos proxy_*
    // ─────────────────────────────────────────────────────────────
    console.log('── Parte 1: confirma 4 modelos proxy_* no banco ──');
    const nomesModelos = ETAPAS_AJUSTES.map((e) => e.modeloNome);
    const modelos = await prisma.modeloMensagem.findMany({
      where: {
        nome: { in: nomesModelos },
        cooperativaId: null,
        ativo: true,
      },
      select: { id: true, nome: true },
    });
    if (modelos.length !== nomesModelos.length) {
      const encontrados = new Set(modelos.map((m) => m.nome));
      const faltando = nomesModelos.filter((n) => !encontrados.has(n));
      throw new Error(
        `Modelos faltando no banco: ${faltando.join(', ')}. ` +
          `Confirme commit 1097f72 (Bloco 2) ou rode fix-bloco-2-modelos-novos.ts.`,
      );
    }
    const modeloPorNome = new Map(modelos.map((m) => [m.nome, m.id]));
    console.log(`   ✓ ${modelos.length} modelos confirmados.\n`);

    // ─────────────────────────────────────────────────────────────
    // PARTE 2 — UPDATE 4 etapas
    // ─────────────────────────────────────────────────────────────
    console.log('── Parte 2: cabea 4 etapas CADASTRO_PROXY_* ──');
    let atualizadas = 0;
    let puladas = 0;

    for (const ajuste of ETAPAS_AJUSTES) {
      const modeloId = modeloPorNome.get(ajuste.modeloNome)!;
      const etapa = await prisma.fluxoEtapa.findFirst({
        where: { estado: ajuste.estado, cooperativaId: null },
      });
      if (!etapa) {
        console.log(
          `   ⚠️  Etapa ${ajuste.estado} nao encontrada (global) — pulando. ` +
            `Confirme seed-fluxos-bot.mjs rodado.`,
        );
        continue;
      }

      const atualGatilhos = Array.isArray(etapa.gatilhos)
        ? (etapa.gatilhos as unknown as GatilhoComAcao[])
        : [];
      const precisaAtualizar =
        !gatilhosIguais(atualGatilhos, ajuste.gatilhos) ||
        etapa.modeloMensagemId !== modeloId ||
        etapa.acaoAutomatica !== null ||
        !etapa.ativo;

      if (!precisaAtualizar) {
        puladas++;
        console.log(`   = SKIP ${ajuste.estado} (ja alinhada)`);
        continue;
      }

      console.log(`   ~ ATUALIZAR ${ajuste.estado} (id=${etapa.id})`);
      console.log(`     ANTES modeloMensagemId: ${etapa.modeloMensagemId}`);
      console.log(`     ANTES gatilhos: ${JSON.stringify(atualGatilhos)}`);
      console.log(`     ANTES acaoAutomatica: ${etapa.acaoAutomatica}`);
      console.log(`     DEPOIS modeloMensagemId: ${modeloId}`);
      console.log(`     DEPOIS gatilhos: ${JSON.stringify(ajuste.gatilhos)}`);
      console.log('     DEPOIS acaoAutomatica: null');

      await prisma.fluxoEtapa.update({
        where: { id: etapa.id },
        data: {
          modeloMensagemId: modeloId,
          gatilhos: ajuste.gatilhos as unknown as Prisma.InputJsonValue,
          acaoAutomatica: null,
          ativo: true,
        },
      });
      atualizadas++;
    }

    console.log(
      `\n   Resumo: ${atualizadas} atualizada(s), ${puladas} pulada(s).`,
    );

    console.log('\n═══ Bloco 6 aplicado com sucesso ═══');
  } catch (err) {
    console.error('\n❌ ERRO:', err instanceof Error ? err.message : err);
    process.exitCode = 1;
  } finally {
    await prisma.$disconnect();
  }
}

main();
