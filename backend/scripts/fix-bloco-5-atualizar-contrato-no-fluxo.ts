/**
 * Sprint Bot Autoatendimento — Bloco 5 (24/05).
 *
 * Liga "4 Atualizar meu contrato" do MENU_COOPERADO ao motor dinamico.
 * Decisao Luciano modelo (B): bot NAO altera contrato direto. Cria
 * SolicitacaoAlteracaoContrato PENDENTE pra equipe aprovar via painel admin.
 *
 * Sequencia idempotente em 3 partes:
 *
 *  1. INSERE 3 modelos GLOBAIS novos (categoria BOT, cooperativaId=null):
 *      - solicitacao_contrato_criada — ao cooperado depois de SALVAR.
 *      - solicitacao_contrato_aprovada — ao cooperado quando equipe aprova.
 *      - solicitacao_contrato_recusada — ao cooperado quando equipe recusa.
 *     Modelos sao consultados pelas acoes do motor e pelo endpoint REST
 *     (Etapa D). Nao ligados a etapa — sao renderizados manualmente.
 *
 *  2. ATUALIZA gatilhos do ATUALIZACAO_CONTRATO (f-atualizar-contrato) pra
 *     usar as novas acoes do motor. Padrao Bloco 4/6/7: gatilho com `acao`
 *     faz motor DELEGAR controle total — a acao transiciona estado +
 *     envia mensagem. proximoEstado segue o mesmo destino da acao pra
 *     manter coerencia visual no JSON (motor ignora quando ha acao):
 *      - '1' -> AGUARDANDO_NOVO_KWH        + INICIAR_SOLICITACAO_AUMENTAR_KWH
 *      - '2' -> AGUARDANDO_NOVO_KWH        + INICIAR_SOLICITACAO_DIMINUIR_KWH
 *      - '3' -> AGUARDANDO_MOTIVO_SUSPENSAO + INICIAR_SOLICITACAO_SUSPENDER
 *      - '4' -> CONFIRMAR_ENCERRAMENTO     + INICIAR_SOLICITACAO_ENCERRAR
 *
 *  3. INSERE 3 etapas globais novas com gatilho wildcard + acao:
 *      - AGUARDANDO_NOVO_KWH (ordem 55) — wildcard SALVAR_SOLICITACAO_KWH
 *      - AGUARDANDO_MOTIVO_SUSPENSAO (ordem 56) — wildcard SALVAR_SOLICITACAO_SUSPENDER
 *      - CONFIRMAR_ENCERRAMENTO (ordem 57) — wildcard SALVAR_SOLICITACAO_ENCERRAR
 *     Etapas NAO tem modeloMensagemId — a acao INICIAR_* envia a pergunta
 *     dinamica direto (precisa do kwhAtual do contrato), nao da pra usar
 *     modelo estatico.
 *
 * Idempotente: SKIP se ja existe; ATUALIZA se gatilhos divergem.
 * Multi-tenant: tudo cooperativaId=null (escopo GLOBAL).
 */
import { PrismaClient, Prisma } from '@prisma/client';

const prisma = new PrismaClient();

interface ModeloNovo {
  nome: string;
  conteudo: string;
}

interface GatilhoComAcao {
  resposta: string;
  proximoEstado: string;
  acao?: string;
}

interface EtapaNova {
  nome: string;
  estado: string;
  ordem: number;
  gatilhos: GatilhoComAcao[];
}

const MODELOS_NOVOS: ModeloNovo[] = [
  {
    nome: 'solicitacao_contrato_criada',
    conteudo:
      '✅ Recebemos sua solicitacao de *{{tipo}}*.\nNossa equipe vai analisar e te avisa em ate 2 dias uteis. 💛',
  },
  {
    nome: 'solicitacao_contrato_aprovada',
    conteudo:
      '✅ Sua solicitacao de *{{tipo}}* foi *APROVADA*!\n{{detalhes}}\nQualquer duvida, e so chamar aqui. 💚',
  },
  {
    nome: 'solicitacao_contrato_recusada',
    conteudo:
      '❌ Sua solicitacao de *{{tipo}}* nao pode ser aprovada agora.\nMotivo da equipe: {{motivo}}\nFale com a gente se quiser entender melhor. 💛',
  },
];

const GATILHOS_ATUALIZACAO_CONTRATO_NOVOS: GatilhoComAcao[] = [
  { resposta: '1', proximoEstado: 'AGUARDANDO_NOVO_KWH', acao: 'INICIAR_SOLICITACAO_AUMENTAR_KWH' },
  { resposta: '2', proximoEstado: 'AGUARDANDO_NOVO_KWH', acao: 'INICIAR_SOLICITACAO_DIMINUIR_KWH' },
  { resposta: '3', proximoEstado: 'AGUARDANDO_MOTIVO_SUSPENSAO', acao: 'INICIAR_SOLICITACAO_SUSPENDER' },
  { resposta: '4', proximoEstado: 'CONFIRMAR_ENCERRAMENTO', acao: 'INICIAR_SOLICITACAO_ENCERRAR' },
];

const ETAPAS_NOVAS: EtapaNova[] = [
  {
    nome: 'Aguardando Novo kWh do Contrato',
    estado: 'AGUARDANDO_NOVO_KWH',
    ordem: 55,
    gatilhos: [
      { resposta: '*', proximoEstado: 'MENU_COOPERADO', acao: 'SALVAR_SOLICITACAO_KWH' },
    ],
  },
  {
    nome: 'Aguardando Motivo da Suspensao',
    estado: 'AGUARDANDO_MOTIVO_SUSPENSAO',
    ordem: 56,
    gatilhos: [
      { resposta: '*', proximoEstado: 'MENU_COOPERADO', acao: 'SALVAR_SOLICITACAO_SUSPENDER' },
    ],
  },
  {
    nome: 'Confirmar Encerramento de Contrato',
    estado: 'CONFIRMAR_ENCERRAMENTO',
    ordem: 57,
    gatilhos: [
      { resposta: '*', proximoEstado: 'MENU_COOPERADO', acao: 'SALVAR_SOLICITACAO_ENCERRAR' },
    ],
  },
];

function gatilhosIguais(a: GatilhoComAcao[], b: GatilhoComAcao[]): boolean {
  if (a.length !== b.length) return false;
  const sortFn = (x: GatilhoComAcao, y: GatilhoComAcao) =>
    `${x.resposta}|${x.proximoEstado}|${x.acao ?? ''}`.localeCompare(
      `${y.resposta}|${y.proximoEstado}|${y.acao ?? ''}`,
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
    console.log('═══ Bloco 5 — Atualizar Contrato (kWh / Suspender / Encerrar) ═══\n');
    console.log('  Bot NAO altera contrato direto — cria SolicitacaoAlteracaoContrato');
    console.log('  PENDENTE pra equipe aprovar (decisao Luciano modelo B 24/05).\n');

    // ─────────────────────────────────────────────────────────────
    // PARTE 1 — Modelos novos
    // ─────────────────────────────────────────────────────────────
    console.log(`── Parte 1: ${MODELOS_NOVOS.length} modelos novos ──`);
    let modelosCriados = 0;
    let modelosPulados = 0;

    for (const m of MODELOS_NOVOS) {
      const existente = await prisma.modeloMensagem.findFirst({
        where: { nome: m.nome, cooperativaId: null },
      });
      if (existente) {
        modelosPulados++;
        console.log(`   = SKIP ${m.nome} (ja existe, id=${existente.id})`);
        continue;
      }
      const novo = await prisma.modeloMensagem.create({
        data: {
          nome: m.nome,
          conteudo: m.conteudo,
          categoria: 'BOT' as any,
          cooperativaId: null,
          ativo: true,
        },
      });
      modelosCriados++;
      console.log(`   + CRIADO ${m.nome} (id=${novo.id})`);
    }
    console.log(`\n   Resumo modelos: ${modelosCriados} criados, ${modelosPulados} pulado(s).\n`);

    // ─────────────────────────────────────────────────────────────
    // PARTE 2 — Atualiza gatilhos do ATUALIZACAO_CONTRATO
    // ─────────────────────────────────────────────────────────────
    console.log('── Parte 2: gatilhos do ATUALIZACAO_CONTRATO ──');
    const atualizacaoContrato = await prisma.fluxoEtapa.findFirst({
      where: { estado: 'ATUALIZACAO_CONTRATO', cooperativaId: null },
    });
    if (!atualizacaoContrato) {
      console.log(
        '   = SKIP — etapa ATUALIZACAO_CONTRATO global nao existe. ' +
          'Rode primeiro seed-fluxos-bot.mjs.',
      );
    } else {
      const atual = Array.isArray(atualizacaoContrato.gatilhos)
        ? (atualizacaoContrato.gatilhos as unknown as GatilhoComAcao[])
        : [];
      const igual = gatilhosIguais(atual, GATILHOS_ATUALIZACAO_CONTRATO_NOVOS);
      if (igual) {
        console.log('   = SKIP ATUALIZACAO_CONTRATO gatilhos ja alinhados.');
      } else {
        console.log(`   ~ ATUALIZAR ATUALIZACAO_CONTRATO (id=${atualizacaoContrato.id})`);
        console.log(`     ANTES: ${JSON.stringify(atual)}`);
        console.log(`     DEPOIS: ${JSON.stringify(GATILHOS_ATUALIZACAO_CONTRATO_NOVOS)}`);
        await prisma.fluxoEtapa.update({
          where: { id: atualizacaoContrato.id },
          data: {
            gatilhos: GATILHOS_ATUALIZACAO_CONTRATO_NOVOS as unknown as Prisma.InputJsonValue,
          },
        });
      }
    }
    console.log('');

    // ─────────────────────────────────────────────────────────────
    // PARTE 3 — Etapas intermediarias novas
    // ─────────────────────────────────────────────────────────────
    console.log(`── Parte 3: ${ETAPAS_NOVAS.length} etapas intermediarias novas ──`);
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
            gatilhos: e.gatilhos as unknown as Prisma.InputJsonValue,
            acaoAutomatica: null,
            ativo: true,
          },
        });
        etapasCriadas++;
        console.log(
          `   + CRIADA ${e.estado} (id=${novo.id}, gatilho '*' -> ${e.gatilhos[0].acao})`,
        );
        continue;
      }

      const atual = Array.isArray(existente.gatilhos)
        ? (existente.gatilhos as unknown as GatilhoComAcao[])
        : [];
      const precisaAtualizar =
        !gatilhosIguais(atual, e.gatilhos) ||
        existente.acaoAutomatica !== null ||
        !existente.ativo;

      if (!precisaAtualizar) {
        etapasPuladas++;
        console.log(`   = SKIP ${e.estado} (ja alinhada)`);
        continue;
      }

      console.log(`   ~ ATUALIZAR ${e.estado}`);
      console.log(`     ANTES gatilhos: ${JSON.stringify(atual)}`);
      console.log(`     DEPOIS gatilhos: ${JSON.stringify(e.gatilhos)}`);
      await prisma.fluxoEtapa.update({
        where: { id: existente.id },
        data: {
          gatilhos: e.gatilhos as unknown as Prisma.InputJsonValue,
          acaoAutomatica: null,
          ativo: true,
        },
      });
      etapasAtualizadas++;
    }

    console.log(
      `\n   Resumo etapas: ${etapasCriadas} criadas, ${etapasAtualizadas} atualizadas, ${etapasPuladas} pulada(s).\n`,
    );

    console.log('═══ Bloco 5 aplicado com sucesso ═══');
  } catch (err) {
    console.error('\n❌ ERRO:', err instanceof Error ? err.message : err);
    process.exitCode = 1;
  } finally {
    await prisma.$disconnect();
  }
}

main();
