/**
 * Read-only: investiga formato real das UCs EDP_ES no banco pra basear fix
 * do D-novo-OCR-UC-CANON (Sprint 11 — formato 15 díg EDP atual).
 */
import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
  // 1. Total
  const total = await prisma.uc.count({ where: { distribuidora: 'EDP_ES' } });
  console.log('UCs EDP_ES total:', total, '\n');

  // 2. Amostras recentes
  const amostras = await prisma.uc.findMany({
    where: { distribuidora: 'EDP_ES' },
    select: { numero: true, numeroUC: true, numeroConcessionariaOriginal: true },
    orderBy: { createdAt: 'desc' },
    take: 12,
  });
  console.log('=== Amostras recentes EDP_ES ===');
  console.log(JSON.stringify(amostras, null, 2));

  // 3. Distribuição de tamanho
  const all = await prisma.uc.findMany({
    where: { distribuidora: 'EDP_ES' },
    select: { numero: true, numeroUC: true, numeroConcessionariaOriginal: true },
  });
  const dist = (vals: (string | null | undefined)[]) => {
    const m: Record<string, number> = {};
    for (const v of vals) {
      const key = v ? `${v.length}` : 'null';
      m[key] = (m[key] ?? 0) + 1;
    }
    return m;
  };
  console.log('\n=== Distribuição (length → count) ===');
  console.log('numero                       :', dist(all.map((u) => u.numero)));
  console.log('numeroUC (legado)            :', dist(all.map((u) => u.numeroUC)));
  console.log('numeroConcessionariaOriginal :', dist(all.map((u) => u.numeroConcessionariaOriginal)));

  // 4. UCs com numeroConcessionariaOriginal preenchido (formato EDP-ES atual)
  const comOriginal = all.filter((u) => u.numeroConcessionariaOriginal);
  console.log(`\n=== Amostras com numeroConcessionariaOriginal (${comOriginal.length}/${all.length}) ===`);
  console.log(JSON.stringify(comOriginal.slice(0, 8), null, 2));

  // 5. Existem UCs com numeroConcessionariaOriginal mas numero vazio/placeholder?
  const placeholders = all.filter(
    (u) =>
      u.numeroConcessionariaOriginal &&
      (!u.numero || /^0+$/.test(u.numero) || u.numero.startsWith('PENDENTE') || u.numero.startsWith('UC-')),
  );
  console.log(`\n=== UCs com original preenchido mas numero placeholder/vazio: ${placeholders.length} ===`);
  console.log(JSON.stringify(placeholders.slice(0, 5), null, 2));
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
