/**
 * Sprint Token-WA Fase 2 F2.8 (07/06/2026) — Estende submenu CooperTokens
 * com opção "3 Alterar meu limite". Idempotente.
 *
 * Aditivos:
 *  - Atualiza modelo `menu_cooper_tokens` com linha "3 Alterar meu limite"
 *  - Adiciona gatilho "3" no estado MENU_COOPERTOKENS → VER_LIMITE_TOKENS
 *  - Gatilho "alterar" em VER_LIMITE_TOKENS → ALTERAR_LIMITE_AGUARDANDO_PIN
 *  - Etapa nova: VER_LIMITE_TOKENS (ação CONSULTAR_LIMITE_TOKENS)
 *  - Etapa nova: ALTERAR_LIMITE_AGUARDANDO_PIN (wildcard → VALIDAR_PIN_ALTERAR_LIMITE)
 *  - Etapa nova: ALTERAR_LIMITE_AGUARDANDO_VALOR (wildcard → SALVAR_NOVO_LIMITE_TOKEN)
 *
 * Uso: `npx ts-node scripts/seed-menu-cooper-tokens-fase2.ts`
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
    nome: 'Ver limite CooperTokens',
    estado: 'VER_LIMITE_TOKENS',
    ordem: 63,
    acaoAutomatica: 'CONSULTAR_LIMITE_TOKENS',
    modeloNome: null,
    gatilhos: [
      { resposta: 'alterar', proximoEstado: 'ALTERAR_LIMITE_AGUARDANDO_PIN' },
      { resposta: '0', proximoEstado: 'MENU_COOPERTOKENS' },
      { resposta: 'voltar', proximoEstado: 'MENU_COOPERTOKENS' },
      { resposta: 'menu', proximoEstado: 'MENU_COOPERADO' },
    ],
  },
  {
    nome: 'Aguardando PIN pra alterar limite',
    estado: 'ALTERAR_LIMITE_AGUARDANDO_PIN',
    ordem: 64,
    acaoAutomatica: null,
    modeloNome: 'alterar_limite_pedir_pin',
    gatilhos: [
      // Wildcard: qualquer entrada vai pra ação VALIDAR_PIN_ALTERAR_LIMITE
      { resposta: '*', proximoEstado: 'ALTERAR_LIMITE_AGUARDANDO_PIN', acao: 'VALIDAR_PIN_ALTERAR_LIMITE' },
      { resposta: '0', proximoEstado: 'MENU_COOPERTOKENS' },
      { resposta: 'cancelar', proximoEstado: 'MENU_COOPERTOKENS' },
    ],
  },
  {
    nome: 'Aguardando novo valor de limite',
    estado: 'ALTERAR_LIMITE_AGUARDANDO_VALOR',
    ordem: 65,
    acaoAutomatica: null,
    modeloNome: null,
    gatilhos: [
      { resposta: '*', proximoEstado: 'ALTERAR_LIMITE_AGUARDANDO_VALOR', acao: 'SALVAR_NOVO_LIMITE_TOKEN' },
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
      '3️⃣ Alterar meu limite 🔐\n' +
      '0️⃣ Voltar ao menu',
  },
  {
    nome: 'alterar_limite_pedir_pin',
    conteudo:
      '🔐 *Alterar limite CooperToken*\n\n' +
      'Pra continuar, digite seu *PIN de 6 dígitos*.\n\n' +
      '_Se você ainda não cadastrou um PIN, acesse o portal web._\n\n' +
      'Pra cancelar, digite *0*.',
  },
];

const REPOINT_MENU_COOPERTOKENS: GatilhoNovo[] = [
  { resposta: '3', proximoEstado: 'VER_LIMITE_TOKENS' },
];

async function main(): Promise<void> {
  console.log('═══ Seed F2.8 — Opção "3 Alterar meu limite" no submenu CooperTokens ═══\n');

  // PARTE 1 — Modelos (upsert por nome+cooperativaId=null)
  console.log('── Parte 1: modelos ──');
  for (const m of MODELOS) {
    const existente = await prisma.modeloMensagem.findFirst({
      where: { nome: m.nome, cooperativaId: null },
    });
    if (!existente) {
      await prisma.modeloMensagem.create({
        data: { nome: m.nome, conteudo: m.conteudo, categoria: 'BOT', cooperativaId: null },
      });
      console.log(`  ✅ CRIADO modelo "${m.nome}"`);
    } else if (existente.conteudo !== m.conteudo) {
      await prisma.modeloMensagem.update({
        where: { id: existente.id },
        data: { conteudo: m.conteudo },
      });
      console.log(`  🔄 ATUALIZADO modelo "${m.nome}"`);
    } else {
      console.log(`  ⏭️  ja ok modelo "${m.nome}"`);
    }
  }

  const modeloPorNome = new Map<string, string>();
  for (const m of MODELOS) {
    const rec = await prisma.modeloMensagem.findFirst({
      where: { nome: m.nome, cooperativaId: null },
      select: { id: true },
    });
    if (rec) modeloPorNome.set(m.nome, rec.id);
  }

  // PARTE 2 — Etapas
  console.log('\n── Parte 2: etapas ──');
  for (const e of ETAPAS) {
    const modeloId = e.modeloNome ? modeloPorNome.get(e.modeloNome) ?? null : null;
    const gatilhosJson = (e.gatilhos ?? []) as unknown as Prisma.InputJsonValue;
    const existente = await prisma.fluxoEtapa.findFirst({
      where: { estado: e.estado, cooperativaId: null },
    });
    if (!existente) {
      await prisma.fluxoEtapa.create({
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
      console.log(`  ✅ CRIADA etapa "${e.estado}"`);
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
        console.log(`  🔄 ATUALIZADA etapa "${e.estado}"`);
      } else {
        console.log(`  ⏭️  ja ok etapa "${e.estado}"`);
      }
    }
  }

  // PARTE 3 — Adicionar gatilho "3" em MENU_COOPERTOKENS
  console.log('\n── Parte 3: gatilho "3" em MENU_COOPERTOKENS ──');
  const submenu = await prisma.fluxoEtapa.findFirst({
    where: { estado: 'MENU_COOPERTOKENS', cooperativaId: null },
  });
  if (!submenu) {
    console.error('  ❌ MENU_COOPERTOKENS não encontrado! Rode F1.3 antes.');
    process.exit(1);
  }
  const gatilhosAtuais = (Array.isArray(submenu.gatilhos)
    ? (submenu.gatilhos as unknown as GatilhoNovo[])
    : []) as GatilhoNovo[];
  const gatilhosNovos: GatilhoNovo[] = [...gatilhosAtuais];
  let mudouMenu = false;
  for (const novo of REPOINT_MENU_COOPERTOKENS) {
    const idx = gatilhosNovos.findIndex((g) => g.resposta === novo.resposta);
    if (idx === -1) {
      gatilhosNovos.push(novo);
      mudouMenu = true;
      console.log(`  ✅ ADICIONADO "${novo.resposta}" → ${novo.proximoEstado}`);
    } else if (gatilhosNovos[idx]!.proximoEstado !== novo.proximoEstado) {
      gatilhosNovos[idx] = novo;
      mudouMenu = true;
      console.log(`  🔄 REPOINTADO "${novo.resposta}" → ${novo.proximoEstado}`);
    } else {
      console.log(`  ⏭️  ja ok gatilho "${novo.resposta}"`);
    }
  }
  if (mudouMenu) {
    await prisma.fluxoEtapa.update({
      where: { id: submenu.id },
      data: { gatilhos: gatilhosNovos as unknown as Prisma.InputJsonValue },
    });
  }

  console.log('\n✅ Seed F2.8 concluído. Reinicie o backend (PM2) pra recarregar cache de fluxos.');
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
