/**
 * Sprint Bot Autoatendimento — Bloco 2 (21/05).
 *
 * Insere 11 modelos novos de mensagem usados pelos Blocos 4/6/7/8 do sprint.
 * Bloco 2 SO insere — cabeamento as etapas eh dos blocos seguintes.
 *
 * Todos: categoria BOT, escopo GLOBAL (cooperativaId=null), ativo=true.
 * Variaveis usadas validadas: {{titular}}, {{telefone}}, {{nome}}, {{mes}},
 * {{parceiro}} — todas populadas pelo motor extrairVariaveis() (Bloco 2
 * adicionou {{telefone}} que faltava).
 *
 * Idempotente: skip se modelo com mesmo nome ja existe (validado por nome
 * + cooperativaId null). Mostra ANTES/DEPOIS quando cria.
 */
import { PrismaClient } from '@prisma/client';

interface ModeloNovo {
  nome: string;
  conteudo: string;
}

const MODELOS_NOVOS: ModeloNovo[] = [
  {
    nome: 'proxy_pedindo_nome',
    conteudo:
      'Que bom que você quer trazer um amigo pra perto! 🤝\nQual o *nome completo* dele(a)?',
  },
  {
    nome: 'proxy_pedindo_telefone',
    conteudo:
      'Anotado! E qual o *WhatsApp* do seu amigo? (com DDD — ex: 27 99999-9999)',
  },
  {
    nome: 'proxy_pedindo_fatura',
    conteudo:
      'Perfeito! 📸 Agora me envie uma *foto* ou *PDF* da conta de luz dele(a) — assim já calculo quanto vai economizar.',
  },
  {
    nome: 'proxy_confirmar',
    conteudo:
      'Confere os dados do seu indicado:\n👤 {{titular}}\n📱 {{telefone}}\n\n1️⃣ Tudo certo, pode cadastrar\n2️⃣ Corrigir',
  },
  {
    nome: 'aguardando_novo_nome',
    conteudo: 'Qual o seu *nome completo* atualizado?',
  },
  {
    nome: 'aguardando_novo_email',
    conteudo: 'Qual o seu *e-mail* atualizado?',
  },
  {
    nome: 'aguardando_novo_telefone',
    conteudo: 'Qual o seu *telefone* atualizado? (com DDD)',
  },
  {
    nome: 'aguardando_novo_cep',
    conteudo: 'Qual o seu *CEP* atualizado? (formato 00000-000)',
  },
  {
    nome: 'menu_inadimplente',
    conteudo:
      'Oi {{nome}}! Vi que sua fatura de {{mes}} está em aberto. 💛\nPosso te ajudar:\n\n1️⃣ Quero pagar agora (te envio o Pix)\n2️⃣ Já paguei\n3️⃣ Preciso negociar / mais prazo\n\n_Responda com o número._',
  },
  {
    nome: 'menu_fatura',
    conteudo:
      '📄 *Suas faturas, {{nome}}:*\n\n1️⃣ Ver fatura atual\n2️⃣ Pegar o Pix copia-e-cola\n3️⃣ Histórico de pagamentos\n4️⃣ Já paguei — quero avisar\n\n_Responda com o número._',
  },
  {
    nome: 'nps_recebido',
    conteudo:
      'Muito obrigado pela sua avaliação! 🙏\nSua opinião ajuda a {{parceiro}} a melhorar cada vez mais.\nQualquer coisa, é só chamar aqui. 💚',
  },
];

async function main(): Promise<void> {
  const prisma = new PrismaClient();
  try {
    console.log(`═══ Bloco 2 — Inserir ${MODELOS_NOVOS.length} modelos novos ═══\n`);

    let criados = 0;
    let pulados = 0;
    let atualizados = 0;

    for (const m of MODELOS_NOVOS) {
      const existente = await prisma.modeloMensagem.findFirst({
        where: { nome: m.nome, cooperativaId: null },
      });

      if (!existente) {
        const novo = await prisma.modeloMensagem.create({
          data: {
            nome: m.nome,
            categoria: 'BOT',
            conteudo: m.conteudo,
            cooperativaId: null,
            ativo: true,
          },
        });
        console.log(`  ✅ CRIADO "${m.nome}" id=${novo.id}`);
        console.log(`     conteudo: ${JSON.stringify(m.conteudo.slice(0, 100))}${m.conteudo.length > 100 ? '...' : ''}`);
        criados++;
      } else if (existente.conteudo !== m.conteudo) {
        // Idempotencia ampliada: atualiza se conteudo divergir do esperado
        const antes = existente.conteudo;
        await prisma.modeloMensagem.update({
          where: { id: existente.id },
          data: { conteudo: m.conteudo, categoria: 'BOT', ativo: true },
        });
        console.log(`  🔄 ATUALIZADO "${m.nome}" id=${existente.id}`);
        console.log(`     ANTES:  ${JSON.stringify(antes.slice(0, 80))}`);
        console.log(`     DEPOIS: ${JSON.stringify(m.conteudo.slice(0, 80))}`);
        atualizados++;
      } else {
        console.log(`  ⏭️  JA OK "${m.nome}" id=${existente.id} (skip)`);
        pulados++;
      }
    }

    // ─────────────────────────────────────────────────────────────
    // Validacao pos-update
    // ─────────────────────────────────────────────────────────────
    console.log(`\n═══ Validacao pos-update ═══`);
    let ok = 0;
    let faltando = 0;
    for (const m of MODELOS_NOVOS) {
      const reg = await prisma.modeloMensagem.findFirst({
        where: { nome: m.nome, cooperativaId: null, categoria: 'BOT', ativo: true },
      });
      if (reg && reg.conteudo === m.conteudo) {
        ok++;
      } else {
        faltando++;
        console.log(`  ❌ "${m.nome}" ausente ou divergente`);
      }
    }
    console.log(`  ${ok}/${MODELOS_NOVOS.length} modelos confirmados ${ok === MODELOS_NOVOS.length ? '✅' : '❌'}`);

    console.log(`\n═══ Resumo ═══`);
    console.log(`  Criados: ${criados} | Atualizados: ${atualizados} | Pulados: ${pulados} | Faltando: ${faltando}`);
    console.log('\n[bloco-2] Concluido. Modelos disponiveis no Banco de Mensagens — cabeamento as etapas eh dos Blocos 4/6/7/8.');
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((e) => { console.error(e); process.exit(1); });
