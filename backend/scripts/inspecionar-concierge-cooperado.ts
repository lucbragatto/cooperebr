/**
 * Inspeção forense da auditoria Concierge de QUALQUER cooperado.
 *
 * Mostra rubricas RAW, FaturaCanonica classificada, totais consolidados
 * e o cálculo de cada detector. Permite Luciano auditar manualmente que
 * a conta do script está correta.
 *
 * Read-only.
 *
 * Executar:
 *   npx ts-node scripts/inspecionar-concierge-cooperado.ts --nome="sergio magdalena"
 *   npx ts-node scripts/inspecionar-concierge-cooperado.ts --nome="celio cavalcanti"
 *   npx ts-node scripts/inspecionar-concierge-cooperado.ts --nome="luciano costa"
 */

import 'dotenv/config';
import { PrismaClient } from '@prisma/client';

interface ConciergeNamespace {
  ocr?: { metadados?: Record<string, unknown>; rubricas?: Array<Record<string, unknown>> };
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
    totaisTributarios: Record<string, number>;
  };
  padroes?: Array<{
    codigo: string;
    sinal: string;
    valorIndebitoMensal: number;
    valorIndebito60mSelic: number;
    detalhe: string;
  }>;
  indebitoMensalTotal?: number;
  indebito60mSelicTotal?: number;
}

async function main(): Promise<void> {
  const arg = process.argv[2] ?? '';
  const nome = arg.startsWith('--nome=') ? arg.slice(7).replace(/^"|"$/g, '') : null;
  if (!nome) {
    console.log('Uso: npx ts-node scripts/inspecionar-concierge-cooperado.ts --nome="parte do nome"');
    process.exit(1);
  }

  const prisma = new PrismaClient();

  const cooperado = await prisma.cooperado.findFirst({
    where: { nomeCompleto: { contains: nome, mode: 'insensitive' } },
    select: {
      nomeCompleto: true,
      faturasProcessadas: {
        select: { id: true, dadosExtraidos: true, mesReferencia: true },
        take: 1,
        orderBy: { createdAt: 'desc' },
      },
    },
  });
  if (!cooperado || cooperado.faturasProcessadas.length === 0) {
    console.log(`Nenhum cooperado com nome contendo "${nome}".`);
    await prisma.$disconnect();
    return;
  }

  const f = cooperado.faturasProcessadas[0];
  const concierge = (f.dadosExtraidos as { concierge?: ConciergeNamespace }).concierge;
  if (!concierge) {
    console.log('Concierge namespace vazio — fatura não foi re-OCRizada.');
    await prisma.$disconnect();
    return;
  }

  console.log(`\n${'═'.repeat(80)}`);
  console.log(`COOPERADO: ${cooperado.nomeCompleto}`);
  console.log(`FATURA:    ${f.id} (mês ${f.mesReferencia ?? '-'})`);
  console.log('═'.repeat(80));

  // METADADOS
  console.log('\nMETADADOS:');
  const meta = concierge.ocr?.metadados ?? {};
  for (const [k, v] of Object.entries(meta)) {
    if (v === null || v === undefined || v === '') continue;
    console.log(`  ${k.padEnd(28)} = ${JSON.stringify(v)}`);
  }

  // FATURA CANÔNICA
  const fc = concierge.faturaCanonica;
  if (fc) {
    console.log('\nFATURA CANÔNICA:');
    console.log(`  Distribuidora: ${fc.distribuidora}`);
    console.log(`  Grupo/Subgrupo/Classe: ${fc.grupoTarifario}/${fc.subgrupo}/${fc.classeUso}`);
    console.log(`  Classif SCEE: ${fc.classificacaoScee}`);
    console.log(`  Valor total: R$ ${fc.valorTotalFatura.toFixed(2)}`);

    console.log('\n  Rubricas classificadas:');
    for (const r of fc.rubricas) {
      console.log(
        `    ${r.tipo.padEnd(22)} qtd=${String(r.quantidade).padStart(10)} valor=${r.valorTotalReais.toFixed(2).padStart(10)} ICMS=${r.valorIcms.toFixed(2).padStart(7)} PIS+COFINS=${r.valorPisCofins.toFixed(2).padStart(7)}`,
      );
    }

    console.log('\n  Totais tributários:');
    for (const [k, v] of Object.entries(fc.totaisTributarios)) {
      console.log(`    ${k.padEnd(28)} = ${typeof v === 'number' ? (k.includes('liquota') ? (v * 100).toFixed(2) + '%' : 'R$ ' + v.toFixed(2)) : v}`);
    }
  }

  // DETECTORES
  console.log('\nDETECTORES:');
  const padroes = concierge.padroes ?? [];
  console.log(`  Padrões detectados: ${padroes.length}`);
  console.log(`  Indébito mensal total: R$ ${(concierge.indebitoMensalTotal ?? 0).toFixed(2)}`);
  console.log(`  Indébito 60m+SELIC:    R$ ${(concierge.indebito60mSelicTotal ?? 0).toFixed(2)}`);

  for (const p of padroes) {
    console.log(`\n  ─── ${p.codigo} ───`);
    console.log(`    Sinal:  ${p.sinal}`);
    console.log(`    Mensal: R$ ${p.valorIndebitoMensal.toFixed(2)}`);
    console.log(`    60m:    R$ ${p.valorIndebito60mSelic.toFixed(2)}`);
    console.log(`    Detalhe:`);
    for (const linha of p.detalhe.split(' | ')) {
      console.log(`      ${linha.trim()}`);
    }
  }

  console.log();
  await prisma.$disconnect();
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
