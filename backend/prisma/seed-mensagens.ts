import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const mensagens = [
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
    //Enviada ao receber fatura para OCR',
    categoria: 'BOT',
    conteudo: '📄 Recebi sua fatura! Analisando os dados... Aguarde um momento. ⏳',
  },
  {
    id: 'msg-confirmacao-dados',
    nome: 'confirmacao_dados',
    //Template de confirmação dos dados extraídos da fatura',
    categoria: 'BOT',
    conteudo:
      '📊 *Dados extraídos da sua fatura:*\n\n{{historico}}\n\n_Algum dado incorreto? Corrija no formato:_\n_02/26 350 kwh R$ 287,50_\n\n_Tudo certo? Responda *OK*_',
  },
  {
    id: 'msg-simulacao-resultado',
    nome: 'simulacao_resultado',
    //Resultado da simulação de economia',
    categoria: 'BOT',
    conteudo:
      '🌱 *Sua simulação {{parceiro}}:*\n\n📊 Fatura média atual: R$ {{valorFaturaMedia}}\n💚 Com a {{parceiro}}: R$ {{valorComDesconto}} (-{{desconto}}%)\n💵 Economia mensal: R$ {{economiaMensal}}\n📅 Economia anual: R$ {{economiaAnual}}\n\nQuer receber a proposta completa em PDF?\nResponda *SIM*',
  },
  {
    id: 'msg-proposta-pdf',
    nome: 'proposta_pdf',
    //Proposta resumo enviada como texto (PDF futuro)',
    categoria: 'BOT',
    conteudo:
      '📋 *PROPOSTA {{parceiro}}*\n━━━━━━━━━━━━━━━━━━━━\n\n👤 *{{titular}}*\n📍 {{endereco}}\n🔌 UC: {{uc}}\n\n📊 *Dados da simulação:*\n• Consumo considerado: {{kwhContrato}} kWh/mês\n• Desconto: {{desconto}}%\n• Economia mensal: R$ {{economiaMensal}}\n• Economia anual: R$ {{economiaAnual}}\n\n━━━━━━━━━━━━━━━━━━━━\n_Proposta válida por 30 dias_',
  },
  {
    id: 'msg-confirmacao-cadastro',
    nome: 'confirmacao_cadastro',
    //Confirmação de dados para cadastro do cooperado',
    categoria: 'BOT',
    conteudo:
      '✅ *Seus dados para cadastro:*\n\n👤 {{titular}}\n📍 {{endereco}}\n🔌 UC: {{uc}}\n\nEstá correto? Responda *CONFIRMO* para prosseguir\nou me diga o que precisa corrigir.',
  },
  {
    id: 'msg-cadastro-sucesso',
    nome: 'cadastro_sucesso',
    //Mensagem final de pré-cadastro criado',
    categoria: 'BOT',
    conteudo:
      '🎉 Perfeito! Seu pré-cadastro foi criado com sucesso!\n\nNossa equipe entrará em contato em breve para finalizar. Qualquer dúvida é só perguntar! 💚',
  },
  {
    id: 'msg-ajuda',
    nome: 'ajuda',
    //Resposta para ajuda/help/dúvida',
    categoria: 'BOT',
    conteudo:
      'Estou aqui para ajudar! Para falar com nossa equipe da {{parceiro}}, é só responder por aqui — ou ligue para {{telefone_suporte}}.\n\nOu envie a foto da sua conta de luz para gerar uma simulação gratuita! 📸',
  },
  {
    id: 'msg-cancelar',
    nome: 'cancelar',
    //Resposta para cancelar/cancel',
    categoria: 'BOT',
    conteudo: 'Tudo bem! Se quiser começar novamente, é só mandar a foto da sua conta de luz. 😊',
  },
  // ── Bloco 2 Sprint Bot Autoatendimento (21/05) — 11 modelos pros Blocos 4/6/7/8 ──
  {
    id: 'msg-proxy-pedindo-nome',
    nome: 'proxy_pedindo_nome',
    categoria: 'BOT',
    conteudo:
      'Que bom que você quer trazer um amigo pra perto! 🤝\nQual o *nome completo* dele(a)?',
  },
  {
    id: 'msg-proxy-pedindo-telefone',
    nome: 'proxy_pedindo_telefone',
    categoria: 'BOT',
    conteudo: 'Anotado! E qual o *WhatsApp* do seu amigo? (com DDD — ex: 27 99999-9999)',
  },
  {
    id: 'msg-proxy-pedindo-fatura',
    nome: 'proxy_pedindo_fatura',
    categoria: 'BOT',
    conteudo:
      'Perfeito! 📸 Agora me envie uma *foto* ou *PDF* da conta de luz dele(a) — assim já calculo quanto vai economizar.',
  },
  {
    id: 'msg-proxy-confirmar',
    nome: 'proxy_confirmar',
    categoria: 'BOT',
    conteudo:
      'Confere os dados do seu indicado:\n👤 {{titular}}\n📱 {{telefone}}\n\n1️⃣ Tudo certo, pode cadastrar\n2️⃣ Corrigir',
  },
  {
    id: 'msg-aguardando-novo-nome',
    nome: 'aguardando_novo_nome',
    categoria: 'BOT',
    conteudo: 'Qual o seu *nome completo* atualizado?',
  },
  {
    id: 'msg-aguardando-novo-email',
    nome: 'aguardando_novo_email',
    categoria: 'BOT',
    conteudo: 'Qual o seu *e-mail* atualizado?',
  },
  {
    id: 'msg-aguardando-novo-telefone',
    nome: 'aguardando_novo_telefone',
    categoria: 'BOT',
    conteudo: 'Qual o seu *telefone* atualizado? (com DDD)',
  },
  {
    id: 'msg-aguardando-novo-cep',
    nome: 'aguardando_novo_cep',
    categoria: 'BOT',
    conteudo: 'Qual o seu *CEP* atualizado? (formato 00000-000)',
  },
  {
    id: 'msg-menu-inadimplente',
    nome: 'menu_inadimplente',
    categoria: 'BOT',
    conteudo:
      'Oi {{nome}}! Vi que sua fatura de {{mes}} está em aberto. 💛\nPosso te ajudar:\n\n1️⃣ Quero pagar agora (te envio o Pix)\n2️⃣ Já paguei\n3️⃣ Preciso negociar / mais prazo\n\n_Responda com o número._',
  },
  {
    id: 'msg-menu-fatura',
    nome: 'menu_fatura',
    categoria: 'BOT',
    conteudo:
      '📄 *Suas faturas, {{nome}}:*\n\n1️⃣ Ver fatura atual\n2️⃣ Pegar o Pix copia-e-cola\n3️⃣ Histórico de pagamentos\n4️⃣ Já paguei — quero avisar\n\n_Responda com o número._',
  },
  {
    id: 'msg-nps-recebido',
    nome: 'nps_recebido',
    categoria: 'BOT',
    conteudo:
      'Muito obrigado pela sua avaliação! 🙏\nSua opinião ajuda a {{parceiro}} a melhorar cada vez mais.\nQualquer coisa, é só chamar aqui. 💚',
  },
];

async function main() {
  console.log('Seeding modelos de mensagem do bot...');

  for (const msg of mensagens) {
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
    console.log(`  ✓ ${msg.nome}`);
  }

  console.log(`\n${mensagens.length} modelos de mensagem criados/atualizados.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
