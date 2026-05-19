/**
 * Seed inicial de classeGdAnotada nas 3 usinas principais CoopereBR (M14.B).
 *
 * Decisão Luciano 18/05 noite (Sprint 8 Fase 5.1):
 *  - Cooperebr1 (apelido cooperebr1) → GD_II
 *  - Cooperebr2 (apelido cooperebr2) → GD_II
 *  - Solar Norte (sem apelido) → GD_II
 *  - Demais usinas: deixa null (admin define caso a caso via UI inline).
 *
 * Idempotente: só atualiza se classeGdAnotada estiver null.
 *
 * Uso:
 *   ts-node scripts/seed-classegd-usinas-coopereBR.ts             # APPLY
 *   ts-node scripts/seed-classegd-usinas-coopereBR.ts --dry-run   # só lista
 */
import 'dotenv/config';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

interface Target {
  filtroNome: string;
  filtroApelido?: string;
  classe: 'GD_II' | 'GD_I' | 'GD_III';
}

const TARGETS: Target[] = [
  { filtroNome: 'COOPERE BR - Usina Linhares', filtroApelido: 'cooperebr1', classe: 'GD_II' },
  { filtroNome: 'COOPERE - BR Usina 2 Linhares', filtroApelido: 'cooperebr2', classe: 'GD_II' },
  { filtroNome: 'Usina Solar Norte', classe: 'GD_II' },
];

async function main() {
  const dryRun = process.argv.includes('--dry-run');
  console.log(`Modo: ${dryRun ? 'DRY-RUN' : 'APPLY'}\n`);

  for (const t of TARGETS) {
    const where: any = { nome: { equals: t.filtroNome, mode: 'insensitive' } };
    if (t.filtroApelido) where.apelidoInterno = t.filtroApelido;
    const usina = await prisma.usina.findFirst({
      where,
      select: { id: true, nome: true, apelidoInterno: true, classeGdAnotada: true },
    });

    if (!usina) {
      console.log(`⚠️ Não encontrada: nome="${t.filtroNome}" apelido="${t.filtroApelido ?? ''}"`);
      continue;
    }

    console.log(`▸ ${usina.nome} (apelido=${usina.apelidoInterno ?? '—'})`);
    console.log(`  classeGdAnotada ANTES: ${usina.classeGdAnotada ?? '(null)'}`);
    console.log(`  classeGdAnotada DEPOIS: ${t.classe}`);

    if (usina.classeGdAnotada === t.classe) {
      console.log(`  ◇ Já está em ${t.classe} — skip\n`);
      continue;
    }
    if (usina.classeGdAnotada && usina.classeGdAnotada !== t.classe) {
      console.log(`  ⚠️ Já tem classe diferente (${usina.classeGdAnotada}) — não sobrescreve. Use UI inline.`);
      continue;
    }

    if (dryRun) {
      console.log(`  📋 DRY-RUN — sem UPDATE\n`);
    } else {
      await prisma.usina.update({
        where: { id: usina.id },
        data: { classeGdAnotada: t.classe },
      });
      console.log(`  ✅ Atualizado\n`);
    }
  }

  await prisma.$disconnect();
}

main().catch(async (e) => {
  console.error('ERRO:', e);
  await prisma.$disconnect();
  process.exit(1);
});
