/**
 * Sprint Bot Autoatendimento — Bloco 8 (24/05). ULTIMO BLOCO DO SPRINT.
 *
 * Liga MENU_FATURA ao motor dinamico. Cooperado entra via menu '2' do
 * MENU_COOPERADO (trocando o caminho atual `2 -> VER_PROXIMA_FATURA` por
 * `2 -> MENU_FATURA` mais completo) e ve as 4 sub-opcoes do menu fatura.
 *
 * Decisao Luciano modelo (C) MISTO 24/05: porta MENU_FATURA (sub-opcoes
 * simples + "ja paguei" padrao Bloco 5). NAO porta MENU_INADIMPLENTE
 * (D-novo-AC dead code) nem NEGOCIACAO_PARCELAMENTO (D-novo-AD placeholder).
 *
 * Sequencia idempotente em 4 partes:
 *
 *  1. ATUALIZA modelo `menu_fatura` no banco pra ficar alinhado com as 4
 *     sub-opcoes implementadas (Fase 1 achou divergencia entre modelo BD
 *     e hardcoded — agora alinhado com motor).
 *
 *  2. ATUALIZA gatilhos do MENU_COOPERADO: troca `2 -> VER_PROXIMA_FATURA`
 *     por `2 -> MENU_FATURA` (entry point novo). VER_PROXIMA_FATURA
 *     continua existindo mas vira orfa — sera removida no Housekeeping
 *     quando Luciano confirmar (D-novo-AF).
 *
 *  3. UPDATE etapa MENU_FATURA: ativo=true, modeloMensagemId=menu_fatura,
 *     gatilhos das 4 sub-opcoes:
 *       1 -> MENU_FATURA + VER_FATURA_ATUAL (action nao muda estado)
 *       2 -> MENU_FATURA + VER_HISTORICO_PAGAMENTOS (idem)
 *       3 -> AGUARDANDO_FORMA_PAGAMENTO + SOLICITAR_CONFIRMACAO_PAGAMENTO
 *            (action muda estado pra coletar forma de pagamento)
 *       4 -> MENU_COOPERADO + SOLICITAR_NEGOCIACAO_HUMANA
 *
 *  4. INSERT etapa AGUARDANDO_FORMA_PAGAMENTO com gatilho wildcard '*' +
 *     acao SALVAR_CONFIRMACAO_PAGAMENTO (cria solicitacao PENDENTE).
 *
 * Idempotente: SKIP se ja existe + alinhado; UPDATE se divergir.
 * Multi-tenant: tudo cooperativaId=null (escopo GLOBAL).
 */
import { PrismaClient, Prisma } from '@prisma/client';

const prisma = new PrismaClient();

interface GatilhoComAcao {
  resposta: string;
  proximoEstado: string;
  acao?: string;
}

const MODELO_MENU_FATURA_NOVO = `📄 *Suas faturas, {{nome}}:*

1️⃣ Ver fatura atual (valor, vencimento, PIX, boleto)
2️⃣ Historico de pagamentos (ultimas 6)
3️⃣ Ja paguei — quero avisar
4️⃣ Negociar / falar com a equipe

_Responda com o numero._`;

const GATILHOS_MENU_COOPERADO_NOVOS: GatilhoComAcao[] = [
  { resposta: '1', proximoEstado: 'VER_SALDO_CREDITOS' },
  { resposta: '2', proximoEstado: 'MENU_FATURA' },
  { resposta: '3', proximoEstado: 'AGUARDANDO_FOTO_FATURA' },
  { resposta: '4', proximoEstado: 'ATUALIZACAO_CONTRATO' },
  { resposta: '5', proximoEstado: 'ENVIAR_CONVITE', acao: 'GERAR_LINK_INDICACAO' },
  { resposta: '6', proximoEstado: 'AGUARDANDO_ATENDENTE' },
  { resposta: '7', proximoEstado: 'AGUARDANDO_ATENDENTE' },
  { resposta: 'AVALIAR', proximoEstado: 'NPS_AGUARDANDO_NOTA' },
];

const GATILHOS_MENU_FATURA: GatilhoComAcao[] = [
  { resposta: '1', proximoEstado: 'MENU_FATURA', acao: 'VER_FATURA_ATUAL' },
  { resposta: '2', proximoEstado: 'MENU_FATURA', acao: 'VER_HISTORICO_PAGAMENTOS' },
  { resposta: '3', proximoEstado: 'AGUARDANDO_FORMA_PAGAMENTO', acao: 'SOLICITAR_CONFIRMACAO_PAGAMENTO' },
  { resposta: '4', proximoEstado: 'MENU_COOPERADO', acao: 'SOLICITAR_NEGOCIACAO_HUMANA' },
];

const ETAPA_AGUARDANDO_FORMA = {
  estado: 'AGUARDANDO_FORMA_PAGAMENTO',
  nome: 'Aguardando Forma de Pagamento (ja paguei)',
  ordem: 58,
  gatilhos: [
    { resposta: '*', proximoEstado: 'MENU_COOPERADO', acao: 'SALVAR_CONFIRMACAO_PAGAMENTO' },
  ] as GatilhoComAcao[],
};

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
    console.log('═══ Bloco 8 — Menu Fatura (ULTIMO bloco do Sprint Bot Autoatendimento) ═══\n');
    console.log('  Decisao Luciano (C) MISTO: porta MENU_FATURA + "ja paguei"; nao porta');
    console.log('  MENU_INADIMPLENTE (D-novo-AC) nem NEGOCIACAO_PARCELAMENTO (D-novo-AD).\n');

    // ─────────────────────────────────────────────────────────────
    // PARTE 1 — Alinhar modelo menu_fatura
    // ─────────────────────────────────────────────────────────────
    console.log('── Parte 1: modelo menu_fatura (4 opcoes alinhadas com motor) ──');
    const modelo = await prisma.modeloMensagem.findFirst({
      where: { nome: 'menu_fatura', cooperativaId: null },
    });
    if (!modelo) {
      throw new Error(
        'Modelo menu_fatura GLOBAL nao existe. Rode primeiro fix-bloco-2-modelos-novos.ts.',
      );
    }
    if (modelo.conteudo === MODELO_MENU_FATURA_NOVO) {
      console.log('   = SKIP modelo menu_fatura ja alinhado.');
    } else {
      console.log('   ~ ATUALIZAR modelo menu_fatura');
      console.log(`     ANTES: ${modelo.conteudo.slice(0, 80)}...`);
      console.log(`     DEPOIS: ${MODELO_MENU_FATURA_NOVO.slice(0, 80)}...`);
      await prisma.modeloMensagem.update({
        where: { id: modelo.id },
        data: { conteudo: MODELO_MENU_FATURA_NOVO },
      });
    }
    console.log('');

    // ─────────────────────────────────────────────────────────────
    // PARTE 2 — MENU_COOPERADO: troca '2' pra MENU_FATURA
    // ─────────────────────────────────────────────────────────────
    console.log('── Parte 2: MENU_COOPERADO troca gatilho 2 (VER_PROXIMA_FATURA -> MENU_FATURA) ──');
    const menuCooperado = await prisma.fluxoEtapa.findFirst({
      where: { estado: 'MENU_COOPERADO', cooperativaId: null },
    });
    if (!menuCooperado) {
      throw new Error('Etapa MENU_COOPERADO GLOBAL nao existe.');
    }
    const atualMenu = Array.isArray(menuCooperado.gatilhos)
      ? (menuCooperado.gatilhos as unknown as GatilhoComAcao[])
      : [];
    if (gatilhosIguais(atualMenu, GATILHOS_MENU_COOPERADO_NOVOS)) {
      console.log('   = SKIP MENU_COOPERADO gatilhos ja alinhados.');
    } else {
      console.log(`   ~ ATUALIZAR MENU_COOPERADO (id=${menuCooperado.id})`);
      console.log(`     ANTES: ${JSON.stringify(atualMenu)}`);
      console.log(`     DEPOIS: ${JSON.stringify(GATILHOS_MENU_COOPERADO_NOVOS)}`);
      await prisma.fluxoEtapa.update({
        where: { id: menuCooperado.id },
        data: {
          gatilhos: GATILHOS_MENU_COOPERADO_NOVOS as unknown as Prisma.InputJsonValue,
        },
      });
    }
    console.log('');

    // ─────────────────────────────────────────────────────────────
    // PARTE 3 — MENU_FATURA: ativar + cabear modelo + gatilhos
    // ─────────────────────────────────────────────────────────────
    console.log('── Parte 3: MENU_FATURA ativar + cabear modelo + 4 gatilhos ──');
    const menuFatura = await prisma.fluxoEtapa.findFirst({
      where: { estado: 'MENU_FATURA', cooperativaId: null },
    });
    if (!menuFatura) {
      throw new Error('Etapa MENU_FATURA GLOBAL nao existe (esqueleto do seed esperado).');
    }
    const atualFatura = Array.isArray(menuFatura.gatilhos)
      ? (menuFatura.gatilhos as unknown as GatilhoComAcao[])
      : [];
    const precisaAtualizar =
      !gatilhosIguais(atualFatura, GATILHOS_MENU_FATURA) ||
      menuFatura.modeloMensagemId !== modelo.id ||
      !menuFatura.ativo;
    if (!precisaAtualizar) {
      console.log('   = SKIP MENU_FATURA ja alinhado.');
    } else {
      console.log(`   ~ ATUALIZAR MENU_FATURA (id=${menuFatura.id})`);
      console.log(`     ATIVO ANTES: ${menuFatura.ativo} -> DEPOIS: true`);
      console.log(`     MODELO ANTES: ${menuFatura.modeloMensagemId} -> DEPOIS: ${modelo.id}`);
      console.log(`     GATILHOS ANTES: ${JSON.stringify(atualFatura)}`);
      console.log(`     GATILHOS DEPOIS: ${JSON.stringify(GATILHOS_MENU_FATURA)}`);
      await prisma.fluxoEtapa.update({
        where: { id: menuFatura.id },
        data: {
          ativo: true,
          modeloMensagemId: modelo.id,
          gatilhos: GATILHOS_MENU_FATURA as unknown as Prisma.InputJsonValue,
        },
      });
    }
    console.log('');

    // ─────────────────────────────────────────────────────────────
    // PARTE 4 — AGUARDANDO_FORMA_PAGAMENTO (etapa nova)
    // ─────────────────────────────────────────────────────────────
    console.log('── Parte 4: AGUARDANDO_FORMA_PAGAMENTO (etapa nova wildcard) ──');
    const aguardando = await prisma.fluxoEtapa.findFirst({
      where: { estado: ETAPA_AGUARDANDO_FORMA.estado, cooperativaId: null },
    });
    if (!aguardando) {
      const novo = await prisma.fluxoEtapa.create({
        data: {
          cooperativaId: null,
          nome: ETAPA_AGUARDANDO_FORMA.nome,
          ordem: ETAPA_AGUARDANDO_FORMA.ordem,
          estado: ETAPA_AGUARDANDO_FORMA.estado,
          modeloMensagemId: null,
          gatilhos: ETAPA_AGUARDANDO_FORMA.gatilhos as unknown as Prisma.InputJsonValue,
          acaoAutomatica: null,
          ativo: true,
        },
      });
      console.log(
        `   + CRIADA AGUARDANDO_FORMA_PAGAMENTO (id=${novo.id}, wildcard -> SALVAR_CONFIRMACAO_PAGAMENTO)`,
      );
    } else {
      const atualAg = Array.isArray(aguardando.gatilhos)
        ? (aguardando.gatilhos as unknown as GatilhoComAcao[])
        : [];
      const precisaAtualizarAg =
        !gatilhosIguais(atualAg, ETAPA_AGUARDANDO_FORMA.gatilhos) ||
        aguardando.acaoAutomatica !== null ||
        !aguardando.ativo;
      if (!precisaAtualizarAg) {
        console.log('   = SKIP AGUARDANDO_FORMA_PAGAMENTO ja alinhada.');
      } else {
        console.log(`   ~ ATUALIZAR AGUARDANDO_FORMA_PAGAMENTO (id=${aguardando.id})`);
        console.log(`     ANTES: ${JSON.stringify(atualAg)}`);
        console.log(`     DEPOIS: ${JSON.stringify(ETAPA_AGUARDANDO_FORMA.gatilhos)}`);
        await prisma.fluxoEtapa.update({
          where: { id: aguardando.id },
          data: {
            gatilhos: ETAPA_AGUARDANDO_FORMA.gatilhos as unknown as Prisma.InputJsonValue,
            acaoAutomatica: null,
            ativo: true,
          },
        });
      }
    }

    console.log('\n═══ Bloco 8 aplicado com sucesso ═══');
    console.log('  Sprint Bot Autoatendimento INTEIRAMENTE FECHADO (8 blocos).');
  } catch (err) {
    console.error('\n❌ ERRO:', err instanceof Error ? err.message : err);
    process.exitCode = 1;
  } finally {
    await prisma.$disconnect();
  }
}

main();
