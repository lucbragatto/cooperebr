/**
 * Diagnóstico — distribuição de UCs CoopereBR por distribuidora.
 *
 * Hipótese a confirmar: 261 cooperados sem fatura processada estão bloqueados
 * porque a UC deles tem `distribuidora = OUTRAS` (default), o que pode estar
 * impedindo match correto no pipeline IMAP→OCR ou em outros lugares.
 *
 * Read-only. Sem PII no output.
 *
 * Executar:
 *   cd C:\Users\Luciano\cooperebr\backend
 *   npx ts-node scripts/diagnostico-distribuidora-uc.ts
 */

import 'dotenv/config';
import { PrismaClient } from '@prisma/client';

async function main(): Promise<void> {
  const prisma = new PrismaClient();

  // Pega CoopereBR REAL (maior tenant com "CoopereBR" no nome)
  const candidatas = await prisma.cooperativa.findMany({
    where: { nome: { contains: 'CoopereBR', mode: 'insensitive' } },
    select: { id: true, nome: true, _count: { select: { cooperados: true } } },
  });
  const coop = candidatas.reduce((max, atual) =>
    atual._count.cooperados > max._count.cooperados ? atual : max,
  );
  console.log(`\nCooperativa: ${coop.nome} (id=${coop.id})\n`);

  // Distribuição total de UCs por distribuidora (cooperados ATIVOS)
  const dist = await prisma.uc.groupBy({
    by: ['distribuidora'],
    _count: { id: true },
    where: { cooperado: { cooperativaId: coop.id, status: 'ATIVO' as never } },
    orderBy: { _count: { id: 'desc' } },
  });

  const total = dist.reduce((s, r) => s + r._count.id, 0);

  console.log('=== UCs de cooperados ATIVOS por distribuidora ===');
  for (const r of dist) {
    const pct = ((r._count.id / total) * 100).toFixed(1);
    console.log(`  ${r.distribuidora.padEnd(10)} : ${String(r._count.id).padStart(4)} UCs (${pct}%)`);
  }
  console.log(`  ${'TOTAL'.padEnd(10)} : ${String(total).padStart(4)} UCs\n`);

  // Quantas UCs de cooperados COM fatura processada já têm distribuidora correta
  const comFatura = await prisma.uc.groupBy({
    by: ['distribuidora'],
    _count: { id: true },
    where: {
      cooperado: { cooperativaId: coop.id, status: 'ATIVO' as never },
      faturasProcessadas: { some: {} },
    },
  });
  console.log('=== UCs COM fatura processada — distribuição ===');
  for (const r of comFatura) {
    console.log(`  ${r.distribuidora.padEnd(10)} : ${r._count.id} UCs`);
  }
  console.log();

  // Cooperados SEM fatura — distribuição das UCs
  const semFatura = await prisma.uc.groupBy({
    by: ['distribuidora'],
    _count: { id: true },
    where: {
      cooperado: { cooperativaId: coop.id, status: 'ATIVO' as never },
      faturasProcessadas: { none: {} },
    },
    orderBy: { _count: { id: 'desc' } },
  });
  console.log('=== UCs SEM fatura processada — distribuição ===');
  for (const r of semFatura) {
    console.log(`  ${r.distribuidora.padEnd(10)} : ${r._count.id} UCs`);
  }
  console.log();

  // Conclusão automática
  const outrasSemFat = semFatura.find((r) => r.distribuidora === 'OUTRAS')?._count.id ?? 0;
  const edpEsSemFat = semFatura.find((r) => r.distribuidora === 'EDP_ES')?._count.id ?? 0;
  const totalSemFat = semFatura.reduce((s, r) => s + r._count.id, 0);

  console.log('=== CONCLUSÃO ===');
  console.log(`UCs de cooperados ATIVOS sem fatura: ${totalSemFat}`);
  console.log(`  Com distribuidora=OUTRAS (default): ${outrasSemFat} (${totalSemFat > 0 ? ((outrasSemFat / totalSemFat) * 100).toFixed(1) : 0}%)`);
  console.log(`  Com distribuidora=EDP_ES:           ${edpEsSemFat} (${totalSemFat > 0 ? ((edpEsSemFat / totalSemFat) * 100).toFixed(1) : 0}%)`);

  if (outrasSemFat > totalSemFat / 2) {
    console.log('\n⚠️  HIPÓTESE CONFIRMADA: maioria das UCs sem fatura tem distribuidora=OUTRAS.');
    console.log('    Sugestão: UPDATE em massa pra EDP_ES (98%+ das UCs CoopereBR são ES).');
    console.log('    Próximo passo: rodar script de auditoria endereço/cidade pra validar.');
  } else {
    console.log('\nℹ️  Hipótese NÃO confirmada — gargalo NÃO é distribuidora.');
    console.log('    Provável causa: cooperados realmente nunca enviaram fatura pra contato@cooperebr.com.br.');
    console.log('    Próximo passo: campanha WhatsApp/email pedindo última fatura.');
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
