/**
 * Seed da Política Padrão SISGD pra Sprint 8 / Bloco E (Realocação Multi-Usina).
 *
 * 3 faixas iniciais aprovadas (C.6 — Decisão Luciano 18/05/2026):
 *  - Pequenos (≤500 kWh/mês) → GD_II preferida
 *  - Médios (500-2000) → GD_I/II (sem preferência única — null, engine considera ambas)
 *  - Grandes (>2000) → GD_I
 *
 * Roda em TODAS as cooperativas existentes (CoopereBR é a primária).
 * Idempotente: usa upsert por (cooperativaId + nome).
 *
 * Uso:
 *   ts-node scripts/seed-politica-alocacao-padrao.ts             # aplica
 *   ts-node scripts/seed-politica-alocacao-padrao.ts --dry-run   # só lista
 */
import { ClasseGdAplicada, PrismaClient } from '@prisma/client';
import 'dotenv/config';

const prisma = new PrismaClient();

interface FaixaPadrao {
  nome: string;
  faixaMin: number;
  faixaMax: number | null;
  classeGdPreferida: ClasseGdAplicada | null;
  prioridade: number;
}

const POLITICAS_PADRAO: FaixaPadrao[] = [
  {
    nome: 'Pequenos (≤500 kWh/mês)',
    faixaMin: 0,
    faixaMax: 500,
    classeGdPreferida: ClasseGdAplicada.GD_II,
    prioridade: 30,
  },
  {
    nome: 'Médios (500-2000 kWh/mês)',
    faixaMin: 500.01,
    faixaMax: 2000,
    classeGdPreferida: null, // GD_I ou GD_II (engine considera ambas)
    prioridade: 20,
  },
  {
    nome: 'Grandes (>2000 kWh/mês)',
    faixaMin: 2000.01,
    faixaMax: null,
    classeGdPreferida: ClasseGdAplicada.GD_I,
    prioridade: 10,
  },
];

async function main() {
  const dryRun = process.argv.includes('--dry-run');
  console.log(`Modo: ${dryRun ? 'DRY-RUN' : 'APPLY'}\n`);

  const cooperativas = await prisma.cooperativa.findMany({
    where: { ativo: true },
    select: { id: true, nome: true },
  });
  console.log(`Cooperativas ativas: ${cooperativas.length}`);
  for (const c of cooperativas) {
    console.log(`  - ${c.nome} (${c.id})`);
  }
  console.log('');

  for (const coop of cooperativas) {
    console.log(`▸ Seedando políticas em ${coop.nome}:`);
    for (const p of POLITICAS_PADRAO) {
      const existente = await prisma.politicaAlocacao.findFirst({
        where: { cooperativaId: coop.id, nome: p.nome },
        select: { id: true },
      });

      if (existente) {
        console.log(`  ◇ Já existe: "${p.nome}" — skip`);
        continue;
      }

      if (dryRun) {
        console.log(`  📋 CRIARIA: "${p.nome}" (${p.faixaMin}-${p.faixaMax ?? '∞'} kWh, classe=${p.classeGdPreferida ?? 'qualquer'}, prio=${p.prioridade})`);
      } else {
        const criada = await prisma.politicaAlocacao.create({
          data: {
            cooperativaId: coop.id,
            nome: p.nome,
            faixaMin: p.faixaMin,
            faixaMax: p.faixaMax,
            classeGdPreferida: p.classeGdPreferida,
            usinasElegiveis: [], // vazio = todas usinas da cooperativa
            prioridade: p.prioridade,
            ativa: true,
          },
          select: { id: true, nome: true },
        });
        console.log(`  ✅ Criada: "${criada.nome}" (id=${criada.id})`);
      }
    }
    console.log('');
  }

  console.log('Seed concluído.');
  await prisma.$disconnect();
}

main().catch(async (e) => {
  console.error('ERRO:', e);
  await prisma.$disconnect();
  process.exit(1);
});
