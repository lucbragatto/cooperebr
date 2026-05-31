/**
 * CT.1 Migration Passo 1 (31/05/2026) — Normalizar `naturezaAto` String legado
 * antes da promoção pra enum NaturezaCooperativa.
 *
 * Conformidade — regra CLAUDE.md item C migrations (2 passos UPDATE + ALTER).
 * Auditoria pré-migração: docs/relatorios/2026-05-31-auditoria-53-lancamentos-legados.md
 * Resultado: 58 lançamentos, 0 divergências reais, 55 ALTA + 3 INSPECIONAR.
 *
 * Estratégia (dados TESTE — prod-like mas validável):
 *   - "COOPERADO_PROPRIO" → "PROPRIO"  (renomeação esperada)
 *   - 3 INSPECIONAR (sem cooperado rastreável) → "PROPRIO" provisório com
 *     observacaoContabil flagged "Walter revisar — sem cooperado rastreável"
 *
 * Rodar ANTES do db push do schema com enum. Idempotente.
 */
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('\n=== CT.1 Migration Passo 1 — normalizar naturezaAto ===\n');

  const antes = await prisma.lancamentoCaixa.groupBy({
    by: ['naturezaAto'],
    _count: true,
  });
  console.log('ANTES:');
  antes.forEach((g) => console.log(`  ${g.naturezaAto}: ${g._count}`));

  // Promoção COOPERADO_PROPRIO → PROPRIO (renomeação esperada do enum)
  const resCooperado = await prisma.lancamentoCaixa.updateMany({
    where: { naturezaAto: 'COOPERADO_PROPRIO' },
    data: { naturezaAto: 'PROPRIO' },
  });
  console.log(`\nNormalização COOPERADO_PROPRIO → PROPRIO: ${resCooperado.count} linhas`);

  // Flag pros 3 INSPECIONAR (sem cooperadoId) — provisório PROPRIO, Walter revisa
  const inspecionar = await prisma.lancamentoCaixa.findMany({
    where: { cooperadoId: null, naturezaAto: 'PROPRIO' },
    select: { id: true, descricao: true },
  });
  console.log(`\nLinhas INSPECIONAR (sem cooperado, flag Walter): ${inspecionar.length}`);
  for (const l of inspecionar) {
    await prisma.lancamentoCaixa.update({
      where: { id: l.id },
      data: {
        observacaoContabil:
          'CT.1 Walter revisar — sem cooperado rastreável (provisório PROPRIO). Vide auditoria 31/05/2026.',
      },
    });
    console.log(`  flag: ${l.id} — ${l.descricao.slice(0, 50)}`);
  }

  const depois = await prisma.lancamentoCaixa.groupBy({
    by: ['naturezaAto'],
    _count: true,
  });
  console.log('\nDEPOIS:');
  depois.forEach((g) => console.log(`  ${g.naturezaAto}: ${g._count}`));

  const total = depois.reduce((acc, g) => acc + g._count, 0);
  const valoresValidos = ['PROPRIO', 'AUXILIAR', 'NAO_COOPERATIVO'];
  const invalidos = depois.filter((g) => !valoresValidos.includes(g.naturezaAto));

  if (invalidos.length > 0) {
    console.error('\n❌ ERRO — valores fora do enum esperado:');
    invalidos.forEach((g) => console.error(`  ${g.naturezaAto}: ${g._count}`));
    console.error('Corrija antes de prosseguir com Passo 2 (ALTER TYPE).');
    process.exitCode = 1;
    return;
  }

  console.log(`\n✅ ${total} lançamentos prontos pro Passo 2 (ALTER String → enum NaturezaCooperativa)\n`);
}

main()
  .catch((err) => {
    console.error('Erro fatal:', err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
