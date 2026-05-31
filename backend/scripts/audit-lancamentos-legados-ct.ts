/**
 * Auditoria read-only dos LancamentoCaixa legados (D-novo-BR-CT pré-migration).
 *
 * Lista todos os LancamentoCaixa do banco, cruza com fontes upstream
 * rastreáveis (Cooperado, ContaPagar, ContratoConvenio) e INFERE a
 * NaturezaCooperativa correta (PROPRIO / AUXILIAR / NAO_COOPERATIVO)
 * conforme o parecer do subagent cooperebr-analista-conformidade.
 *
 * NÃO altera dado. NÃO cria enum. NÃO roda migration.
 * Saída: gera dois arquivos:
 *   - docs/relatorios/2026-05-31-auditoria-53-lancamentos-legados.md
 *   - docs/relatorios/2026-05-31-auditoria-53-lancamentos-legados.csv
 *
 * Material pro contador externo (Walter) validar antes de promover o
 * enum NaturezaCooperativa em LancamentoCaixa.
 *
 * Uso: `npx ts-node scripts/audit-lancamentos-legados-ct.ts` (cwd: backend/)
 */
import { PrismaClient } from '@prisma/client';
import { writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const prisma = new PrismaClient();

type Inferencia = 'PROPRIO' | 'AUXILIAR' | 'NAO_COOPERATIVO' | 'INDETERMINADO';
type Confianca = 'ALTA' | 'MEDIA' | 'BAIXA' | 'INSPECIONAR';

interface Linha {
  id: string;
  competencia: string;
  data: string;
  tipo: string;
  valor: string;
  naturezaAtual: string;
  descricao: string;
  cooperativaId: string | null;
  cooperadoNome: string | null;
  cooperadoStatus: string | null;
  cooperadoTipo: string | null;
  contaContas: string | null;
  convenioNome: string | null;
  naturezaClube: string | null;
  fonte: string;
  inferencia: Inferencia;
  confianca: Confianca;
  precisaWalter: boolean;
  motivo: string;
}

function fmtData(d: Date | null): string {
  if (!d) return '';
  return d.toISOString().slice(0, 10);
}

function inferir(opts: {
  tipo: string;
  descricao: string;
  cooperado?: { status: string; tipoCooperado: string; nomeCompleto: string } | null;
  contratoUsoId?: string | null;
  convenioId?: string | null;
  naturezaClube?: string | null;
}): { inferencia: Inferencia; confianca: Confianca; precisaWalter: boolean; motivo: string; fonte: string } {
  const { tipo, descricao, cooperado, contratoUsoId, convenioId, naturezaClube } = opts;
  const desc = (descricao ?? '').toLowerCase();

  // CooperToken hooks — contabilidade preparatória
  if (naturezaClube) {
    return {
      inferencia: 'PROPRIO',
      confianca: 'MEDIA',
      precisaWalter: true,
      motivo: `Hook CooperToken (${naturezaClube}) — operação interna entre cooperativa e cooperado. Walter confirma classificação tributária do Clube.`,
      fonte: 'naturezaClube',
    };
  }

  // PIX Excedente
  if (desc.includes('pix excedente') || desc.includes('excedente')) {
    return {
      inferencia: 'INDETERMINADO',
      confianca: 'INSPECIONAR',
      precisaWalter: true,
      motivo: 'PIX Excedente — pode ter componente de rendimento financeiro (IR-Fonte 20%). Inspecionar contrato individual.',
      fonte: 'descricao=excedente',
    };
  }

  // Repasse a proprietário externo
  if (
    desc.includes('repasse') ||
    desc.includes('arrendamento') ||
    desc.includes('aluguel da usina') ||
    desc.includes('aluguel de usina')
  ) {
    return {
      inferencia: 'AUXILIAR',
      confianca: 'MEDIA',
      precisaWalter: true,
      motivo: 'Repasse/arrendamento a proprietário externo — convênio de custeio Art. 88 Lei 5.764/71. Walter confirma se contrato cumpre requisitos do Ato Auxiliar.',
      fonte: 'descricao=repasse/arrendamento',
    };
  }

  // Convênio (Sprint 9B)
  if (convenioId) {
    return {
      inferencia: 'AUXILIAR',
      confianca: 'MEDIA',
      precisaWalter: true,
      motivo: `Vinculado a ContratoConvenio (id=${convenioId.slice(0, 8)}…) — provável Ato Auxiliar (Art. 88) se for convênio com terceiro; verificar tipo.`,
      fonte: 'convenioId',
    };
  }

  // Contrato de uso (locação carregador EV, etc) — Sprint 9
  if (contratoUsoId) {
    return {
      inferencia: 'INDETERMINADO',
      confianca: 'INSPECIONAR',
      precisaWalter: true,
      motivo: `Vinculado a ContratoUso (id=${contratoUsoId.slice(0, 8)}…) — pode ser uso por cooperado (Próprio) OU terceiro (Não-Coop). Inspecionar contrato.`,
      fonte: 'contratoUsoId',
    };
  }

  // Cooperado vinculado
  if (cooperado) {
    // USUARIO_CARREGADOR sem vínculo cooperativo
    if (cooperado.tipoCooperado === 'USUARIO_CARREGADOR') {
      return {
        inferencia: 'NAO_COOPERATIVO',
        confianca: 'ALTA',
        precisaWalter: false,
        motivo: 'tipoCooperado=USUARIO_CARREGADOR não tem vínculo cooperativo formal — operação com terceiro.',
        fonte: 'cooperado.tipoCooperado',
      };
    }
    // Cooperado COM_UC/SEM_UC ativo
    if (
      cooperado.tipoCooperado === 'COM_UC' ||
      cooperado.tipoCooperado === 'SEM_UC' ||
      cooperado.tipoCooperado === 'COM_USINA_PROPRIA'
    ) {
      return {
        inferencia: 'PROPRIO',
        confianca: 'ALTA',
        precisaWalter: false,
        motivo: `Cooperado-associado ativo (tipo=${cooperado.tipoCooperado}) — ato cooperativo típico Art. 79 + STF Tema 536.`,
        fonte: 'cooperado.tipoCooperado',
      };
    }
    return {
      inferencia: 'PROPRIO',
      confianca: 'MEDIA',
      precisaWalter: true,
      motivo: `Cooperado vinculado mas tipo=${cooperado.tipoCooperado} (verificar) — assumindo Próprio por default.`,
      fonte: 'cooperado',
    };
  }

  // Despesa operacional sem vínculo cooperado (provável ContaAPagar)
  if (
    tipo === 'DESPESA' ||
    tipo === 'SAIDA' ||
    desc.includes('manutencao') ||
    desc.includes('manutenção') ||
    desc.includes('seguro') ||
    desc.includes('vigil') ||
    desc.includes('roçada') ||
    desc.includes('rocada') ||
    desc.includes('cusd') ||
    desc.includes('iptu') ||
    desc.includes('itr')
  ) {
    return {
      inferencia: 'PROPRIO',
      confianca: 'ALTA',
      precisaWalter: false,
      motivo: 'Despesa operacional de usina — consecução do objeto social cooperativo (Art. 79).',
      fonte: 'tipo=DESPESA + categoria operacional',
    };
  }

  return {
    inferencia: 'INDETERMINADO',
    confianca: 'INSPECIONAR',
    precisaWalter: true,
    motivo: 'Sem fonte rastreável (sem cooperado, contratoUso, convenio, padrão de descrição). Inspecionar individualmente.',
    fonte: 'nenhuma',
  };
}

async function main() {
  console.log('\n=== Auditoria LancamentoCaixa legados (read-only) ===\n');

  const lancamentos = await prisma.lancamentoCaixa.findMany({
    orderBy: { createdAt: 'asc' },
    include: {
      cooperado: {
        select: { id: true, nomeCompleto: true, status: true, tipoCooperado: true },
      },
      planoContas: { select: { codigo: true, nome: true, tipo: true, grupo: true } },
      convenio: { select: { id: true, empresaNome: true } },
    },
  });

  console.log(`Total lançamentos: ${lancamentos.length}`);

  // Distribuição naturezaAto atual
  const distAtual = lancamentos.reduce<Record<string, number>>((acc, l) => {
    acc[l.naturezaAto] = (acc[l.naturezaAto] || 0) + 1;
    return acc;
  }, {});
  console.log('\nDistribuição naturezaAto ATUAL:');
  for (const [k, v] of Object.entries(distAtual)) {
    console.log(`  ${k}: ${v}`);
  }

  // Inferência por linha
  const linhas: Linha[] = lancamentos.map((l) => {
    const inf = inferir({
      tipo: l.tipo,
      descricao: l.descricao,
      cooperado: l.cooperado,
      contratoUsoId: l.contratoUsoId,
      convenioId: l.convenioId,
      naturezaClube: l.naturezaClube,
    });
    const plano = l.planoContas
      ? `${l.planoContas.codigo} ${l.planoContas.nome} [${l.planoContas.grupo}]`
      : null;
    return {
      id: l.id,
      competencia: l.competencia,
      data: fmtData(l.dataPagamento ?? l.dataVencimento ?? l.createdAt),
      tipo: l.tipo,
      valor: l.valor.toString(),
      naturezaAtual: l.naturezaAto,
      descricao: l.descricao,
      cooperativaId: l.cooperativaId,
      cooperadoNome: l.cooperado?.nomeCompleto ?? null,
      cooperadoStatus: l.cooperado?.status ?? null,
      cooperadoTipo: l.cooperado?.tipoCooperado ?? null,
      contaContas: plano,
      convenioNome: l.convenio?.empresaNome ?? null,
      naturezaClube: l.naturezaClube ?? null,
      ...inf,
    };
  });

  // Distribuição inferida
  const distInf = linhas.reduce<Record<string, number>>((acc, l) => {
    acc[l.inferencia] = (acc[l.inferencia] || 0) + 1;
    return acc;
  }, {});
  console.log('\nDistribuição naturezaAto INFERIDA:');
  for (const [k, v] of Object.entries(distInf)) {
    console.log(`  ${k}: ${v}`);
  }

  const distConf = linhas.reduce<Record<string, number>>((acc, l) => {
    acc[l.confianca] = (acc[l.confianca] || 0) + 1;
    return acc;
  }, {});
  console.log('\nDistribuição CONFIANÇA da inferência:');
  for (const [k, v] of Object.entries(distConf)) {
    console.log(`  ${k}: ${v}`);
  }

  const precisaWalter = linhas.filter((l) => l.precisaWalter).length;
  console.log(`\nLinhas que precisam validação Walter: ${precisaWalter}/${linhas.length}`);

  // Normaliza naturezaAtual pra comparar com enum (COOPERADO_PROPRIO → PROPRIO é renomeação esperada)
  const normalizaAtual = (s: string): string => {
    if (s === 'COOPERADO_PROPRIO' || s === 'PROPRIO') return 'PROPRIO';
    if (s === 'AUXILIAR') return 'AUXILIAR';
    if (s === 'NAO_COOPERATIVO' || s === 'NAO_COOP') return 'NAO_COOPERATIVO';
    return s;
  };
  const divergentes = linhas.filter(
    (l) => normalizaAtual(l.naturezaAtual) !== l.inferencia && l.inferencia !== 'INDETERMINADO',
  );
  console.log(`Divergências reais (atual normalizado ≠ inferido, fora de INDETERMINADO): ${divergentes.length}`);

  // ============ MARKDOWN ============
  let md = `# Auditoria 53 LancamentoCaixa legados — pré-migration enum NaturezaCooperativa (31/05/2026)\n\n`;
  md += `> Gerada pelo script \`backend/scripts/audit-lancamentos-legados-ct.ts\` (read-only, NÃO alterou nenhum dado).\n`;
  md += `> **Destino:** Walter (contador externo) — validação antes de promover \`naturezaAto String → enum NaturezaCooperativa\` (Sprint Contabilidade Tributária CT.1).\n`;
  md += `> **Regra CLAUDE.md:** auditoria obrigatória antes de qualquer migration de mudança de tipo (String → Enum). Item A do checklist de segurança de migrations.\n\n`;
  md += `---\n\n`;

  md += `## 1. Resumo executivo\n\n`;
  md += `| Métrica | Valor |\n|---|---|\n`;
  md += `| Total de lançamentos | ${linhas.length} |\n`;
  md += `| Distribuição **atual** \`naturezaAto\` (String livre) | ${Object.entries(distAtual).map(([k, v]) => `${k}=${v}`).join(' / ')} |\n`;
  md += `| Distribuição **inferida** (parecer conformidade) | ${Object.entries(distInf).map(([k, v]) => `${k}=${v}`).join(' / ')} |\n`;
  md += `| Confiança da inferência | ${Object.entries(distConf).map(([k, v]) => `${k}=${v}`).join(' / ')} |\n`;
  md += `| Linhas que **precisam validação Walter** | ${precisaWalter}/${linhas.length} |\n`;
  md += `| **Divergências REAIS** (atual normalizado ≠ inferida, fora de INDETERMINADO) | ${divergentes.length} |\n\n`;
  md += `> **Nota sobre divergência:** \`COOPERADO_PROPRIO\` (String legado) → \`PROPRIO\` (enum) é renomeação esperada na migration, NÃO divergência. Só conta como divergência real quando a inferência aponta classificação diferente de PROPRIO (ex: AUXILIAR ou NAO_COOPERATIVO).\n\n`;

  md += `## 2. Critérios de inferência aplicados\n\n`;
  md += `Baseados no parecer do subagent \`cooperebr-analista-conformidade\` (Sprint CT Fase 1):\n\n`;
  md += `1. **PROPRIO** — Cooperado-associado ativo (tipo \`COM_UC\` / \`SEM_UC\` / \`COM_USINA_PROPRIA\`) ou despesa operacional de usina (Art. 79 + STF Tema 536). Confiança ALTA.\n`;
  md += `2. **NAO_COOPERATIVO** — Cooperado tipo \`USUARIO_CARREGADOR\` (sem vínculo cooperativo formal). Confiança ALTA.\n`;
  md += `3. **AUXILIAR** — Repasse/arrendamento a proprietário externo OU vínculo com ContratoConvenio (Art. 88 Lei 5.764/71). Confiança MEDIA — Walter valida se contrato cumpre requisitos.\n`;
  md += `4. **INDETERMINADO** — PIX Excedente, ContratoUso (carregador EV), ou sem fonte rastreável. Confiança INSPECIONAR — Walter analisa caso-a-caso.\n\n`;
  md += `**Riscos endereçados pelo parecer:**\n`;
  md += `- Risco 1 (CRÍTICO): perda total isenção PIS/COFINS por falta de segregação — esta auditoria estabelece a baseline.\n`;
  md += `- Risco 5 (MÉDIO): 53 lançamentos com default \`COOPERADO_PROPRIO\` sem validação — esta auditoria identifica os divergentes.\n\n`;

  md += `## 3. Inventário completo (${linhas.length} linhas)\n\n`;
  md += `| # | id | data | tipo | valor | Natureza ATUAL | Natureza INFERIDA | Confiança | Walter? | Fonte da inferência | Descrição |\n`;
  md += `|---|---|---|---|---|---|---|---|---|---|---|\n`;
  linhas.forEach((l, idx) => {
    md += `| ${idx + 1} | \`${l.id.slice(0, 12)}…\` | ${l.data} | ${l.tipo} | ${l.valor} | ${l.naturezaAtual} | **${l.inferencia}** | ${l.confianca} | ${l.precisaWalter ? '⚠️ SIM' : 'não' } | ${l.fonte} | ${l.descricao.slice(0, 60)}${l.descricao.length > 60 ? '…' : ''} |\n`;
  });
  md += `\n`;

  md += `## 4. Linhas que PRECISAM validação Walter (${precisaWalter})\n\n`;
  const walterLinhas = linhas.filter((l) => l.precisaWalter);
  if (walterLinhas.length === 0) {
    md += `_Nenhuma — todas as linhas têm inferência ALTA confiança._\n\n`;
  } else {
    md += `| # | id | data | valor | Inferida | Motivo |\n|---|---|---|---|---|---|\n`;
    walterLinhas.forEach((l, idx) => {
      md += `| ${idx + 1} | \`${l.id.slice(0, 12)}…\` | ${l.data} | ${l.valor} | ${l.inferencia} | ${l.motivo} |\n`;
    });
    md += `\n`;
  }

  md += `## 5. Divergências REAIS (atual normalizado ≠ inferida, fora de INDETERMINADO) — ${divergentes.length}\n\n`;
  if (divergentes.length === 0) {
    md += `_**Nenhuma divergência real.** Todos os lançamentos com inferência ALTA confiança batem com o valor atual (\`COOPERADO_PROPRIO\` → \`PROPRIO\` é renomeação enum esperada). Apenas as ${precisaWalter} linhas marcadas Walter precisam validação manual._\n\n`;
  } else {
    md += `| id | data | descrição | naturezaAtual | naturezaInferida | confiança | motivo |\n|---|---|---|---|---|---|---|\n`;
    divergentes.forEach((l) => {
      md += `| \`${l.id.slice(0, 12)}…\` | ${l.data} | ${l.descricao.slice(0, 40)} | ${l.naturezaAtual} | **${l.inferencia}** | ${l.confianca} | ${l.motivo} |\n`;
    });
    md += `\n`;
  }

  md += `## 6. Plano de promoção String → enum (proposto)\n\n`;
  md += `**Passo 1 — UPDATE de normalização (após validação Walter):**\n\n`;
  md += `1. Para cada linha de confiança **ALTA**, aplicar a inferência automaticamente.\n`;
  md += `2. Para cada linha **MEDIA**, conferir com Walter antes de aplicar.\n`;
  md += `3. Para cada linha **INSPECIONAR** (INDETERMINADO), Walter define caso-a-caso.\n\n`;
  md += `**Passo 2 — ALTER TYPE (após 100% das linhas terem valor válido do enum):**\n\n`;
  md += `\`\`\`prisma\nmodel LancamentoCaixa {\n  naturezaAto NaturezaCooperativa @default(PROPRIO)\n}\n\nenum NaturezaCooperativa { PROPRIO AUXILIAR NAO_COOPERATIVO }\n\`\`\`\n\n`;
  md += `**Validação pós-migration:** \`SELECT naturezaAto, COUNT(*) FROM lancamentos_caixa GROUP BY naturezaAto;\` deve mostrar 3 buckets.\n\n`;

  md += `## 7. Apêndice — CSV completo\n\n`;
  md += `Tabela machine-readable em \`docs/relatorios/2026-05-31-auditoria-53-lancamentos-legados.csv\`.\n`;

  // ============ CSV ============
  let csv = `id,data,tipo,valor,natureza_atual,natureza_inferida,confianca,precisa_walter,fonte,cooperado_nome,cooperado_tipo,convenio_nome,natureza_clube,descricao\n`;
  for (const l of linhas) {
    const esc = (s: string | null) => (s ?? '').replace(/"/g, '""');
    csv += `"${l.id}","${l.data}","${l.tipo}","${l.valor}","${l.naturezaAtual}","${l.inferencia}","${l.confianca}","${l.precisaWalter ? 'SIM' : 'NAO'}","${esc(l.fonte)}","${esc(l.cooperadoNome)}","${esc(l.cooperadoTipo)}","${esc(l.convenioNome)}","${esc(l.naturezaClube)}","${esc(l.descricao)}"\n`;
  }

  const outMd = resolve(__dirname, '..', '..', 'docs', 'relatorios', '2026-05-31-auditoria-53-lancamentos-legados.md');
  const outCsv = resolve(__dirname, '..', '..', 'docs', 'relatorios', '2026-05-31-auditoria-53-lancamentos-legados.csv');
  writeFileSync(outMd, md, 'utf8');
  writeFileSync(outCsv, csv, 'utf8');

  console.log(`\nRelatório markdown: ${outMd}`);
  console.log(`Relatório CSV: ${outCsv}`);
  console.log('\nDONE — read-only, zero dados alterados.\n');
}

main()
  .catch((err) => {
    console.error('Erro fatal:', err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
