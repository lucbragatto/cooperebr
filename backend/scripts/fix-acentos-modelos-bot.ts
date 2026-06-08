/**
 * Fix acentuação em modelos de mensagem do bot (TAREFA Fix 4 — 08/06/2026).
 *
 * 4 modelos globais identificados pela auditoria (audit-templates-bot.ts):
 * - aguardando_dispositivo_email — "voce" → "você"
 * - solicitacao_contrato_aprovada — "so"/"e so" → "só"/"é só"
 * - solicitacao_contrato_recusada — "nao" → "não"
 * - lembrete_vencimento_d3 — "esta" → "está"
 *
 * Faz replace de palavra inteira (regex word boundary) só nos termos
 * suspeitos. Idempotente: se já corrigido, no-op.
 *
 * NÃO mexe em conteúdo livre — só nas palavras-alvo.
 */
import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

const SUBSTITUICOES: Array<[RegExp, string]> = [
  [/\bvoce\b/g, 'você'],
  [/\bVoce\b/g, 'Você'],
  [/\bnao\b/g, 'não'],
  [/\bNao\b/g, 'Não'],
  [/\bso\b/g, 'só'],
  [/\bSo\b/g, 'Só'],
  [/\be so\b/g, 'é só'],
  [/\bE so\b/g, 'É só'],
  [/\besta\b/g, 'está'],
  [/\bEsta\b/g, 'Está'],
  [/\bFaca\b/g, 'Faça'],
  [/\bfaca\b/g, 'faça'],
  [/\bagua\b/g, 'água'],
  [/\bAgua\b/g, 'Água'],
  [/\btambem\b/g, 'também'],
  [/\bTambem\b/g, 'Também'],
];

const NOMES_ALVO = [
  'aguardando_dispositivo_email',
  'solicitacao_contrato_aprovada',
  'solicitacao_contrato_recusada',
  'lembrete_vencimento_d3',
];

async function main() {
  console.log('═══ Fix acentos modelos bot ═══\n');
  let atualizados = 0;
  let inalterados = 0;
  const modelos = await prisma.modeloMensagem.findMany({
    where: { nome: { in: NOMES_ALVO } },
  });

  for (const m of modelos) {
    let novo = m.conteudo;
    for (const [re, sub] of SUBSTITUICOES) {
      novo = novo.replace(re, sub);
    }
    if (novo === m.conteudo) {
      console.log(`  ⏭️ ja ok "${m.nome}" (tenant=${m.cooperativaId ?? 'global'})`);
      inalterados++;
      continue;
    }
    await prisma.modeloMensagem.update({
      where: { id: m.id },
      data: { conteudo: novo },
    });
    console.log(`  🔄 ATUALIZADO "${m.nome}" (tenant=${m.cooperativaId ?? 'global'})`);
    atualizados++;
  }

  console.log(`\nResumo: ${atualizados} atualizados · ${inalterados} já ok\n`);
}

main()
  .catch(console.error)
  .finally(async () => {
    await prisma.$disconnect();
  });
