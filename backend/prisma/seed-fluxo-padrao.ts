import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

/**
 * Templates GLOBAIS do Assis (cooperativaId = null).
 *
 * Conteudo identico ao seed original — apenas parametrizado com variaveis
 * de tenant introduzidas nas Fases 2 e 6 do refator do Assis:
 *
 *   {{parceiro}}              nome da cooperativa/consorcio/associacao/condominio
 *   {{site}}                  TODO (campo nao existe no schema ainda; fallback vazio)
 *   {{tipo_membro}}           cooperado | consorciado | associado | condomino | membro
 *   {{tipo_membro_plural}}    plural correspondente
 *   {{email_suporte}}         Cooperativa.email
 *   {{telefone_suporte}}      Cooperativa.telefone
 *
 * Convencao: cooperativaId = null = template global. Cada cooperativa pode
 * sobrescrever individualmente (Fase 7 futura — auto-clone ao criar tenant).
 *
 * Emojis preservados do seed original. DEBITO P3 aberto: revisar tom +
 * criar variantes _padrao (com emojis) / _neutro (sem) por categoria de
 * parceiro (associacoes profissionais como AESMP/ASSEJUFES preferem tom
 * mais formal).
 */

// ============================================================================
// Modelos de mensagem — 11 originais (parametrizados) + 6 modernos novos
// ============================================================================

const modelosMensagem = [
  // ---------- ORIGINAIS PARAMETRIZADOS (Fase 6) ----------
  {
    id: 'msg-boas-vindas',
    nome: 'boas_vindas',
    categoria: 'BOT',
    conteudo:
      '👋 Olá! Sou o assistente da *{{parceiro}}*.\n\nPara começar, envie uma *foto* ou *PDF* da sua conta de energia elétrica e eu faço uma simulação de economia para você! 📸',
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
      '🌱 *Sua simulação {{parceiro}}:*\n\n📊 Fatura média atual: R$ {{valorFaturaMedia}}\n💚 Com a {{parceiro}}: R$ {{valorComDesconto}} (-{{desconto}}%)\n💵 Economia mensal: R$ {{economiaMensal}}\n📅 Economia anual: R$ {{economiaAnual}}\n{{mesesGratis}}\nQuer receber a proposta completa em PDF?\nResponda *SIM*',
  },
  {
    id: 'msg-proposta-pdf',
    nome: 'proposta_pdf',
    categoria: 'BOT',
    conteudo:
      '📋 *PROPOSTA {{parceiro}}*\n━━━━━━━━━━━━━━━━━━━━\n\n👤 *{{titular}}*\n📍 {{endereco}}\n🔌 UC: {{uc}}\n\n📊 *Dados da simulação:*\n• Consumo considerado: {{kwhContrato}} kWh/mês\n• Desconto: {{desconto}}%\n• Economia mensal: R$ {{economiaMensal}}\n• Economia anual: R$ {{economiaAnual}}\n\n━━━━━━━━━━━━━━━━━━━━\n_Proposta válida por 30 dias_',
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
      'Estou aqui para ajudar! Para falar com nossa equipe, acesse: {{site}}\n\nOu envie a foto da sua conta de luz para gerar uma simulação gratuita! 📸',
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
      'Olá {{nome}}! 😊\n\nSua fatura {{parceiro}} referente a {{mes}} está disponível.\n\n💰 Valor: R$ {{valor}}\n📅 Vencimento: {{vencimento}}\n\n🔗 Pague aqui: {{link_pagamento}}\n\nQualquer dúvida, estamos à disposição!',
  },
  {
    id: 'msg-convite-mlm',
    nome: 'convite_mlm',
    categoria: 'MLM',
    conteudo:
      'Olá {{nome}}! 🌱\n\nVocê sabia que pode ganhar {{percentual}}% de desconto indicando amigos para a {{parceiro}}?\n\nCompartilhe seu link exclusivo:\n🔗 {{link}}\n\nCada indicação que aderir, você economiza mais na sua conta de energia! ⚡',
  },

  // ---------- 6 FLUXOS MODERNOS PARAMETRIZADOS (Fase 6 novos) ----------
  {
    id: 'msg-lembrete-vencimento-d3',
    nome: 'lembrete_vencimento_d3',
    categoria: 'COBRANCA',
    conteudo:
      '⏰ Oi {{nome}}!\n\nLembrete amigável: sua fatura {{parceiro}} de {{mes}} vence em *3 dias* ({{vencimento}}).\n\n💰 Valor: R$ {{valor}}\n🔗 Pague rápido via PIX: {{link_pagamento}}\n\nSe já pagou, ignore esta mensagem. Obrigado! 💚',
  },
  {
    id: 'msg-pagamento-confirmado',
    nome: 'pagamento_confirmado',
    categoria: 'COBRANCA',
    conteudo:
      '✅ Pagamento recebido, {{nome}}!\n\nObrigado por manter sua assinatura {{parceiro}} em dia.\n\n💰 Valor: R$ {{valor}}\n📅 Referente a: {{mes}}\n\nSeu próximo ciclo já está garantido. 🌱',
  },
  {
    id: 'msg-geracao-baixa-mes',
    nome: 'geracao_baixa_mes',
    categoria: 'BOT',
    conteudo:
      '📉 Oi {{nome}}, transparência total:\n\nNeste mês ({{mes}}) a geração das usinas {{parceiro}} ficou *abaixo do esperado* — chuvas/nuvens reduziram a produção solar.\n\n💡 Como você é {{tipo_membro}}, seu crédito kWh deste mês será menor que a média.\nIsso normaliza nos próximos meses (geração compensa). Qualquer dúvida estamos no {{telefone_suporte}}.',
  },
  {
    id: 'msg-onboarding-30d',
    nome: 'onboarding_30d',
    categoria: 'BOT',
    conteudo:
      '🎓 Olá {{nome}}, parabéns pelos primeiros 30 dias na {{parceiro}}!\n\nComo {{tipo_membro}}, seu crédito kWh aparece na conta da concessionária assim:\n\n1️⃣ Olhe a linha *"Energia injetada SCEE"* — é o seu crédito\n2️⃣ Compare com o consumo do mês — a diferença é o que você paga\n3️⃣ Acumula saldo se gerar mais que consome\n\nDúvidas? Responda *AJUDA* ou ligue {{telefone_suporte}}.',
  },
  {
    id: 'msg-nps-trimestral',
    nome: 'nps_trimestral',
    categoria: 'BOT',
    conteudo:
      '📊 Oi {{nome}}!\n\nFaz 3 meses que você é {{tipo_membro}} da {{parceiro}}. De *0 a 10*, qual a chance de você nos indicar pra um amigo?\n\nResponda apenas com o número. Sua opinião nos ajuda muito! 🙏',
  },
  {
    id: 'msg-reengajamento-60d',
    nome: 'reengajamento_60d',
    categoria: 'BOT',
    conteudo:
      '👋 Oi {{nome}}, sentimos sua falta!\n\nVi que você começou uma simulação na {{parceiro}} há 2 meses e não finalizou.\n\n🌱 A economia que calculamos pra você continua disponível. Quer retomar?\n\nResponda *SIM* pra continuar do onde parou\nou *NÃO* se prefere parar de receber estas mensagens.',
  },
];

// ============================================================================
// FluxoEtapas — mapeam o fluxo hardcoded original (preservadas)
// ============================================================================

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

async function main(): Promise<void> {
  console.log('=== Seed: Fluxo padrao do bot Assis (Fase 6 parametrizado) ===\n');

  console.log('--- Modelos de mensagem (11 originais + 6 modernos) ---');
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
    console.log(`  upsert ${msg.nome} (${msg.categoria})`);
  }

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
    console.log(`  upsert #${etapa.ordem} ${etapa.nome} (${etapa.estado})`);
  }

  console.log(`\nOK ${modelosMensagem.length} modelos + ${fluxoEtapas.length} etapas criados/atualizados.`);
}

main()
  .catch((e: unknown) => {
    const message = e instanceof Error ? e.message : 'erro desconhecido';
    console.error(`Falha no seed: ${message}`);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
