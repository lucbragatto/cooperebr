/**
 * extrair-faq-whatsapp.mjs
 * 
 * Job: extrai mensagens recebidas no WhatsApp, identifica perguntas frequentes
 * e atualiza o arquivo memory/faq-atendimento.md do agente Coop.
 * 
 * Execução: node extrair-faq-whatsapp.mjs
 * Agendado via cron do OpenClaw.
 */

import { PrismaClient } from '@prisma/client';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const prisma = new PrismaClient();

const FAQ_PATH = path.resolve('C:/Users/Luciano/cooperebr/.agent/memory/faq-atendimento.md');
const WA_SERVICE_URL = 'http://localhost:3002';
const BACKEND_URL = 'http://localhost:3000';
const LUCIANO_TELEFONE = '5527981341348';

// Palavras-chave que indicam pergunta genuína
const PADROES_PERGUNTA = [
  /\?$/,
  /^(o que|como|quando|onde|por que|porque|qual|quais|quanto|quem|posso|preciso|tem como|é possível|voce pode|você pode)/i,
  /^(existe|há|tem|dá pra|da pra|funciona|aceita|atende|cobre)/i,
];

// Ignorar mensagens que são apenas navegação do bot
const IGNORAR = [
  /^[0-9]$/,
  /^(menu|oi|olá|ola|bom dia|boa tarde|boa noite|sim|não|nao|ok|confirmo|pronto|cancelar|sair|tchau)$/i,
  /^(pix|boleto|portal|fatura|boletos)$/i,
];

function ePerguntagenuina(texto) {
  if (!texto || texto.length < 8) return false;
  if (IGNORAR.some(r => r.test(texto.trim()))) return false;
  return PADROES_PERGUNTA.some(r => r.test(texto.trim()));
}

function normalizarTexto(texto) {
  return texto.toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^\w\s?]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function similaridade(a, b) {
  const na = normalizarTexto(a);
  const nb = normalizarTexto(b);
  const wordsA = new Set(na.split(' ').filter(w => w.length > 3));
  const wordsB = new Set(nb.split(' ').filter(w => w.length > 3));
  if (wordsA.size === 0 || wordsB.size === 0) return 0;
  const intersecao = [...wordsA].filter(w => wordsB.has(w)).length;
  return intersecao / Math.max(wordsA.size, wordsB.size);
}

async function enviarWA(telefone, texto) {
  try {
    const res = await fetch(`${WA_SERVICE_URL}/send-message`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ to: telefone, text: texto }),
    });
    return res.ok;
  } catch (err) {
    console.error('Erro ao enviar WA:', err.message);
    return false;
  }
}

async function main() {
  console.log('🔍 Iniciando extração de FAQ do WhatsApp...');

  // Notificar Luciano que o job iniciou
  await enviarWA(LUCIANO_TELEFONE,
    `⚙️ *CoopereAI - Job FAQ iniciado*\n\nEstou analisando as mensagens recebidas no WhatsApp para identificar perguntas frequentes e atualizar o FAQ automaticamente.\n\n_Você será avisado ao final com o resumo._ 🤖`
  );

  // Buscar mensagens de entrada dos últimos 30 dias
  const trintaDiasAtras = new Date();
  trintaDiasAtras.setDate(trintaDiasAtras.getDate() - 30);

  const mensagens = await prisma.mensagemWhatsapp.findMany({
    where: {
      direcao: 'ENTRADA',
      tipo: 'texto',
      conteudo: { not: null },
      createdAt: { gte: trintaDiasAtras },
    },
    select: {
      conteudo: true,
      createdAt: true,
    },
    orderBy: { createdAt: 'desc' },
    take: 2000,
  });

  console.log(`📩 ${mensagens.length} mensagens encontradas`);

  // Filtrar perguntas genuínas
  const perguntas = mensagens
    .map(m => m.conteudo?.trim())
    .filter(Boolean)
    .filter(ePerguntagenuina);

  console.log(`❓ ${perguntas.length} perguntas identificadas`);

  if (perguntas.length === 0) {
    await enviarWA(LUCIANO_TELEFONE,
      `✅ *CoopereAI - Job FAQ concluído*\n\nNenhuma pergunta nova identificada nos últimos 30 dias. FAQ não alterado.`
    );
    await prisma.$disconnect();
    return;
  }

  // Agrupar perguntas similares (clusterização simples)
  const clusters = [];

  for (const pergunta of perguntas) {
    let encontrou = false;
    for (const cluster of clusters) {
      if (similaridade(pergunta, cluster.exemplo) > 0.5) {
        cluster.count++;
        cluster.variantes.push(pergunta);
        encontrou = true;
        break;
      }
    }
    if (!encontrou) {
      clusters.push({
        exemplo: pergunta,
        count: 1,
        variantes: [pergunta],
      });
    }
  }

  // Ordenar por frequência e pegar top 10 mais frequentes
  clusters.sort((a, b) => b.count - a.count);
  const topPerguntas = clusters.slice(0, 10);

  console.log(`📊 Top perguntas identificadas:`);
  topPerguntas.forEach((c, i) => {
    console.log(`  ${i + 1}. (${c.count}x) "${c.exemplo}"`);
  });

  // Ler FAQ atual
  let faqAtual = '';
  try {
    faqAtual = await fs.readFile(FAQ_PATH, 'utf8');
  } catch (err) {
    console.error('Erro ao ler FAQ:', err.message);
    faqAtual = '# FAQ Atendimento\n\n';
  }

  // Identificar perguntas que ainda não estão no FAQ
  const novasPerguntas = topPerguntas.filter(cluster => {
    const norm = normalizarTexto(cluster.exemplo);
    const faqNorm = normalizarTexto(faqAtual);
    // Checar se alguma palavra-chave importante já existe no FAQ
    const palavrasChave = norm.split(' ').filter(w => w.length > 4);
    const jaExiste = palavrasChave.filter(w => faqNorm.includes(w)).length >= Math.ceil(palavrasChave.length * 0.6);
    return !jaExiste;
  });

  console.log(`✨ ${novasPerguntas.length} perguntas novas para adicionar ao FAQ`);

  if (novasPerguntas.length === 0) {
    await enviarWA(LUCIANO_TELEFONE,
      `✅ *CoopereAI - Job FAQ concluído*\n\nAnalisei ${perguntas.length} perguntas dos últimos 30 dias.\nNenhuma pergunta nova relevante identificada — FAQ já está atualizado! 📚`
    );
    await prisma.$disconnect();
    return;
  }

  // Montar bloco de novas perguntas para adicionar ao FAQ
  const dataHoje = new Date().toLocaleDateString('pt-BR');
  let blocoNovo = `\n---\n\n## 📥 Perguntas frequentes identificadas automaticamente (${dataHoje})\n\n`;
  blocoNovo += `_Estas perguntas foram identificadas nas conversas do WhatsApp e ainda não têm resposta definida. Luciano deve revisar e adicionar as respostas._\n\n`;

  for (const cluster of novasPerguntas) {
    blocoNovo += `### ❓ "${cluster.exemplo}" *(${cluster.count}x nos últimos 30 dias)*\n`;
    if (cluster.variantes.length > 1) {
      const variantes = [...new Set(cluster.variantes)].slice(0, 3);
      blocoNovo += `Variantes: ${variantes.map(v => `_"${v}"_`).join(', ')}\n`;
    }
    blocoNovo += `**Resposta:** _(a definir)_\n\n`;
  }

  // Salvar FAQ atualizado
  const faqAtualizado = faqAtual + blocoNovo;
  await fs.writeFile(FAQ_PATH, faqAtualizado, 'utf8');

  console.log('✅ FAQ atualizado com sucesso!');

  // Notificar Luciano com resumo
  let resumo = `✅ *CoopereAI - FAQ atualizado!*\n\n`;
  resumo += `Analisei *${perguntas.length} perguntas* dos últimos 30 dias.\n`;
  resumo += `Encontrei *${novasPerguntas.length} perguntas novas* não cobertas no FAQ:\n\n`;
  novasPerguntas.forEach((c, i) => {
    resumo += `${i + 1}. _"${c.exemplo.substring(0, 60)}${c.exemplo.length > 60 ? '...' : ''}"_ (${c.count}x)\n`;
  });
  resumo += `\n📝 As perguntas foram salvas no FAQ com status _(a definir)_.\n`;
  resumo += `Por favor, revise e adicione as respostas quando puder! 🙏`;

  await enviarWA(LUCIANO_TELEFONE, resumo);

  await prisma.$disconnect();
  console.log('🏁 Job FAQ concluído!');
}

main().catch(async (err) => {
  console.error('❌ Erro no job FAQ:', err);
  await enviarWA(LUCIANO_TELEFONE,
    `❌ *CoopereAI - Erro no Job FAQ*\n\nOcorreu um erro ao extrair perguntas do WhatsApp:\n_${err.message}_\n\nVerifique os logs para mais detalhes.`
  ).catch(() => {});
  await prisma.$disconnect();
  process.exit(1);
});
