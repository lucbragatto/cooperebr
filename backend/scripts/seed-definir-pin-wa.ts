/**
 * F1 (09/06/2026) — Seed do fluxo "Definir PIN" no submenu CooperTokens.
 *
 * Aditivos (idempotente):
 *  - Atualiza modelo `menu_cooper_tokens` adicionando linha "4 Definir PIN".
 *  - Adiciona gatilho "4" no estado MENU_COOPERTOKENS → DEFINIR_PIN_AGUARDANDO_OTP.
 *  - 3 etapas novas:
 *      DEFINIR_PIN_AGUARDANDO_OTP (acaoAutomatica=INICIAR_DEFINIR_PIN;
 *        gatilho wildcard "*" → mesma etapa com acao=VALIDAR_OTP_PIN_DEFINIR)
 *      DEFINIR_PIN_AGUARDANDO_PIN (gatilho wildcard com acao=RECEBER_NOVO_PIN_DEFINICAO)
 *      DEFINIR_PIN_AGUARDANDO_CONFIRMACAO (gatilho wildcard com acao=CONFIRMAR_PIN_DEFINICAO)
 *
 * As mensagens enviadas no fluxo sao montadas INLINE pelos metodos do service
 * (porque dependem de dados dinamicos: codigo OTP, ultimos 4 do CPF mascarado,
 * pinProposto persistido em dadosTemp). Logo, nao ha modelo de mensagem pra
 * cada etapa — so o gatilho/transicao. acaoAutomatica do AGUARDANDO_OTP cuida
 * de enviar a 1a mensagem (com o OTP).
 *
 * Uso: `npx ts-node scripts/seed-definir-pin-wa.ts`
 */
import { Prisma, PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

interface GatilhoNovo {
  resposta: string;
  proximoEstado: string;
  acao?: string | null;
}

interface EtapaNova {
  nome: string;
  estado: string;
  ordem: number;
  acaoAutomatica?: string | null;
  modeloNome?: string | null;
  gatilhos?: GatilhoNovo[];
}

const ETAPAS: EtapaNova[] = [
  {
    nome: 'Definir PIN - aguardando OTP + dado pessoal',
    estado: 'DEFINIR_PIN_AGUARDANDO_OTP',
    ordem: 66,
    acaoAutomatica: 'INICIAR_DEFINIR_PIN',
    modeloNome: null,
    gatilhos: [
      // Cancelar: comandos universais MENU/SAIR ja sao tratados pelo motor.
      { resposta: '0', proximoEstado: 'MENU_COOPERTOKENS' },
      { resposta: 'cancelar', proximoEstado: 'MENU_COOPERTOKENS' },
      // Wildcard: qualquer outra entrada vai pra acao VALIDAR_OTP_PIN_DEFINIR.
      { resposta: '*', proximoEstado: 'DEFINIR_PIN_AGUARDANDO_OTP', acao: 'VALIDAR_OTP_PIN_DEFINIR' },
    ],
  },
  {
    nome: 'Definir PIN - aguardando PIN escolhido',
    estado: 'DEFINIR_PIN_AGUARDANDO_PIN',
    ordem: 67,
    acaoAutomatica: null,
    modeloNome: null,
    gatilhos: [
      { resposta: '0', proximoEstado: 'MENU_COOPERTOKENS' },
      { resposta: 'cancelar', proximoEstado: 'MENU_COOPERTOKENS' },
      { resposta: '*', proximoEstado: 'DEFINIR_PIN_AGUARDANDO_PIN', acao: 'RECEBER_NOVO_PIN_DEFINICAO' },
    ],
  },
  {
    nome: 'Definir PIN - aguardando confirmacao',
    estado: 'DEFINIR_PIN_AGUARDANDO_CONFIRMACAO',
    ordem: 68,
    acaoAutomatica: null,
    modeloNome: null,
    gatilhos: [
      { resposta: '0', proximoEstado: 'MENU_COOPERTOKENS' },
      { resposta: 'cancelar', proximoEstado: 'MENU_COOPERTOKENS' },
      { resposta: '*', proximoEstado: 'DEFINIR_PIN_AGUARDANDO_CONFIRMACAO', acao: 'CONFIRMAR_PIN_DEFINICAO' },
    ],
  },
];

const MODELO_MENU_COOPERTOKENS_NOVO =
  '💎 *CooperTokens*\n\n' +
  'CooperTokens são *créditos de fidelidade da cooperativa* — diferentes ' +
  'do seu saldo de energia (kWh) da distribuidora.\n\n' +
  'Escolha uma opção:\n\n' +
  '1️⃣ Ver saldo\n' +
  '2️⃣ Ver extrato (10 últimas)\n' +
  '3️⃣ Alterar meu limite 🔐\n' +
  '4️⃣ Definir PIN 🔐\n' +
  '0️⃣ Voltar ao menu';

const NOVO_GATILHO_MENU: GatilhoNovo = {
  resposta: '4',
  proximoEstado: 'DEFINIR_PIN_AGUARDANDO_OTP',
};

async function main(): Promise<void> {
  console.log('═══ Seed F1 — Fluxo "Definir PIN" no submenu CooperTokens ═══\n');

  // PARTE 1 — Atualiza modelo menu_cooper_tokens (adiciona linha "4")
  console.log('── Parte 1: modelo menu_cooper_tokens ──');
  const menuModelo = await prisma.modeloMensagem.findFirst({
    where: { nome: 'menu_cooper_tokens', cooperativaId: null },
  });
  if (!menuModelo) {
    console.error('  ❌ Modelo menu_cooper_tokens nao encontrado. Rode seed F1.3/F2.8 antes.');
    process.exit(1);
  }
  if (menuModelo.conteudo !== MODELO_MENU_COOPERTOKENS_NOVO) {
    await prisma.modeloMensagem.update({
      where: { id: menuModelo.id },
      data: { conteudo: MODELO_MENU_COOPERTOKENS_NOVO },
    });
    console.log('  🔄 ATUALIZADO modelo menu_cooper_tokens (linha "4" adicionada)');
  } else {
    console.log('  ⏭️  ja ok modelo menu_cooper_tokens');
  }

  // PARTE 2 — Etapas
  console.log('\n── Parte 2: etapas ──');
  for (const e of ETAPAS) {
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
          modeloMensagemId: null,
          gatilhos: gatilhosJson,
          acaoAutomatica: e.acaoAutomatica ?? null,
          ativo: true,
        },
      });
      console.log(`  ✅ CRIADA etapa "${e.estado}"`);
    } else {
      const precisaAtualizar =
        existente.acaoAutomatica !== (e.acaoAutomatica ?? null) ||
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
            modeloMensagemId: null,
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

  // PARTE 3 — Adicionar gatilho "4" em MENU_COOPERTOKENS
  console.log('\n── Parte 3: gatilho "4" em MENU_COOPERTOKENS ──');
  const submenu = await prisma.fluxoEtapa.findFirst({
    where: { estado: 'MENU_COOPERTOKENS', cooperativaId: null },
  });
  if (!submenu) {
    console.error('  ❌ MENU_COOPERTOKENS nao encontrado! Rode seeds F1.3/F2.8 antes.');
    process.exit(1);
  }
  const gatilhosAtuais = (Array.isArray(submenu.gatilhos)
    ? (submenu.gatilhos as unknown as GatilhoNovo[])
    : []) as GatilhoNovo[];
  const gatilhosNovos: GatilhoNovo[] = [...gatilhosAtuais];
  const idx = gatilhosNovos.findIndex((g) => g.resposta === NOVO_GATILHO_MENU.resposta);
  if (idx === -1) {
    gatilhosNovos.push(NOVO_GATILHO_MENU);
    console.log(`  ✅ ADICIONADO "${NOVO_GATILHO_MENU.resposta}" → ${NOVO_GATILHO_MENU.proximoEstado}`);
  } else if (gatilhosNovos[idx]!.proximoEstado !== NOVO_GATILHO_MENU.proximoEstado) {
    gatilhosNovos[idx] = NOVO_GATILHO_MENU;
    console.log(`  🔄 REPOINTADO "${NOVO_GATILHO_MENU.resposta}" → ${NOVO_GATILHO_MENU.proximoEstado}`);
  } else {
    console.log(`  ⏭️  ja ok gatilho "${NOVO_GATILHO_MENU.resposta}"`);
  }
  await prisma.fluxoEtapa.update({
    where: { id: submenu.id },
    data: { gatilhos: gatilhosNovos as unknown as Prisma.InputJsonValue },
  });

  console.log('\n✅ Seed F1 concluido. Reinicie o backend (PM2) pra recarregar cache de fluxos.');
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
