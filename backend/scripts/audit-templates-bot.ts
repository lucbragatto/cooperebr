/**
 * FASE 1 read-only — auditoria de templates do bot que podem renderizar
 * "**" (asteriscos vazios) ou outras patologias de interpolação.
 *
 * Lista todos os ModeloMensagem que contém:
 * - `**{{x}}**` (markdown bold duplo — WhatsApp NÃO suporta, vira asteriscos literais)
 * - `*{{x}}*` quando x pode ser vazio → vira `**`
 * - `{{persona}}` ou `{{nomePersona}}` (CoopereAI nome)
 * - mensagens sem acento (heurística: "voce", "Faca", "e so")
 */
import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
  const modelos = await prisma.modeloMensagem.findMany({
    select: { id: true, nome: true, conteudo: true, cooperativaId: true, categoria: true },
  });
  console.log(`Total modelos: ${modelos.length}\n`);

  console.log('═══ (A) Modelos com *{{var}}* — risco "**" quando var vazia ═══');
  for (const m of modelos) {
    const matches = [...m.conteudo.matchAll(/\*+\s*\{\{(\w+)\}\}\s*\*+/g)];
    if (matches.length > 0) {
      console.log(`\n[${m.cooperativaId ?? 'global'}] "${m.nome}" (id=${m.id})`);
      for (const m2 of matches) {
        console.log(`  → ${m2[0]}  (var: {{${m2[1]}}})`);
      }
      // Preview da 1a linha relevante
      const linha = m.conteudo.split('\n').find(l => l.includes(matches[0][0]));
      if (linha) console.log(`  contexto: "${linha.trim()}"`);
    }
  }

  console.log('\n\n═══ (B) Modelos que usam {{parceiro}} ou {{cooperativa}} ═══');
  for (const m of modelos) {
    if (/\{\{(parceiro|cooperativa)\}\}/.test(m.conteudo)) {
      const linha = m.conteudo.split('\n').find(l => /\{\{(parceiro|cooperativa)\}\}/.test(l));
      console.log(`[${m.cooperativaId ?? 'global'}] "${m.nome}" → ${linha?.trim().slice(0, 100)}`);
    }
  }

  console.log('\n\n═══ (C) Mensagens potencialmente sem acento (heurística) ═══');
  const patterns = ['voce', 'Voce', 'Faca', 'esta ', 'so ', 'e so', 'nao ', 'agua', 'voce ', 'tambem'];
  for (const m of modelos) {
    const hits: string[] = [];
    for (const p of patterns) {
      const re = new RegExp(`\\b${p}\\b`, 'g');
      if (re.test(m.conteudo)) hits.push(p);
    }
    if (hits.length > 0) {
      console.log(`[${m.cooperativaId ?? 'global'}] "${m.nome}" → palavras suspeitas: ${hits.join(', ')}`);
    }
  }

  console.log('\n\n═══ (D) Persona CoopereAI / nome do assistente ═══');
  const persona = modelos.find(m => /coopere ?ai|persona|assistente/i.test(m.nome));
  if (persona) {
    console.log(`Persona modelo encontrado: "${persona.nome}"`);
    console.log(persona.conteudo);
  } else {
    console.log('Nenhum modelo "persona" encontrado.');
  }
}

main().catch(console.error).finally(() => prisma.$disconnect());
