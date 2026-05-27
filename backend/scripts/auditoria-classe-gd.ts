/**
 * Script F.7a — Auditoria de Classe GD por usina.
 *
 * READ-ONLY. Zero UPDATE.
 *
 * Lista todas as usinas com:
 *   - classeGdAnotada atual (NULL se ainda não preenchida)
 *   - Sugestão automática baseada em potenciaKwp (faixas REN 1.000/2021):
 *     ≤ 75 kW       → GD_I
 *     75-1.000 kW   → GD_II
 *     1.000-5.000 kW → GD_III
 *     > 5.000 kW    → fora SCEE (verificar)
 *   - Status: OK | PENDENTE | DIVERGÊNCIA | FORA_SCEE
 *
 * Gera relatório em `docs/relatorios/<data>-auditoria-classe-gd.md`.
 *
 * Uso: `npx ts-node backend/scripts/auditoria-classe-gd.ts`
 *
 * Sub-Sprint Refinamento Telas Usinas F.7a (M35, 28/05/2026). D-novo-BA.
 * Quando Luciano fornecer planilha definitiva: outro script `corrigir-classe-gd.ts`
 * aplicará UPDATEs (com dry-run primeiro).
 */
import { PrismaClient } from '@prisma/client';
import * as fs from 'node:fs';
import * as path from 'node:path';

type Sugestao = 'GD_I' | 'GD_II' | 'GD_III' | 'FORA_SCEE';
type Status = 'OK' | 'PENDENTE' | 'DIVERGÊNCIA' | 'FORA_SCEE';

function sugerirClasse(potenciaKwp: number): Sugestao {
  if (potenciaKwp <= 75) return 'GD_I';
  if (potenciaKwp <= 1000) return 'GD_II';
  if (potenciaKwp <= 5000) return 'GD_III';
  return 'FORA_SCEE';
}

function determinarStatus(atual: string | null, sugestao: Sugestao): Status {
  if (sugestao === 'FORA_SCEE') return 'FORA_SCEE';
  if (!atual) return 'PENDENTE';
  if (atual === sugestao) return 'OK';
  return 'DIVERGÊNCIA';
}

async function main() {
  const prisma = new PrismaClient();
  try {
    const usinas = await prisma.usina.findMany({
      select: {
        id: true,
        nome: true,
        apelidoInterno: true,
        potenciaKwp: true,
        capacidadeKwh: true,
        classeGdAnotada: true,
        cooperativa: { select: { nome: true } },
      },
      orderBy: [{ cooperativa: { nome: 'asc' } }, { nome: 'asc' }],
    });

    const linhas = usinas.map((u, idx) => {
      const kWp = Number(u.potenciaKwp);
      const sugestao = sugerirClasse(kWp);
      const status = determinarStatus(u.classeGdAnotada, sugestao);
      return {
        idx: idx + 1,
        coop: u.cooperativa?.nome ?? '—',
        apelido: u.apelidoInterno ?? '—',
        nome: u.nome,
        potenciaKwp: kWp,
        capacidadeKwh: u.capacidadeKwh ? Number(u.capacidadeKwh) : null,
        classeAtual: u.classeGdAnotada ?? null,
        sugestao,
        status,
      };
    });

    const contadores = {
      OK: linhas.filter((l) => l.status === 'OK').length,
      PENDENTE: linhas.filter((l) => l.status === 'PENDENTE').length,
      DIVERGÊNCIA: linhas.filter((l) => l.status === 'DIVERGÊNCIA').length,
      FORA_SCEE: linhas.filter((l) => l.status === 'FORA_SCEE').length,
    };

    // ─── Print console ────────────────────────────────────────────────
    console.log(`\n═══ Auditoria Classe GD — ${usinas.length} usinas ═══\n`);
    console.log('| # | Coop | Apelido | Nome | kWp | Atual | Sugestão | Status |');
    console.log('|---|------|---------|------|----:|-------|----------|--------|');
    for (const l of linhas) {
      console.log(
        `| ${l.idx} | ${l.coop} | ${l.apelido} | ${l.nome.slice(0, 35)} | ${l.potenciaKwp} | ${l.classeAtual ?? '—'} | ${l.sugestao} | ${l.status} |`,
      );
    }
    console.log('\n--- Resumo ---');
    console.log(`✅ OK:           ${contadores.OK}`);
    console.log(`📋 PENDENTE:     ${contadores.PENDENTE}`);
    console.log(`⚠️  DIVERGÊNCIA: ${contadores.DIVERGÊNCIA}`);
    console.log(`🚫 FORA_SCEE:    ${contadores.FORA_SCEE}`);

    // ─── Grava relatório Markdown ─────────────────────────────────────
    const dia = new Date().toISOString().slice(0, 10);
    const outDir = path.resolve(__dirname, '..', '..', 'docs', 'relatorios');
    const outPath = path.join(outDir, `${dia}-auditoria-classe-gd.md`);
    fs.mkdirSync(outDir, { recursive: true });

    const md = [
      `# Auditoria Classe GD — ${dia}`,
      '',
      `> Script: \`backend/scripts/auditoria-classe-gd.ts\` (READ-ONLY).`,
      `> Sub-Sprint F.7a (M35) — D-novo-BA.`,
      '',
      '## Critério de sugestão (REN ANEEL 1.000/2021)',
      '',
      '| Faixa potenciaKwp | Classe sugerida |',
      '|---|---|',
      '| ≤ 75 kW | GD_I (microgeração) |',
      '| 75 < kWp ≤ 1.000 | GD_II (minigeração I) |',
      '| 1.000 < kWp ≤ 5.000 | GD_III (minigeração II) |',
      '| > 5.000 | FORA_SCEE — verificar |',
      '',
      '## Resumo',
      '',
      `- ✅ OK: **${contadores.OK}**`,
      `- 📋 PENDENTE: **${contadores.PENDENTE}**`,
      `- ⚠️ DIVERGÊNCIA: **${contadores.DIVERGÊNCIA}**`,
      `- 🚫 FORA_SCEE: **${contadores.FORA_SCEE}**`,
      `- **Total:** ${usinas.length} usinas`,
      '',
      '## Detalhamento por usina',
      '',
      '| # | Cooperativa | Apelido | Nome | kWp | kWh/mês | Atual | Sugestão | Status |',
      '|---|-------------|---------|------|----:|--------:|-------|----------|--------|',
      ...linhas.map(
        (l) =>
          `| ${l.idx} | ${l.coop} | ${l.apelido} | ${l.nome} | ${l.potenciaKwp} | ${l.capacidadeKwh ?? '—'} | ${l.classeAtual ?? '—'} | ${l.sugestao} | ${l.status} |`,
      ),
      '',
      '## Próximos passos',
      '',
      '1. **Luciano revisar tabela acima**: confirmar cada `PENDENTE` + decidir se aceita sugestão automática OU manual',
      '2. **DIVERGÊNCIA**: caso a caso — pode ser intencional (ex: GD_I tributário em usina >75kW). Documentar decisão.',
      '3. **D-novo-BG (cooperebr1 Linhares GD_I com 1.250 kWp)**: confirmado intencional (28/05) — não corrigir, decidir antes de implementar Fio B.',
      '4. **Quando planilha definitiva pronta**: rodar `npx ts-node backend/scripts/corrigir-classe-gd.ts <planilha.csv>` (script futuro, dry-run primeiro).',
      '',
    ].join('\n');

    fs.writeFileSync(outPath, md, 'utf-8');
    console.log(`\nRelatório salvo em: ${path.relative(process.cwd(), outPath)}`);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
