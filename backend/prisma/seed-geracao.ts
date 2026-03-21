import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// Dados aproximados de geração mensal (kWh) baseados no demonstrativo MMGD
// Usina existente — Fev/2025 a Fev/2026
const geracaoMensal: { competencia: string; kwhGerado: number }[] = [
  { competencia: '2025-02-01', kwhGerado: 148500 },
  { competencia: '2025-03-01', kwhGerado: 145200 },
  { competencia: '2025-04-01', kwhGerado: 138700 },
  { competencia: '2025-05-01', kwhGerado: 131400 },
  { competencia: '2025-06-01', kwhGerado: 130200 },
  { competencia: '2025-07-01', kwhGerado: 132800 },
  { competencia: '2025-08-01', kwhGerado: 136500 },
  { competencia: '2025-09-01', kwhGerado: 141300 },
  { competencia: '2025-10-01', kwhGerado: 144800 },
  { competencia: '2025-11-01', kwhGerado: 147600 },
  { competencia: '2025-12-01', kwhGerado: 149200 },
  { competencia: '2026-01-01', kwhGerado: 148900 },
  { competencia: '2026-02-01', kwhGerado: 146300 },
];

async function main() {
  // Buscar a primeira usina existente
  const usina = await prisma.usina.findFirst({ orderBy: { createdAt: 'asc' } });
  if (!usina) {
    console.error('Nenhuma usina encontrada no banco. Crie uma usina primeiro.');
    process.exit(1);
  }

  console.log(`Inserindo dados de geração para usina: ${usina.nome} (${usina.id})`);

  for (const item of geracaoMensal) {
    const competencia = new Date(item.competencia + 'T00:00:00.000Z');
    await prisma.geracaoMensal.upsert({
      where: {
        usinaId_competencia: {
          usinaId: usina.id,
          competencia,
        },
      },
      update: {
        kwhGerado: item.kwhGerado,
        fonte: 'IMPORTACAO',
      },
      create: {
        usinaId: usina.id,
        competencia,
        kwhGerado: item.kwhGerado,
        fonte: 'IMPORTACAO',
        observacao: 'Seed inicial baseado em demonstrativo MMGD',
      },
    });
    console.log(`  ${item.competencia}: ${item.kwhGerado} kWh`);
  }

  console.log('Seed de geração mensal concluído!');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
