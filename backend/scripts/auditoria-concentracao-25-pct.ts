/**
 * Script ad-hoc Fase 8 (Sprint 0 passos iniciais) — auditoria de concentração
 * > 25% por (cooperado, usina) no banco atual.
 *
 * Mitiga parcialmente o risco D-30A (Caso Exfishes R$ 310k/ano). Estrutura
 * preparada pra rodar em prod depois (mesma query agrupando por tenant).
 *
 * Não bloqueia produção — só audita. Decisões corretivas ficam pro Luciano
 * ler o relatório gerado em docs/relatorios/.
 *
 * Rodar: cd backend ; npx ts-node --transpile-only scripts/auditoria-concentracao-25-pct.ts
 *
 * Output: docs/relatorios/<DATA>-auditoria-concentracao-25-pct.md
 */
import { PrismaClient } from '@prisma/client';
import { writeFileSync, mkdirSync } from 'fs';
import { join } from 'path';

const prisma = new PrismaClient();

const LIMITE_ANEEL = 25.0; // default ANEEL Lei 14.300/2022
const LIMITE_VIGILANCIA = 20.0; // ler como "limítrofe"
const HOJE = new Date().toISOString().slice(0, 10);

function fmtPct(n: number): string {
  return `${n.toFixed(2)}%`.replace('.', ',');
}

async function main() {
  console.log('=== Auditoria de Concentração > 25% por cooperado-usina ===\n');

  // 1. Cooperativas no banco
  const coops = await prisma.cooperativa.findMany({
    select: {
      id: true,
      nome: true,
      tipoParceiro: true,
      _count: { select: { cooperados: true, contratos: true, usinas: true } },
    },
  });
  console.log(`Cooperativas: ${coops.length}`);

  // 2. Contagens por cooperativa (só status ATIVOs)
  const baseCoops = await Promise.all(
    coops.map(async (c) => {
      const contratos = await prisma.contrato.count({
        where: { cooperativaId: c.id, status: { in: ['ATIVO', 'PENDENTE_ATIVACAO'] } },
      });
      const cooperados = await prisma.cooperado.count({
        where: { cooperativaId: c.id, status: { in: ['ATIVO', 'ATIVO_RECEBENDO_CREDITOS'] } },
      });
      const usinas = await prisma.usina.count({ where: { cooperativaId: c.id } });
      return { coop: c, contratos, cooperados, usinas };
    }),
  );

  // 3. Todos os contratos ATIVO + PENDENTE_ATIVACAO com percentualUsina
  const contratos = await prisma.contrato.findMany({
    where: {
      status: { in: ['ATIVO', 'PENDENTE_ATIVACAO'] },
      percentualUsina: { not: null },
    },
    select: {
      id: true,
      cooperadoId: true,
      usinaId: true,
      cooperativaId: true,
      percentualUsina: true,
      kwhContratoAnual: true,
      status: true,
      cooperado: { select: { nomeCompleto: true } },
      usina: { select: { nome: true, potenciaKwp: true } },
    },
  });

  console.log(`Contratos analisados (ATIVO + PENDENTE_ATIVACAO com percentualUsina): ${contratos.length}`);

  // 4. Agregar por (cooperadoId, usinaId)
  const chave = (c: typeof contratos[0]) => `${c.cooperadoId}__${c.usinaId}`;
  const agg = new Map<string, {
    cooperadoId: string;
    usinaId: string;
    cooperativaId: string | null;
    cooperadoNome: string;
    usinaNome: string;
    usinaKwp: number;
    percentualTotal: number;
    nContratos: number;
  }>();

  for (const c of contratos) {
    const k = chave(c);
    const atual = agg.get(k);
    const pct = Number(c.percentualUsina ?? 0);
    if (atual) {
      atual.percentualTotal += pct;
      atual.nContratos += 1;
    } else {
      agg.set(k, {
        cooperadoId: c.cooperadoId,
        usinaId: c.usinaId,
        cooperativaId: c.cooperativaId,
        cooperadoNome: c.cooperado?.nomeCompleto ?? '(sem nome)',
        usinaNome: c.usina?.nome ?? '(sem nome)',
        usinaKwp: Number(c.usina?.potenciaKwp ?? 0),
        percentualTotal: pct,
        nContratos: 1,
      });
    }
  }

  const todosAgregados = Array.from(agg.values());
  const acimaLimite = todosAgregados.filter((x) => x.percentualTotal > LIMITE_ANEEL);
  const limitrofe = todosAgregados.filter(
    (x) => x.percentualTotal >= LIMITE_VIGILANCIA && x.percentualTotal <= LIMITE_ANEEL,
  );
  acimaLimite.sort((a, b) => b.percentualTotal - a.percentualTotal);
  limitrofe.sort((a, b) => b.percentualTotal - a.percentualTotal);

  // 5. Cross-check casos nominais (FIGATTA, CRIAR, EXFISHES)
  const checkNominais: { nome: string; encontrado: boolean; agregados: typeof todosAgregados }[] = [];
  for (const alvo of ['FIGATTA', 'CRIAR', 'EXFISHES']) {
    const matches = todosAgregados.filter((x) =>
      x.cooperadoNome.toUpperCase().includes(alvo),
    );
    checkNominais.push({ nome: alvo, encontrado: matches.length > 0, agregados: matches });
  }

  // 6. Distribuição por usina (% máximo e médio)
  const porUsina = new Map<string, {
    usinaId: string;
    usinaNome: string;
    cooperativaId: string | null;
    cooperados: Set<string>;
    pctMax: number;
    pctMin: number;
    pctSoma: number;
    n: number;
  }>();

  for (const x of todosAgregados) {
    const u = porUsina.get(x.usinaId);
    if (u) {
      u.cooperados.add(x.cooperadoId);
      u.pctMax = Math.max(u.pctMax, x.percentualTotal);
      u.pctMin = Math.min(u.pctMin, x.percentualTotal);
      u.pctSoma += x.percentualTotal;
      u.n += 1;
    } else {
      porUsina.set(x.usinaId, {
        usinaId: x.usinaId,
        usinaNome: x.usinaNome,
        cooperativaId: x.cooperativaId,
        cooperados: new Set([x.cooperadoId]),
        pctMax: x.percentualTotal,
        pctMin: x.percentualTotal,
        pctSoma: x.percentualTotal,
        n: 1,
      });
    }
  }

  const coopNome = (id: string | null) => {
    if (!id) return '(global)';
    const c = coops.find((x) => x.id === id);
    return c?.nome ?? `(${id.slice(-8)})`;
  };

  // 7. Montar Markdown
  let md = '';
  md += `# Auditoria de Concentração > 25% — ${HOJE}\n\n`;
  md += `> Relatório gerado pela Fase 8 (Sprint 0 passos iniciais) da sessão Code 11/05/2026.\n`;
  md += `> Mitigação parcial do risco D-30A (concentração regulatória ANEEL).\n\n`;

  md += `## Contexto regulatório\n\n`;
  md += `ANEEL define limite default de **25% por cooperado-usina** (Lei 14.300/2022). `;
  md += `Concentrações acima podem gerar autuação + perda de habilitação SCEE. `;
  md += `Limite é configurável por parceiro via flag \`concentracaoMaxPorCooperadoUsina\` `;
  md += `(quando \`ConfigRegulatoriaParceiro\` for criada — Sprint 5).\n\n`;

  md += `## Resumo executivo\n\n`;
  md += `- Total de contratos analisados (ATIVO + PENDENTE_ATIVACAO com \`percentualUsina\`): **${contratos.length}**\n`;
  md += `- Total de agregações (cooperado × usina únicas): **${todosAgregados.length}**\n`;
  md += `- **Casos > 25%: ${acimaLimite.length}** ${acimaLimite.length === 0 ? '✅' : '🔴'}\n`;
  md += `- Casos limítrofes (20% ≤ x ≤ 25%): ${limitrofe.length}\n\n`;

  md += `## Base analisada por cooperativa\n\n`;
  md += `| Cooperativa | Tipo | Contratos ativos | Cooperados ativos | Usinas |\n`;
  md += `|---|---|---|---|---|\n`;
  for (const b of baseCoops) {
    md += `| ${b.coop.nome} | ${b.coop.tipoParceiro ?? '-'} | ${b.contratos} | ${b.cooperados} | ${b.usinas} |\n`;
  }
  md += `\n`;

  md += `## Casos > 25% (ordenado por % decrescente)\n\n`;
  if (acimaLimite.length === 0) {
    md += `Nenhum caso > 25% encontrado no banco atual. Ver seção "Diagnóstico" abaixo.\n\n`;
  } else {
    md += `| # | Cooperativa | Cooperado | Usina | % agregado | Nº contratos | Ação sugerida |\n`;
    md += `|---|---|---|---|---|---|---|\n`;
    acimaLimite.forEach((x, i) => {
      md += `| ${i + 1} | ${coopNome(x.cooperativaId)} | ${x.cooperadoNome} | ${x.usinaNome} | ${fmtPct(x.percentualTotal)} | ${x.nContratos} | Reduzir ou redistribuir |\n`;
    });
    md += `\n`;
  }

  md += `## Casos limítrofes (20% ≤ x ≤ 25%) — vigiar\n\n`;
  if (limitrofe.length === 0) {
    md += `Nenhum caso limítrofe.\n\n`;
  } else {
    md += `| # | Cooperativa | Cooperado | Usina | % | Nº contratos |\n`;
    md += `|---|---|---|---|---|---|\n`;
    limitrofe.forEach((x, i) => {
      md += `| ${i + 1} | ${coopNome(x.cooperativaId)} | ${x.cooperadoNome} | ${x.usinaNome} | ${fmtPct(x.percentualTotal)} | ${x.nContratos} |\n`;
    });
    md += `\n`;
  }

  md += `## Distribuição geral por usina\n\n`;
  md += `| Usina | Cooperativa | Cooperados distintos | % máx | % médio | Soma % | Status |\n`;
  md += `|---|---|---|---|---|---|---|\n`;
  Array.from(porUsina.values())
    .sort((a, b) => b.pctMax - a.pctMax)
    .forEach((u) => {
      const pctMedio = u.pctSoma / u.n;
      const status = u.pctMax > LIMITE_ANEEL ? '🔴' : u.pctMax >= LIMITE_VIGILANCIA ? '🟡' : '🟢';
      md += `| ${u.usinaNome} | ${coopNome(u.cooperativaId)} | ${u.cooperados.size} | ${fmtPct(u.pctMax)} | ${fmtPct(pctMedio)} | ${fmtPct(u.pctSoma)} | ${status} |\n`;
    });
  md += `\n`;

  md += `## Cross-check de casos nominais (documentados em sessões anteriores)\n\n`;
  for (const c of checkNominais) {
    if (!c.encontrado) {
      md += `- ⚪ **${c.nome}** — não encontrado no banco atual (provavelmente limpo em sessão anterior ou nome divergente).\n`;
    } else {
      for (const a of c.agregados) {
        const ic = a.percentualTotal > LIMITE_ANEEL ? '🔴' : a.percentualTotal >= LIMITE_VIGILANCIA ? '🟡' : '🟢';
        md += `- ${ic} **${c.nome}** encontrado: \`${a.cooperadoNome}\` em ${a.usinaNome} (${coopNome(a.cooperativaId)}) — **${fmtPct(a.percentualTotal)}** (${a.nContratos} contrato(s))\n`;
      }
    }
  }
  md += `\n`;

  if (acimaLimite.length === 0) {
    md += `## Diagnóstico: por que 0 casos > 25%?\n\n`;
    md += `Hipóteses (não-exaustivas):\n\n`;
    md += `- **(a)** Banco dev tem dados mascarados ou anonimizados que podem ter alterado proporções originais.\n`;
    md += `- **(b)** Casos FIGATTA/CRIAR (mencionados em sessões 30/04) podem ter sido limpos em scripts de limpeza posteriores. EXFISHES ainda presente.\n`;
    md += `- **(c)** Banco dev legitimamente não tem concentrações altas hoje (base pequena: ${contratos.length} contratos em 3 cooperativas).\n\n`;
    md += `**O risco D-30A permanece P0 estrutural** — sistema continua sem flag de proteção `;
    md += `(\`concentracaoMaxPorCooperadoUsina\` configurável por parceiro). Quando rodar em prod com `;
    md += `centenas/milhares de contratos, a probabilidade de surgir caso > 25% aumenta.\n\n`;
  }

  md += `## Limitações deste relatório\n\n`;
  md += `- **NÃO inclui auditoria por classe GD** — \`Usina.classeGd\` não existe no schema atual (Sprint 5 vai criar). Sem isso, não dá pra detectar mix de classes proibido por flag \`misturaClassesMesmaUsina\`.\n`;
  md += `- **NÃO inclui auditoria de protocolo** — \`Usina.dataProtocoloDistribuidora\` e \`Uc.dataProtocoloDistribuidora\` não existem (Sprint 5).\n`;
  md += `- **NÃO inclui saldo > 2 meses parado** — D-30G fica pra Sprint 0 completo (precisa cruzar histórico Cobranca + consumo médio).\n`;
  md += `- **Limite 25% é o default ANEEL.** Quando \`ConfigRegulatoriaParceiro\` existir (Sprint 5), cada parceiro pode configurar seu próprio limite.\n`;
  md += `- **Só agrega por (cooperadoId, usinaId).** Concentrações cruzadas (cooperado com várias usinas, mesma classe GD) não são detectadas.\n\n`;

  md += `## Próximos passos sugeridos\n\n`;
  md += `1. **Luciano lê este relatório.** Identifica casos pra ação corretiva.\n`;
  md += `2. **Plano caso a caso** — pra cada caso > 25% (se houver), decisão:\n`;
  md += `   - (a) Reduzir \`percentualUsina\` do contrato existente\n`;
  md += `   - (b) Redistribuir parte pra outra usina compatível\n`;
  md += `   - (c) Aceitar risco regulatório formalmente (documentar)\n`;
  md += `3. **Sprint 5 completo** dá ferramentas estruturais (5 flags ANEEL + N:M Contrato↔Usina + cron diário + UI parceiro).\n`;
  md += `4. **Sprint 0 completo** dá relatórios automatizados periódicos (cron + dashboard \`/dashboard/super-admin/auditoria-regulatoria\`).\n\n`;

  md += `## Histórico do relatório\n\n`;
  md += `- Gerado em: ${HOJE}\n`;
  md += `- Script: \`backend/scripts/auditoria-concentracao-25-pct.ts\` (artefato local, não commitado — refazível a qualquer momento)\n`;
  md += `- Origem: Fase 8 da sessão Code 11/05/2026\n`;

  // 8. Escrever arquivo
  const outDir = join(process.cwd(), '..', 'docs', 'relatorios');
  mkdirSync(outDir, { recursive: true });
  const outPath = join(outDir, `${HOJE}-auditoria-concentracao-25-pct.md`);
  writeFileSync(outPath, md, 'utf-8');

  // 9. Resumo no console
  console.log('\n═══════════════════════════════════════════════════════════════');
  console.log('AUDITORIA CONCLUÍDA');
  console.log('═══════════════════════════════════════════════════════════════');
  console.log(`Arquivo gerado:        ${outPath}`);
  console.log(`Contratos analisados:  ${contratos.length}`);
  console.log(`Agregados únicos:      ${todosAgregados.length}`);
  console.log(`Casos > 25%:           ${acimaLimite.length} ${acimaLimite.length === 0 ? '✅' : '🔴'}`);
  console.log(`Casos limítrofes:      ${limitrofe.length}`);
  console.log('');
  if (acimaLimite.length > 0) {
    console.log('Top 3 casos > 25%:');
    acimaLimite.slice(0, 3).forEach((x, i) => {
      console.log(`  ${i + 1}. ${fmtPct(x.percentualTotal)} | ${coopNome(x.cooperativaId)} | ${x.cooperadoNome.slice(0, 40)} | ${x.usinaNome.slice(0, 25)}`);
    });
  }
  console.log('');
  console.log('Cross-check nominais:');
  for (const c of checkNominais) {
    console.log(`  ${c.encontrado ? '✓' : '⚪'} ${c.nome}: ${c.encontrado ? `${c.agregados.length} caso(s) encontrados` : 'não encontrado'}`);
  }
  console.log('═══════════════════════════════════════════════════════════════');

  await prisma.$disconnect();
}

main().catch((err) => {
  console.error('ERRO:', err.message ?? err);
  process.exit(1);
});
