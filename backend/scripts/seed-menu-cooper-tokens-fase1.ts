/**
 * Sprint Token-WA Fase 1 (07/06/2026) — Submenu CooperTokens read-only.
 *
 * Cria submenu `MENU_COOPERTOKENS` (estado novo) com 2 opções:
 *  - "1 Ver saldo" → executa CONSULTAR_SALDO_TOKENS
 *  - "2 Ver extrato" → executa CONSULTAR_EXTRATO_TOKENS
 *  - "0 Voltar" → volta pra MENU_COOPERADO
 *
 * Plus paginação do extrato:
 *  - estado VER_EXTRATO_TOKENS aceita gatilho wildcard ("MAIS"/qualquer)
 *    → executa EXTRATO_TOKENS_PAGINAR (avança página).
 *
 * Plus opção "3 CooperTokens" no MENU_COOPERADO → entra no submenu.
 *
 * Espelha `fix-bloco-3-menu-cooperado-saldo-fatura.ts` (padrão consolidado).
 * Idempotente — pode rodar quantas vezes quiser. Etapas e modelos GLOBAIS
 * (cooperativaId=null).
 *
 * Uso: `npx ts-node scripts/seed-menu-cooper-tokens-fase1.ts`
 */
import { Prisma, PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

interface EtapaNova {
  nome: string;
  estado: string;
  ordem: number;
  acaoAutomatica?: string | null;
  modeloNome?: string | null;
  gatilhos?: GatilhoNovo[];
}

interface GatilhoNovo {
  resposta: string;
  proximoEstado: string;
  acao?: string | null;
}

const ETAPAS: EtapaNova[] = [
  {
    nome: 'Submenu CooperTokens',
    estado: 'MENU_COOPERTOKENS',
    ordem: 60,
    modeloNome: 'menu_cooper_tokens',
    gatilhos: [
      { resposta: '1', proximoEstado: 'VER_SALDO_TOKENS' },
      { resposta: '2', proximoEstado: 'VER_EXTRATO_TOKENS' },
      { resposta: '0', proximoEstado: 'MENU_COOPERADO' },
      { resposta: 'voltar', proximoEstado: 'MENU_COOPERADO' },
    ],
  },
  {
    nome: 'Ver saldo de CooperTokens',
    estado: 'VER_SALDO_TOKENS',
    ordem: 61,
    acaoAutomatica: 'CONSULTAR_SALDO_TOKENS',
    modeloNome: null, // ação renderiza própria mensagem via saldo_tokens_resultado
    gatilhos: [
      // Após mostrar saldo, qualquer entrada volta pro submenu
      { resposta: 'voltar', proximoEstado: 'MENU_COOPERTOKENS' },
      { resposta: '0', proximoEstado: 'MENU_COOPERTOKENS' },
      { resposta: 'menu', proximoEstado: 'MENU_COOPERADO' },
    ],
  },
  {
    nome: 'Ver extrato de CooperTokens',
    estado: 'VER_EXTRATO_TOKENS',
    ordem: 62,
    acaoAutomatica: 'CONSULTAR_EXTRATO_TOKENS',
    modeloNome: null, // ação renderiza próprio extrato paginado
    gatilhos: [
      // Wildcard "MAIS" cai em EXTRATO_TOKENS_PAGINAR (motor detecta `.acao` e delega)
      { resposta: 'mais', proximoEstado: 'VER_EXTRATO_TOKENS', acao: 'EXTRATO_TOKENS_PAGINAR' },
      { resposta: 'voltar', proximoEstado: 'MENU_COOPERTOKENS' },
      { resposta: '0', proximoEstado: 'MENU_COOPERTOKENS' },
      { resposta: 'menu', proximoEstado: 'MENU_COOPERADO' },
    ],
  },
];

const MODELOS: Array<{ nome: string; conteudo: string }> = [
  {
    nome: 'menu_cooper_tokens',
    conteudo:
      '💎 *CooperTokens*\n\n' +
      'CooperTokens são *créditos de fidelidade da cooperativa* — diferentes ' +
      'do seu saldo de energia (kWh) da distribuidora.\n\n' +
      'Escolha uma opção:\n\n' +
      '1️⃣ Ver saldo\n' +
      '2️⃣ Ver extrato (10 últimas)\n' +
      '0️⃣ Voltar ao menu',
  },
  {
    nome: 'saldo_tokens_resultado',
    conteudo:
      '💎 *Seu saldo de CooperTokens*\n\n' +
      '🪙 Disponíveis: *{{saldo_disponivel}} CooperTokens*{{saldo_pendente}}\n\n' +
      '💰 Valor estimado: {{valor_estimado}}\n' +
      '_Estimativa do dia — CooperToken **NÃO é dinheiro na sua conta**. ' +
      'O valor real depende do dia do resgate/uso (depreciação temporal aplicada)._\n\n' +
      '⚠️ Não confunda com seu *saldo de energia (kWh)* da distribuidora — ' +
      'pra ver isso, volte ao menu e escolha "1 Ver saldo".\n\n' +
      '_Digite *voltar* pra retornar ao menu de CooperTokens, ou *menu* pra ' +
      'voltar ao menu principal._',
  },
];

// Adiciona "8 CooperTokens" no MENU_COOPERADO global.
// Posição 8 escolhida: 1-7 já estão ocupadas (1 saldo kWh · 2 fatura ·
// 3 atualizar cadastro/foto · 4 contrato · 5 indicar · 6/7 atendente).
// NÃO repointa nenhuma opção existente — ADITIVO PURO.
const REPOINT_MENU_COOPERADO: GatilhoNovo[] = [
  { resposta: '8', proximoEstado: 'MENU_COOPERTOKENS' },
];

// Reverte se gatilho "3" foi acidentalmente repointado pra MENU_COOPERTOKENS
// em rodada anterior do seed (defesa idempotente).
const REVERTS_MENU_COOPERADO: Array<{
  resposta: string;
  estadoOriginal: string;
}> = [
  // Em rodadas anteriores o seed encostava "3" em MENU_COOPERTOKENS. O
  // estado original era AGUARDANDO_FOTO_FATURA (atualizar cadastro envia
  // foto da fatura). Restaura se ainda estiver apontando pra COOPERTOKENS.
  { resposta: '3', estadoOriginal: 'AGUARDANDO_FOTO_FATURA' },
];

async function main(): Promise<void> {
  console.log('═══ Seed F1.3 — Submenu CooperTokens + opção 3 no MENU_COOPERADO ═══\n');

  // PARTE 1 — Modelos de mensagem (globais, sem cooperativaId)
  console.log('── Parte 1: modelos de mensagem ──');
  let modelosCriados = 0;
  let modelosAtualizados = 0;
  let modelosOk = 0;
  for (const m of MODELOS) {
    const existente = await prisma.modeloMensagem.findFirst({
      where: { nome: m.nome, cooperativaId: null },
    });
    if (!existente) {
      const novo = await prisma.modeloMensagem.create({
        data: {
          nome: m.nome,
          conteudo: m.conteudo,
          categoria: 'BOT',
          cooperativaId: null,
        },
      });
      console.log(`  ✅ CRIADO modelo "${m.nome}" id=${novo.id}`);
      modelosCriados++;
    } else if (existente.conteudo !== m.conteudo) {
      await prisma.modeloMensagem.update({
        where: { id: existente.id },
        data: { conteudo: m.conteudo },
      });
      console.log(`  🔄 ATUALIZADO modelo "${m.nome}" id=${existente.id}`);
      modelosAtualizados++;
    } else {
      console.log(`  ⏭️  ja ok modelo "${m.nome}" id=${existente.id}`);
      modelosOk++;
    }
  }
  console.log(`\nModelos: ${modelosCriados} criados · ${modelosAtualizados} atualizados · ${modelosOk} já ok\n`);

  // Mapa nome→id pra setar modeloMensagemId nas etapas
  const modeloPorNome = new Map<string, string>();
  for (const m of MODELOS) {
    const rec = await prisma.modeloMensagem.findFirst({
      where: { nome: m.nome, cooperativaId: null },
      select: { id: true },
    });
    if (rec) modeloPorNome.set(m.nome, rec.id);
  }

  // PARTE 2 — Etapas
  console.log('── Parte 2: etapas do submenu ──');
  let etapasCriadas = 0;
  let etapasAtualizadas = 0;
  let etapasOk = 0;
  for (const e of ETAPAS) {
    const modeloId = e.modeloNome ? modeloPorNome.get(e.modeloNome) ?? null : null;
    const gatilhosJson = (e.gatilhos ?? []) as unknown as Prisma.InputJsonValue;

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
          gatilhos: gatilhosJson,
          acaoAutomatica: e.acaoAutomatica ?? null,
          ativo: true,
        },
      });
      console.log(`  ✅ CRIADA etapa "${e.estado}" id=${novo.id}`);
      etapasCriadas++;
    } else {
      const precisaAtualizar =
        existente.acaoAutomatica !== (e.acaoAutomatica ?? null) ||
        existente.modeloMensagemId !== modeloId ||
        existente.nome !== e.nome ||
        existente.ordem !== e.ordem ||
        JSON.stringify(existente.gatilhos) !== JSON.stringify(e.gatilhos ?? []) ||
        existente.ativo !== true;

      if (precisaAtualizar) {
        await prisma.fluxoEtapa.update({
          where: { id: existente.id },
          data: {
            nome: e.nome,
            ordem: e.ordem,
            modeloMensagemId: modeloId,
            gatilhos: gatilhosJson,
            acaoAutomatica: e.acaoAutomatica ?? null,
            ativo: true,
          },
        });
        console.log(`  🔄 ATUALIZADA etapa "${e.estado}" id=${existente.id}`);
        etapasAtualizadas++;
      } else {
        console.log(`  ⏭️  ja ok etapa "${e.estado}" id=${existente.id}`);
        etapasOk++;
      }
    }
  }
  console.log(`\nEtapas: ${etapasCriadas} criadas · ${etapasAtualizadas} atualizadas · ${etapasOk} já ok\n`);

  // PARTE 3 — Adicionar "3" no MENU_COOPERADO
  console.log('── Parte 3: opção 3 no MENU_COOPERADO ──');
  const menu = await prisma.fluxoEtapa.findFirst({
    where: { estado: 'MENU_COOPERADO', cooperativaId: null },
  });
  if (!menu) {
    console.error('  ❌ MENU_COOPERADO global não encontrado! Seed abortado.');
    process.exit(1);
  }
  const gatilhosAtuais = (Array.isArray(menu.gatilhos)
    ? (menu.gatilhos as unknown as GatilhoNovo[])
    : []) as GatilhoNovo[];
  const gatilhosNovos: GatilhoNovo[] = [...gatilhosAtuais];
  let mudouMenu = false;

  // Reverte se gatilho foi repointado por engano em rodada anterior
  for (const rev of REVERTS_MENU_COOPERADO) {
    const idx = gatilhosNovos.findIndex((g) => g.resposta === rev.resposta);
    if (idx !== -1 && gatilhosNovos[idx]!.proximoEstado === 'MENU_COOPERTOKENS') {
      gatilhosNovos[idx] = {
        resposta: rev.resposta,
        proximoEstado: rev.estadoOriginal,
      };
      console.log(
        `  ↩️  REVERTIDO gatilho "${rev.resposta}": MENU_COOPERTOKENS → ${rev.estadoOriginal} (estado original)`,
      );
      mudouMenu = true;
    }
  }

  for (const novo of REPOINT_MENU_COOPERADO) {
    const idx = gatilhosNovos.findIndex((g) => g.resposta === novo.resposta);
    if (idx === -1) {
      gatilhosNovos.push(novo);
      console.log(`  ✅ ADICIONADO gatilho "${novo.resposta}" → ${novo.proximoEstado}`);
      mudouMenu = true;
    } else {
      const atual = gatilhosNovos[idx]!;
      if (atual.proximoEstado !== novo.proximoEstado) {
        gatilhosNovos[idx] = novo;
        console.log(
          `  🔄 REPOINTADO gatilho "${novo.resposta}": ${atual.proximoEstado} → ${novo.proximoEstado}`,
        );
        mudouMenu = true;
      } else {
        console.log(`  ⏭️  já ok gatilho "${novo.resposta}" → ${novo.proximoEstado}`);
      }
    }
  }

  if (mudouMenu) {
    await prisma.fluxoEtapa.update({
      where: { id: menu.id },
      data: { gatilhos: gatilhosNovos as unknown as Prisma.InputJsonValue },
    });
    console.log(`  ✅ MENU_COOPERADO atualizado (id=${menu.id}, ${gatilhosNovos.length} gatilhos)`);
  }

  // PARTE 4 — Adicionar linha "8 CooperTokens" no modelo do MENU_COOPERADO
  console.log('\n── Parte 4: modelo do MENU_COOPERADO (adicionar linha "8 CooperTokens") ──');
  if (!menu.modeloMensagemId) {
    console.log('  ⏭️  MENU_COOPERADO sem modeloMensagemId — não tem o que atualizar.');
  } else {
    const modeloMenu = await prisma.modeloMensagem.findUnique({
      where: { id: menu.modeloMensagemId },
    });
    if (!modeloMenu) {
      console.log('  ⏭️  Modelo do MENU_COOPERADO não encontrado.');
    } else if (modeloMenu.conteudo.includes('CooperTokens')) {
      console.log('  ⏭️  Modelo já menciona CooperTokens — nada a fazer.');
    } else {
      // Adiciona linha "8 CooperTokens" ANTES da linha "AVALIAR" se houver,
      // senão no final.
      const linhaNova = '8️⃣ 💎 CooperTokens';
      const novo = modeloMenu.conteudo.includes('AVALIAR')
        ? modeloMenu.conteudo.replace(/(\n+.*AVALIAR.*)/, `\n${linhaNova}$1`)
        : modeloMenu.conteudo + '\n' + linhaNova;
      await prisma.modeloMensagem.update({
        where: { id: modeloMenu.id },
        data: { conteudo: novo },
      });
      console.log(`  ✅ Modelo MENU_COOPERADO atualizado com "8 CooperTokens"`);
    }
  }

  console.log('\n✅ Seed F1.3 concluído. Reinicie o backend pra garantir cache de fluxos.');
  await prisma.$disconnect();
}

main().catch(async (e) => {
  console.error('FATAL:', e);
  await prisma.$disconnect();
  process.exit(1);
});
