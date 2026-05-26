/**
 * Sub-Sprint F Etapa I (M30, 2026-05-26).
 *
 * Corrige Usina.classeGdAnotada da cooperebr1: GD_II -> GD_I.
 *
 * Justificativa: Luciano confirmou na sessao 25/05 (memoria descoberta
 * legado SISGDSOLAR) que a usina cooperebr1 e pre-07/jan/2023, portanto
 * tem direito adquirido pelo regime antigo (Lei 10.848/2004) — 0% Fio B
 * ate 2045. ClasseGD apropriada e GD_I (geracao distribuida ate 75kW).
 *
 * O banco tinha GD_II por engano (provavelmente seed antigo ou cadastro
 * manual errado pre-Bloco H' 16/05).
 *
 * Idempotente: se ja esta GD_I, nao mexe.
 *
 * Execucao:
 *   ./node_modules/.bin/ts-node scripts/fix-classegd-cooperebr1.ts
 */
import { PrismaClient } from '@prisma/client';

const COOPEREBR_ID = 'cmn0ho8bx0000uox8wu96u6fd';

async function main() {
  const prisma = new PrismaClient();

  console.log('═══════════════════════════════════════════════════════════');
  console.log('🔧 Fix classeGdAnotada cooperebr1 (Sub-Sprint F Etapa I)');
  console.log('═══════════════════════════════════════════════════════════\n');

  const usina = await prisma.usina.findFirst({
    where: { cooperativaId: COOPEREBR_ID, apelidoInterno: 'cooperebr1' },
    select: { id: true, nome: true, apelidoInterno: true, classeGdAnotada: true },
  });

  if (!usina) {
    console.log('❌ Usina cooperebr1 nao encontrada. Rodar seed-cooperebr1-usina.ts primeiro.');
    await prisma.$disconnect();
    process.exit(1);
  }

  console.log(`Usina: ${usina.nome} (id=${usina.id})`);
  console.log(`classeGdAnotada atual: ${usina.classeGdAnotada ?? '(null)'}`);

  if (usina.classeGdAnotada === 'GD_I') {
    console.log('✅ Ja esta GD_I. Nada a fazer (idempotente).');
    await prisma.$disconnect();
    return;
  }

  await prisma.usina.update({
    where: { id: usina.id },
    data: { classeGdAnotada: 'GD_I' },
  });

  console.log(`✅ UPDATE aplicado: classeGdAnotada GD_II -> GD_I`);
  console.log(`   Justificativa: pre-07/jan/2023 = direito adquirido = 0% Fio B ate 2045`);
  console.log(`   Decisao Luciano sessao 25/05 (descoberta legado SISGDSOLAR)`);

  await prisma.$disconnect();
}

main().catch((e) => {
  console.error('Falha:', e);
  process.exit(1);
});
