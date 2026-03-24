import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const mensagens = [
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
      '🌱 *Sua simulação CoopereBR:*\n\n📊 Fatura média atual: R$ {{valorFaturaMedia}}\n💚 Com a CoopereBR: R$ {{valorComDesconto}} (-{{desconto}}%)\n💵 Economia mensal: R$ {{economiaMensal}}\n📅 Economia anual: R$ {{economiaAnual}}\n{{mesesGratis}}\nQuer receber a proposta completa em PDF?\nResponda *SIM*',
  },
  {
    id: 'msg-proposta-pdf',
    nome: 'proposta_pdf',
    //Proposta resumo enviada como texto (PDF futuro)',
    categoria: 'BOT',
    conteudo:
      '📋 *PROPOSTA COOPEREBR*\n━━━━━━━━━━━━━━━━━━━━\n\n👤 *{{titular}}*\n📍 {{endereco}}\n🔌 UC: {{uc}}\n\n📊 *Dados da simulação:*\n• Consumo considerado: {{kwhContrato}} kWh/mês\n• Desconto: {{desconto}}%\n• Economia mensal: R$ {{economiaMensal}}\n• Economia anual: R$ {{economiaAnual}}\n\n━━━━━━━━━━━━━━━━━━━━\n_Proposta válida por 30 dias_',
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
      'Estou aqui para ajudar! Para falar com nossa equipe, acesse: cooperebr.com.br\n\nOu envie a foto da sua conta de luz para gerar uma simulação gratuita! 📸',
  },
  {
    id: 'msg-cancelar',
    nome: 'cancelar',
    //Resposta para cancelar/cancel',
    categoria: 'BOT',
    conteudo: 'Tudo bem! Se quiser começar novamente, é só mandar a foto da sua conta de luz. 😊',
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
