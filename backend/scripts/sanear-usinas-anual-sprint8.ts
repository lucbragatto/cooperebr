/**
 * Sanitização cirúrgica das 2 usinas com convenção ANUAL detectada em audit Sprint 8.
 *
 * Solar Guarapari (600.000 = anual = 12 × 50.000 mensal)
 * Solar Serra (480.000 = anual = 12 × 40.000 mensal)
 *
 * Ambas com **0 cooperados ATIVO/PENDENTE_ATIVACAO** (validado em audit-sprint8-fase1.js).
 * Risco zero — não afeta contratos vigentes.
 *
 * Uso:
 *   ts-node scripts/sanear-usinas-anual-sprint8.ts             # DRY-RUN (default)
 *   ts-node scripts/sanear-usinas-anual-sprint8.ts --apply     # aplica UPDATE
 */
import { PrismaClient } from '@prisma/client';
import 'dotenv/config';

const prisma = new PrismaClient();

interface Target {
  nomeBusca: string;
  capacidadeEsperadaAntes: number;
  capacidadeEsperadaDepois: number;
}

const TARGETS: Target[] = [
  { nomeBusca: 'Solar Guarapari', capacidadeEsperadaAntes: 600000, capacidadeEsperadaDepois: 50000 },
  { nomeBusca: 'Solar Serra', capacidadeEsperadaAntes: 480000, capacidadeEsperadaDepois: 40000 },
];

async function main() {
  const apply = process.argv.includes('--apply');
  console.log(`Modo: ${apply ? 'APPLY (UPDATE real)' : 'DRY-RUN (somente leitura)'}\n`);

  for (const t of TARGETS) {
    const usina = await prisma.usina.findFirst({
      where: {
        nome: { equals: t.nomeBusca, mode: 'insensitive' },
        capacidadeKwh: t.capacidadeEsperadaAntes,
      },
      select: {
        id: true,
        nome: true,
        capacidadeKwh: true,
        producaoMensalKwh: true,
        _count: { select: { contratos: { where: { status: { in: ['ATIVO', 'PENDENTE_ATIVACAO'] } } } } },
      },
    });

    if (!usina) {
      console.log(`⚠️ NÃO encontrada: nome ILIKE '${t.nomeBusca}' + capacidadeKwh=${t.capacidadeEsperadaAntes}`);
      console.log('  (pode já ter sido sanitizada anteriormente — verificar manualmente)\n');
      continue;
    }

    const cooperadosAtivos = usina._count.contratos;
    console.log(`✓ Encontrada: ${usina.nome} (id=${usina.id})`);
    console.log(`  capacidadeKwh ANTES:  ${usina.capacidadeKwh} kWh (ratio anual)`);
    console.log(`  capacidadeKwh DEPOIS: ${t.capacidadeEsperadaDepois} kWh (mensal correto)`);
    console.log(`  producaoMensalKwh:    ${usina.producaoMensalKwh}`);
    console.log(`  cooperados ATIVO+PEND: ${cooperadosAtivos}`);

    if (cooperadosAtivos > 0) {
      console.log(`  ❌ ABORT: usina tem cooperados ativos. Saneamento exige migração de contratos.`);
      continue;
    }

    if (apply) {
      const updated = await prisma.usina.update({
        where: { id: usina.id },
        data: { capacidadeKwh: t.capacidadeEsperadaDepois },
        select: { id: true, nome: true, capacidadeKwh: true },
      });
      console.log(`  ✅ APLICADO: capacidadeKwh agora ${updated.capacidadeKwh}`);
    } else {
      console.log(`  📋 DRY-RUN — sem UPDATE. Re-rodar com --apply pra aplicar.`);
    }
    console.log('');
  }

  await prisma.$disconnect();
}

main().catch(async (e) => {
  console.error('ERRO:', e);
  await prisma.$disconnect();
  process.exit(1);
});
