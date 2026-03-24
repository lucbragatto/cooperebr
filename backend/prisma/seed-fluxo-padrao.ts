import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// ─── Modelos de mensagem padrão ──────────────────────────────────────────────

const modelosMensagem = [
  {
    id: 'msg-boas-vindas',
    nome: 'boas_vindas',
    categoria: 'BOT',
    conteudo:
      '👋 Olá! Sou o assistente da *CoopereBR*.\n\nPara começar, envie uma *foto* ou *PDF* da sua conta de energia elétrica e eu faço uma simulação de economia para você! 📸',
  },
  {
    id: 'msg-processando-fatura',
    nome: 'processando_fatura',
    categoria: 'BOT',
    conteudo: '📄 Recebi sua fatura! Analisando os dados... Aguarde um momento. ⏳',
  },
  {
    id: 'msg-confirmacao-dados',
    nome: 'confirmacao_dados',
    categoria: 'BOT',
    conteudo:
      '📊 *Dados extraídos da sua fatura:*\n\n{{historico}}\n\n_Algum dado incorreto? Corrija no formato:_\n_02/26 350 kwh R$ 287,50_\n\n_Tudo certo? Responda *OK*_',
  },
  {
    id: 'msg-simulacao-resultado',
    nome: 'simulacao_resultado',
    categoria: 'BOT',
    conteudo:
      '🌱 *Sua simulação CoopereBR:*\n\n📊 Fatura média atual: R$ {{valorFaturaMedia}}\n💚 Com a CoopereBR: R$ {{valorComDesconto}} (-{{desconto}}%)\n💵 Economia mensal: R$ {{economiaMensal}}\n📅 Economia anual: R$ {{economiaAnual}}\n{{mesesGratis}}\nQuer receber a proposta completa em PDF?\nResponda *SIM*',
  },
  {
    id: 'msg-proposta-pdf',
    nome: 'proposta_pdf',
    categoria: 'BOT',
    conteudo:
      '📋 *PROPOSTA COOPEREBR*\n━━━━━━━━━━━━━━━━━━━━\n\n👤 *{{titular}}*\n📍 {{endereco}}\n🔌 UC: {{uc}}\n\n📊 *Dados da simulação:*\n• Consumo considerado: {{kwhContrato}} kWh/mês\n• Desconto: {{desconto}}%\n• Economia mensal: R$ {{economiaMensal}}\n• Economia anual: R$ {{economiaAnual}}\n\n━━━━━━━━━━━━━━━━━━━━\n_Proposta válida por 30 dias_',
  },
  {
    id: 'msg-confirmacao-cadastro',
    nome: 'confirmacao_cadastro',
    categoria: 'BOT',
    conteudo:
      '✅ *Seus dados para cadastro:*\n\n👤 {{titular}}\n📍 {{endereco}}\n🔌 UC: {{uc}}\n\nEstá correto? Responda *CONFIRMO* para prosseguir\nou me diga o que precisa corrigir.',
  },
  {
    id: 'msg-cadastro-sucesso',
    nome: 'cadastro_sucesso',
    categoria: 'BOT',
    conteudo:
      '🎉 Perfeito! Seu pré-cadastro foi criado com sucesso!\n\nNossa equipe entrará em contato em breve para finalizar. Qualquer dúvida é só perguntar! 💚',
  },
  {
    id: 'msg-ajuda',
    nome: 'ajuda',
    categoria: 'BOT',
    conteudo:
      'Estou aqui para ajudar! Para falar com nossa equipe, acesse: cooperebr.com.br\n\nOu envie a foto da sua conta de luz para gerar uma simulação gratuita! 📸',
  },
  {
    id: 'msg-cancelar',
    nome: 'cancelar',
    categoria: 'BOT',
    conteudo: 'Tudo bem! Se quiser começar novamente, é só mandar a foto da sua conta de luz. 😊',
  },
  {
    id: 'msg-cobranca-mensal',
    nome: 'cobranca_mensal',
    categoria: 'COBRANCA',
    conteudo:
      'Olá {{nome}}! 😊\n\nSua fatura CoopereBR referente a {{mes}} está disponível.\n\n💰 Valor: R$ {{valor}}\n📅 Vencimento: {{vencimento}}\n\n🔗 Pague aqui: {{link_pagamento}}\n\nQualquer dúvida, estamos à disposição!',
  },
  {
    id: 'msg-convite-mlm',
    nome: 'convite_mlm',
    categoria: 'MLM',
    conteudo:
      'Olá {{nome}}! 🌱\n\nVocê sabia que pode ganhar {{percentual}}% de desconto indicando amigos para a CoopereBR?\n\nCompartilhe seu link exclusivo:\n🔗 {{link}}\n\nCada indicação que aderir, você economiza mais na sua conta de energia! ⚡',
  },
];

// ─── FluxoEtapas padrão (mapeando o fluxo hardcoded do bot) ────────────────

const fluxoEtapas = [
  {
    id: 'fluxo-inicial',
    nome: 'Receber fatura',
    ordem: 1,
    estado: 'INICIAL',
    modeloMensagemId: 'msg-boas-vindas',
    gatilhos: [],
    acaoAutomatica: null,
  },
  {
    id: 'fluxo-confirmacao-dados',
    nome: 'Confirmar dados extraídos',
    ordem: 2,
    estado: 'AGUARDANDO_CONFIRMACAO_DADOS',
    modeloMensagemId: 'msg-confirmacao-dados',
    gatilhos: [
      { resposta: 'OK', proximoEstado: 'AGUARDANDO_CONFIRMACAO_PROPOSTA' },
    ],
    acaoAutomatica: 'GERAR_PROPOSTA',
  },
  {
    id: 'fluxo-confirmacao-proposta',
    nome: 'Confirmar proposta',
    ordem: 3,
    estado: 'AGUARDANDO_CONFIRMACAO_PROPOSTA',
    modeloMensagemId: 'msg-simulacao-resultado',
    gatilhos: [
      { resposta: 'SIM', proximoEstado: 'AGUARDANDO_CONFIRMACAO_CADASTRO' },
    ],
    acaoAutomatica: null,
  },
  {
    id: 'fluxo-confirmacao-cadastro',
    nome: 'Confirmar cadastro',
    ordem: 4,
    estado: 'AGUARDANDO_CONFIRMACAO_CADASTRO',
    modeloMensagemId: 'msg-confirmacao-cadastro',
    gatilhos: [
      { resposta: 'CONFIRMO', proximoEstado: 'CONCLUIDO' },
    ],
    acaoAutomatica: 'CRIAR_LEAD',
  },
  {
    id: 'fluxo-concluido',
    nome: 'Fluxo concluído',
    ordem: 5,
    estado: 'CONCLUIDO',
    modeloMensagemId: 'msg-cadastro-sucesso',
    gatilhos: [],
    acaoAutomatica: 'NOTIFICAR_EQUIPE',
  },
];

async function main() {
  console.log('=== Seed: Fluxo padrão do bot CoopereBR ===\n');

  // 1. Upsert modelos de mensagem
  console.log('--- Modelos de mensagem ---');
  for (const msg of modelosMensagem) {
    await prisma.modeloMensagem.upsert({
      where: { id: msg.id },
      update: {
        nome: msg.nome,
        categoria: msg.categoria,
        conteudo: msg.conteudo,
      },
      create: {
        id: msg.id,
        nome: msg.nome,
        categoria: msg.categoria,
        conteudo: msg.conteudo,
        cooperativaId: null,
        ativo: true,
      },
    });
    console.log(`  ✓ ${msg.nome} (${msg.categoria})`);
  }

  // 2. Upsert etapas do fluxo
  console.log('\n--- Etapas do fluxo ---');
  for (const etapa of fluxoEtapas) {
    await prisma.fluxoEtapa.upsert({
      where: { id: etapa.id },
      update: {
        nome: etapa.nome,
        ordem: etapa.ordem,
        estado: etapa.estado,
        modeloMensagemId: etapa.modeloMensagemId,
        gatilhos: etapa.gatilhos,
        acaoAutomatica: etapa.acaoAutomatica,
      },
      create: {
        id: etapa.id,
        nome: etapa.nome,
        ordem: etapa.ordem,
        estado: etapa.estado,
        modeloMensagemId: etapa.modeloMensagemId,
        gatilhos: etapa.gatilhos,
        acaoAutomatica: etapa.acaoAutomatica,
        cooperativaId: null,
        ativo: true,
      },
    });
    console.log(`  ✓ #${etapa.ordem} ${etapa.nome} (${etapa.estado})`);
  }

  console.log(`\n✅ ${modelosMensagem.length} modelos + ${fluxoEtapas.length} etapas criados/atualizados.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
