/**
 * Revisao de mensagens do fluxo conversacional do bot WhatsApp.
 * Read-only. PARTE 4 do prompt 21/05.
 *
 * Inclui: modelos referenciados por FluxoEtapa (ATIVAS + INATIVAS) + ajuda +
 * cancelar (disparados por palavra-chave do bot hardcoded).
 *
 * Exclui: jobs (cobranca_mensal, lembrete_vencimento_d3, pagamento_confirmado,
 * convite_mlm, nps_trimestral, onboarding_30d, reengajamento_60d,
 * geracao_baixa_mes, proposta_pdf, processando_fatura).
 *
 * Pra cada modelo: extrai {{x}} no conteudo, cruza com vars populadas pelo
 * extrairVariaveis() do motor, classifica orfa REAL vs populada-em-producao.
 */
import { PrismaClient } from '@prisma/client';

const COOP_ID = 'cmn0ho8bx0000uox8wu96u6fd';

// Variaveis que extrairVariaveis() populating (com flag: populadaEmProducao quando
// depende de OCR / dadosTemp dinamico / cooperado logado)
const VARIAVEIS_POPULADAS: Record<string, { fonte: string; producao: boolean }> = {
  // Cooperativa (sempre populada se cooperativaId conhecido)
  parceiro: { fonte: 'coop.nome', producao: false },
  cooperativa: { fonte: 'coop.nome', producao: false },
  cidade: { fonte: 'coop.cidade', producao: false },
  estado_parceiro: { fonte: 'coop.estado', producao: false },
  email_suporte: { fonte: 'coop.email', producao: false },
  telefone_suporte: { fonte: 'coop.telefone', producao: false },
  tipo_parceiro: { fonte: 'coop.tipoParceiro', producao: false },
  tipo_membro: { fonte: 'getLabelMembro(coop.tipoParceiro)', producao: false },
  tipo_membro_plural: { fonte: 'getLabelMembro(coop.tipoParceiro)', producao: false },

  // dadosTemp (populadas em producao pelo handler do bot real)
  nome: { fonte: 'dadosTemp.titular', producao: true },
  titular: { fonte: 'dadosTemp.titular', producao: true },
  endereco: { fonte: 'dadosTemp.enderecoInstalacao', producao: true },
  uc: { fonte: 'dadosTemp.numeroUC', producao: true },
  distribuidora: { fonte: 'dadosTemp.distribuidora', producao: true },
  valorFaturaMedia: { fonte: 'dadosTemp.valorFaturaMedia', producao: true },
  valorComDesconto: { fonte: 'dadosTemp.valorComDesconto', producao: true },
  mes: { fonte: 'dadosTemp.mesReferencia', producao: true },

  // Resultado do motor-proposta
  economia: { fonte: 'resultado.economiaMensal', producao: true },
  economiaMensal: { fonte: 'resultado.economiaMensal', producao: true },
  economiaAnual: { fonte: 'resultado.economiaAnual', producao: true },
  desconto: { fonte: 'resultado.descontoPercentual', producao: true },
  kwhContrato: { fonte: 'resultado.kwhContrato', producao: true },

  // Constantes (sempre string vazia hoje — sub-debitos)
  link: { fonte: "''", producao: true },
  link_pagamento: { fonte: "''", producao: true },
  percentual: { fonte: "''", producao: true },
  site: { fonte: "''", producao: true },
};

// Modelos de JOB (excluir da analise — disparados por crons, nao pelo fluxo)
const NOMES_JOB = new Set([
  'cobranca_mensal',
  'lembrete_vencimento_d3',
  'pagamento_confirmado',
  'convite_mlm',
  'nps_trimestral',
  'onboarding_30d',
  'reengajamento_60d',
  'geracao_baixa_mes',
  'proposta_pdf',
  'processando_fatura',
]);

function extrairVariaveis(conteudo: string): string[] {
  const re = /\{\{([a-zA-Z_]+)\}\}/g;
  const set = new Set<string>();
  let m: RegExpExecArray | null;
  while ((m = re.exec(conteudo)) !== null) set.add(m[1]);
  return [...set].sort();
}

async function main(): Promise<void> {
  const prisma = new PrismaClient();
  try {
    const modelos = await prisma.modeloMensagem.findMany({
      where: { OR: [{ cooperativaId: COOP_ID }, { cooperativaId: null }] },
      orderBy: [{ nome: 'asc' }],
    });

    const etapas = await prisma.fluxoEtapa.findMany({
      where: { OR: [{ cooperativaId: COOP_ID }, { cooperativaId: null }] },
    });

    // Mapa: modeloId -> [etapas que usam]
    const refsPorModelo = new Map<string, Array<{ nome: string; estado: string; ativo: boolean }>>();
    for (const e of etapas) {
      if (!e.modeloMensagemId) continue;
      const arr = refsPorModelo.get(e.modeloMensagemId) ?? [];
      arr.push({ nome: e.nome, estado: e.estado, ativo: e.ativo });
      refsPorModelo.set(e.modeloMensagemId, arr);
    }

    // Filtrar: incluir modelos de etapa OU ajuda/cancelar (hardcoded)
    const modelosRevisao = modelos.filter((m) => {
      if (NOMES_JOB.has(m.nome)) return false;
      const usadoPorEtapa = refsPorModelo.has(m.id);
      const eHardcoded = m.nome === 'ajuda' || m.nome === 'cancelar';
      return usadoPorEtapa || eHardcoded;
    });

    console.log(`\n═══ REVISAO DAS MENSAGENS — ${modelosRevisao.length} modelos do fluxo conversacional ═══\n`);

    // Detector de duplicacao por similaridade de conteudo (primeiras 60 chars)
    const conteudosMap = new Map<string, string[]>();
    for (const m of modelosRevisao) {
      const chave = m.conteudo.slice(0, 60).trim();
      const arr = conteudosMap.get(chave) ?? [];
      arr.push(m.nome);
      conteudosMap.set(chave, arr);
    }

    for (const m of modelosRevisao) {
      const vars = extrairVariaveis(m.conteudo);
      const refs = refsPorModelo.get(m.id) ?? [];
      const refsStr =
        refs.length > 0
          ? refs.map((r) => `${r.ativo ? '✅' : '❌'} "${r.nome}" (${r.estado})`).join(' | ')
          : '(disparado por palavra-chave hardcoded)';

      // Classificar variaveis
      const orfasReais: string[] = [];
      const populadasProducao: string[] = [];
      const populadasSempre: string[] = [];
      for (const v of vars) {
        const meta = VARIAVEIS_POPULADAS[v];
        if (!meta) orfasReais.push(v);
        else if (meta.producao) populadasProducao.push(v);
        else populadasSempre.push(v);
      }

      console.log(`──────────────────────────────────────────`);
      console.log(`📨 ${m.nome} (id=${m.id})`);
      console.log(`   Escopo: ${m.cooperativaId === null ? 'GLOBAL' : 'TENANT'} | Categoria: ${m.categoria}`);
      console.log(`   Usado por: ${refsStr}`);
      console.log(`   Variaveis (${vars.length}): ${vars.length > 0 ? vars.map((v) => `{{${v}}}`).join(', ') : '(nenhuma)'}`);
      if (orfasReais.length > 0) {
        console.log(`   ⚠️ ORFAS REAIS (motor NUNCA popula): ${orfasReais.map((v) => `{{${v}}}`).join(', ')}`);
      }
      if (populadasProducao.length > 0) {
        console.log(`   📊 Populadas em producao (vazias no simulador): ${populadasProducao.map((v) => `{{${v}}}`).join(', ')}`);
      }
      if (populadasSempre.length > 0) {
        console.log(`   ✅ Populadas sempre (tenant): ${populadasSempre.map((v) => `{{${v}}}`).join(', ')}`);
      }
      console.log(`   Conteudo: ${JSON.stringify(m.conteudo)}`);
    }

    // Reporte duplicacoes
    console.log(`\n══════════════════════════════════════════════════`);
    console.log('🔄 Duplicacao por conteudo (primeiras 60 chars iguais):');
    let dups = 0;
    for (const [chave, lista] of conteudosMap) {
      if (lista.length > 1) {
        dups++;
        console.log(`  - "${chave.slice(0, 40)}..." -> ${lista.join(' / ')}`);
      }
    }
    if (dups === 0) console.log('  (nenhuma)');

    console.log('\n[revisao-mensagens] Concluido.');
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((e) => { console.error(e); process.exit(1); });
