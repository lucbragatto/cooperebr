/**
 * Sprint Bot Autoatendimento — Bloco 4 (22/05).
 *
 * Liga "3 Atualizar meu cadastro" do MENU_COOPERADO ao motor dinamico.
 * Decisao Luciano 22/05: TELEFONE NAO entra (risco operacional — trocar
 * pelo proprio WhatsApp quebra a proxima sessao do bot e desvia notificacoes).
 *
 * Sequencia idempotente em 3 partes:
 *
 *  1. INSERE 3 etapas globais novas com gatilho wildcard + acao:
 *      - AGUARDANDO_NOVO_NOME (modelo: aguardando_novo_nome)
 *        gatilho '*' -> MENU_COOPERADO + acao ATUALIZAR_NOME_COOPERADO
 *      - AGUARDANDO_NOVO_EMAIL (modelo: aguardando_novo_email)
 *        gatilho '*' -> MENU_COOPERADO + acao ATUALIZAR_EMAIL_COOPERADO
 *      - AGUARDANDO_NOVO_CEP (modelo: aguardando_novo_cep)
 *        gatilho '*' -> MENU_COOPERADO + acao ATUALIZAR_CEP_COOPERADO
 *
 *     Etapas NAO tem acaoAutomatica — quem dispara a acao eh o gatilho
 *     wildcard via Etapa A do Bloco 4 (motor processa Gatilho.acao).
 *
 *  2. REPOINTA gatilhos do ATUALIZACAO_CADASTRO (GLOBAL — f-atualizar-cadastro)
 *     pra alinhar com o seed atualizado:
 *      - '1' -> AGUARDANDO_NOVO_NOME (mantem)
 *      - '2' -> AGUARDANDO_NOVO_EMAIL (mantem)
 *      - '3' -> AGUARDANDO_NOVO_CEP (era '3' telefone — telefone removido)
 *      - '4' -> deletado (era CEP, agora vira '3')
 *
 *  3. (read-only) Confirma que os 3 modelos aguardando_novo_* JA EXISTEM
 *     no banco (Bloco 2 commit 1097f72). Aborta com erro claro se algum
 *     faltar.
 *
 * Idempotente:
 *  - Etapas: skip se ja existe (estado + cooperativaId null + gatilhos
 *    equivalentes); atualiza se gatilhos divergem.
 *  - Gatilhos do ATUALIZACAO_CADASTRO: compara antes/depois e atualiza
 *    se necessario. Operacao com ANTES/DEPOIS visivel no log.
 */
import { PrismaClient, Prisma } from '@prisma/client';

const prisma = new PrismaClient();

interface GatilhoComAcao {
  resposta: string;
  proximoEstado: string;
  acao?: string;
}

interface EtapaNova {
  nome: string;
  estado: string;
  ordem: number;
  modeloNome: string;
  gatilhos: GatilhoComAcao[];
}

const ETAPAS_NOVAS: EtapaNova[] = [
  {
    nome: 'Aguardando Novo Nome',
    estado: 'AGUARDANDO_NOVO_NOME',
    ordem: 52,
    modeloNome: 'aguardando_novo_nome',
    gatilhos: [
      {
        resposta: '*',
        proximoEstado: 'MENU_COOPERADO',
        acao: 'ATUALIZAR_NOME_COOPERADO',
      },
    ],
  },
  {
    nome: 'Aguardando Novo Email',
    estado: 'AGUARDANDO_NOVO_EMAIL',
    ordem: 53,
    modeloNome: 'aguardando_novo_email',
    gatilhos: [
      {
        resposta: '*',
        proximoEstado: 'MENU_COOPERADO',
        acao: 'ATUALIZAR_EMAIL_COOPERADO',
      },
    ],
  },
  {
    nome: 'Aguardando Novo CEP',
    estado: 'AGUARDANDO_NOVO_CEP',
    ordem: 54,
    modeloNome: 'aguardando_novo_cep',
    gatilhos: [
      {
        resposta: '*',
        proximoEstado: 'MENU_COOPERADO',
        acao: 'ATUALIZAR_CEP_COOPERADO',
      },
    ],
  },
];

const GATILHOS_ATUALIZACAO_CADASTRO_NOVOS: GatilhoComAcao[] = [
  { resposta: '1', proximoEstado: 'AGUARDANDO_NOVO_NOME' },
  { resposta: '2', proximoEstado: 'AGUARDANDO_NOVO_EMAIL' },
  { resposta: '3', proximoEstado: 'AGUARDANDO_NOVO_CEP' },
];

function gatilhosIguais(a: GatilhoComAcao[], b: GatilhoComAcao[]): boolean {
  if (a.length !== b.length) return false;
  // Compara como JSON ordenado pra ignorar ordem dos campos
  const sortFn = (x: GatilhoComAcao, y: GatilhoComAcao) =>
    `${x.resposta}|${x.proximoEstado}`.localeCompare(`${y.resposta}|${y.proximoEstado}`);
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
    console.log('═══ Bloco 4 — Atualizar Cadastro (Nome / Email / CEP) ═══\n');
    console.log('  TELEFONE NAO entra (decisao Luciano 22/05).\n');

    // ─────────────────────────────────────────────────────────────
    // PARTE 3 (primeiro) — Confirma modelos existentes
    // ─────────────────────────────────────────────────────────────
    console.log('── Parte 1: confirma modelos do Bloco 2 (commit 1097f72) ──');
    const nomesModelos = ETAPAS_NOVAS.map((e) => e.modeloNome);
    const modelos = await prisma.modeloMensagem.findMany({
      where: { nome: { in: nomesModelos }, cooperativaId: null, ativo: true },
      select: { id: true, nome: true },
    });
    if (modelos.length !== nomesModelos.length) {
      const encontrados = new Set(modelos.map((m) => m.nome));
      const faltando = nomesModelos.filter((n) => !encontrados.has(n));
      throw new Error(
        `Modelos faltando no banco (esperado do Bloco 2): ${faltando.join(', ')}. ` +
          `Rode primeiro fix-bloco-2-modelos-novos.ts ou confirme o commit 1097f72.`,
      );
    }
    const modeloPorNome = new Map(modelos.map((m) => [m.nome, m.id]));
    console.log(`   ✓ ${modelos.length} modelos confirmados.\n`);

    // ─────────────────────────────────────────────────────────────
    // PARTE 1 — Etapas novas (GLOBAIS) com gatilho wildcard + acao
    // ─────────────────────────────────────────────────────────────
    console.log('── Parte 2: etapas novas (AGUARDANDO_NOVO_*) ──');
    let etapasCriadas = 0;
    let etapasPuladas = 0;
    let etapasAtualizadas = 0;

    for (const e of ETAPAS_NOVAS) {
      const modeloId = modeloPorNome.get(e.modeloNome)!;
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
            modeloMensagemId: modeloId,
            gatilhos: e.gatilhos as unknown as Prisma.InputJsonValue,
            acaoAutomatica: null,
            ativo: true,
          },
        });
        etapasCriadas++;
        console.log(
          `   + CRIADA ${e.estado} (id=${novo.id}, modelo=${e.modeloNome}, gatilho '*' -> ${e.gatilhos[0].acao})`,
        );
        continue;
      }

      const atual = Array.isArray(existente.gatilhos)
        ? (existente.gatilhos as unknown as GatilhoComAcao[])
        : [];
      const precisaAtualizar =
        !gatilhosIguais(atual, e.gatilhos) ||
        existente.modeloMensagemId !== modeloId ||
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
          modeloMensagemId: modeloId,
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

    // ─────────────────────────────────────────────────────────────
    // PARTE 2 — Repointa gatilhos do ATUALIZACAO_CADASTRO (GLOBAL)
    // ─────────────────────────────────────────────────────────────
    console.log('── Parte 3: gatilhos do ATUALIZACAO_CADASTRO (sem telefone) ──');
    const atualizacaoCadastro = await prisma.fluxoEtapa.findFirst({
      where: { estado: 'ATUALIZACAO_CADASTRO', cooperativaId: null },
    });
    if (!atualizacaoCadastro) {
      console.log(
        '   = SKIP — etapa ATUALIZACAO_CADASTRO global nao existe no banco. ' +
          'Sera criada na proxima execucao do seed-fluxos-bot.mjs.',
      );
    } else {
      const atual = Array.isArray(atualizacaoCadastro.gatilhos)
        ? (atualizacaoCadastro.gatilhos as unknown as GatilhoComAcao[])
        : [];
      const igual = gatilhosIguais(atual, GATILHOS_ATUALIZACAO_CADASTRO_NOVOS);
      if (igual) {
        console.log('   = SKIP ATUALIZACAO_CADASTRO gatilhos ja alinhados.');
      } else {
        console.log(`   ~ ATUALIZAR ATUALIZACAO_CADASTRO (id=${atualizacaoCadastro.id})`);
        console.log(`     ANTES: ${JSON.stringify(atual)}`);
        console.log(`     DEPOIS: ${JSON.stringify(GATILHOS_ATUALIZACAO_CADASTRO_NOVOS)}`);
        await prisma.fluxoEtapa.update({
          where: { id: atualizacaoCadastro.id },
          data: {
            gatilhos: GATILHOS_ATUALIZACAO_CADASTRO_NOVOS as unknown as Prisma.InputJsonValue,
          },
        });
      }
    }

    console.log('\n═══ Bloco 4 aplicado com sucesso ═══');
  } catch (err) {
    console.error('\n❌ ERRO:', err instanceof Error ? err.message : err);
    process.exitCode = 1;
  } finally {
    await prisma.$disconnect();
  }
}

main();
