/**
 * Inspeção forense do resultado Concierge da fatura do Luciano.
 *
 * Mostra:
 *   1. Rubricas RAW extraídas pelo OCR
 *   2. FaturaCanonica classificada pelo adapter
 *   3. Totais tributários consolidados
 *   4. Por que cada detector retornou SEM_DIVERGENCIA
 *
 * Read-only.
 *
 * Executar:
 *   cd C:\Users\Luciano\cooperebr\backend
 *   npx ts-node scripts/inspecionar-concierge-luciano.ts
 */

import 'dotenv/config';
import { PrismaClient } from '@prisma/client';

interface ConciergeNamespace {
  ocr?: {
    metadados?: Record<string, unknown>;
    rubricas?: Array<{
      descricao: string;
      unidade?: string;
      quantidade?: number;
      precoUnitarioComTributos?: number;
      tarifaUnitariaBase?: number;
      valorTotalReais?: number;
      baseCalculoIcms?: number;
      aliquotaIcms?: number;
      valorIcms?: number;
      valorPisCofins?: number;
    }>;
    observacoesParser?: string;
  };
  faturaCanonica?: {
    distribuidora: string;
    grupoTarifario: string;
    subgrupo: string;
    classeUso: string;
    classificacaoScee: string;
    rubricas: Array<{
      tipo: string;
      descricaoOriginal: string;
      posto?: string;
      quantidade: number;
      valorTotalReais: number;
      baseCalculoIcms: number;
      aliquotaIcms: number;
      valorIcms: number;
      valorPisCofins: number;
    }>;
    valorTotalFatura: number;
    totaisTributarios: {
      pisCofinsCobrado: number;
      basePisCofinsDeclarada: number;
      aliquotaPis: number;
      aliquotaCofins: number;
      icmsCobrado: number;
      icmsSobreInjecao: number;
      icmsLiquido: number;
      baseIcmsTotal: number;
      aliquotaIcms: number;
    };
  };
  padroes?: Array<{
    codigo: string;
    sinal: string;
    valorIndebitoMensal: number;
    detalhe: string;
  }>;
  indebitoMensalTotal?: number;
}

async function main(): Promise<void> {
  const prisma = new PrismaClient();

  const cooperado = await prisma.cooperado.findFirst({
    where: { email: 'lucbragatto@gmail.com' },
    select: {
      faturasProcessadas: {
        select: { id: true, dadosExtraidos: true, mesReferencia: true },
        take: 1,
        orderBy: { createdAt: 'desc' },
      },
    },
  });
  if (!cooperado || cooperado.faturasProcessadas.length === 0) {
    console.log('Sem fatura.');
    await prisma.$disconnect();
    return;
  }

  const fatura = cooperado.faturasProcessadas[0];
  const dados = fatura.dadosExtraidos as { concierge?: ConciergeNamespace };
  const concierge = dados.concierge;

  if (!concierge) {
    console.log('❌ Concierge namespace vazio — script de re-OCR não rodou ainda.');
    await prisma.$disconnect();
    return;
  }

  // ─── 1. METADADOS OCR ───
  console.log('═'.repeat(80));
  console.log('1. METADADOS OCR (o que o Claude extraiu do PDF)');
  console.log('═'.repeat(80));
  const meta = concierge.ocr?.metadados ?? {};
  for (const [k, v] of Object.entries(meta)) {
    console.log(`  ${k.padEnd(28)} = ${JSON.stringify(v)}`);
  }
  if (concierge.ocr?.observacoesParser) {
    console.log(`\n  Observações parser: ${concierge.ocr.observacoesParser}`);
  }

  // ─── 2. RUBRICAS RAW ───
  console.log('\n' + '═'.repeat(80));
  console.log('2. RUBRICAS RAW (cada linha da tabela "Detalhes do faturamento")');
  console.log('═'.repeat(80));
  const rubricas = concierge.ocr?.rubricas ?? [];
  console.log(`\nTotal: ${rubricas.length} rubricas\n`);
  for (let i = 0; i < rubricas.length; i++) {
    const r = rubricas[i];
    console.log(`[${i + 1}] ${r.descricao}`);
    console.log(`    qtd=${r.quantidade ?? 0} ${r.unidade ?? ''} | preço c/trib=${r.precoUnitarioComTributos ?? 0} | tarifa base=${r.tarifaUnitariaBase ?? 0}`);
    console.log(`    valor R$=${r.valorTotalReais ?? 0} | base ICMS=${r.baseCalculoIcms ?? 0} | alíq=${r.aliquotaIcms ?? 0} | ICMS=${r.valorIcms ?? 0} | PIS+COFINS=${r.valorPisCofins ?? 0}`);
  }

  // ─── 3. FATURA CANÔNICA (classificada pelo adapter) ───
  console.log('\n' + '═'.repeat(80));
  console.log('3. FATURA CANÔNICA (como o adapter EDP_ES classificou)');
  console.log('═'.repeat(80));
  const fc = concierge.faturaCanonica;
  if (!fc) {
    console.log('  ❌ FaturaCanonica não foi gerada — adapter falhou?');
  } else {
    console.log(`  Distribuidora:     ${fc.distribuidora}`);
    console.log(`  Grupo / Subgrupo:  ${fc.grupoTarifario} / ${fc.subgrupo}`);
    console.log(`  Classe / SCEE:     ${fc.classeUso} / ${fc.classificacaoScee}`);
    console.log(`  Valor total:       R$ ${fc.valorTotalFatura.toFixed(2)}`);

    console.log('\n  Rubricas classificadas:');
    for (const r of fc.rubricas) {
      const posto = r.posto ? `[${r.posto}]` : '';
      console.log(
        `    ${r.tipo.padEnd(22)} ${posto.padEnd(12)} qtd=${String(r.quantidade).padStart(8)} valor=${String(r.valorTotalReais.toFixed(2)).padStart(10)} ICMS=${String(r.valorIcms.toFixed(2)).padStart(7)} PIS+COFINS=${String(r.valorPisCofins.toFixed(2)).padStart(7)}`,
      );
      console.log(`    └─ raw: "${r.descricaoOriginal}"`);
    }

    console.log('\n  Totais tributários consolidados:');
    const t = fc.totaisTributarios;
    console.log(`    PIS+COFINS cobrado:        R$ ${t.pisCofinsCobrado.toFixed(2)}`);
    console.log(`    Base PIS/COFINS declarada: R$ ${t.basePisCofinsDeclarada.toFixed(2)}`);
    console.log(`    Alíquota PIS:              ${(t.aliquotaPis * 100).toFixed(2)}%`);
    console.log(`    Alíquota COFINS:           ${(t.aliquotaCofins * 100).toFixed(2)}%`);
    console.log(`    ICMS cobrado (positivo):   R$ ${t.icmsCobrado.toFixed(2)}`);
    console.log(`    ICMS sobre injeção (neg):  R$ ${t.icmsSobreInjecao.toFixed(2)}`);
    console.log(`    ICMS líquido:              R$ ${t.icmsLiquido.toFixed(2)}`);
    console.log(`    Base ICMS total:           R$ ${t.baseIcmsTotal.toFixed(2)}`);
    console.log(`    Alíquota ICMS efetiva:     ${(t.aliquotaIcms * 100).toFixed(2)}%`);
  }

  // ─── 4. RESULTADO DETECTORES ───
  console.log('\n' + '═'.repeat(80));
  console.log('4. RESULTADO DOS 4 DETECTORES');
  console.log('═'.repeat(80));
  const padroes = concierge.padroes ?? [];
  console.log(`\nPadrões detectados (não SEM_DIVERGENCIA): ${padroes.length}`);
  for (const p of padroes) {
    console.log(`\n  [${p.codigo}]`);
    console.log(`    Sinal: ${p.sinal}`);
    console.log(`    Indébito mensal: R$ ${p.valorIndebitoMensal.toFixed(2)}`);
    console.log(`    Detalhe: ${p.detalhe}`);
  }
  if (padroes.length === 0) {
    console.log('\n  ⚠️  Nenhum padrão detectado.');
    console.log('  Hipóteses (em ordem de probabilidade):');
    console.log('    (a) EDP_ES está conforme nas 3 teses majoritárias (igual CEMIG/MG)');
    console.log('    (b) Rubricas SCEE não foram classificadas corretamente pelo adapter');
    console.log('    (c) OCR não extraiu campos tributários por rubrica (deixou em 0)');
    console.log('    (d) Detectores são mais conservadores que a estimativa caminho-B');
  }

  console.log(`\n💰 Indébito mensal total: R$ ${(concierge.indebitoMensalTotal ?? 0).toFixed(2)}\n`);

  await prisma.$disconnect();
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
