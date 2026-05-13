/* Saneamento de 2 contratos divergentes manifestados pelo D-48 (multi-tenant
   ausente em queries Usina). Cita D-48.1 (motor-proposta) e D-48.6/D-48.7
   (criação manual via controller/lista de espera) como manifestações.

   Já EXECUTADO em 2026-05-13 pelo orchestrador
   `sub-fase-a-recuperacao-pos-d48.ts` Fase 5. Mantido como artefato de
   referência idempotente — pode rodar de novo sem efeito (no-op se já
   estiver com usina-linhares).

   Uso: cd backend && npx ts-node scripts/saneamento-d48-pos-fix.ts */
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const USINA_LINHARES = 'usina-linhares';
const CASOS = [
  {
    id: 'cmp4jpk2o000bvagcgxaai4t3',
    nome: 'CTR-2026-0004 (DIEGO — Sub-Fase A 14/05, manifestação D-48.1)',
    kwhMes: 490,
  },
  {
    id: 'cmncg235l0001uowo72x7kx6k',
    nome: 'CTR-2026-0003 (Luciana — seed ambienteTeste mar/2026, manifestação D-48.6/.7)',
    kwhMes: 1000,
  },
];

const CAPACIDADE_LINHARES = 150000;

async function main() {
  console.log('Saneamento D-48 — vincula contratos divergentes a Usina Linhares\n');
  for (const c of CASOS) {
    const antes = await prisma.contrato.findUnique({
      where: { id: c.id },
      select: { id: true, numero: true, usinaId: true, percentualUsina: true, cooperativaId: true },
    });
    if (!antes) {
      console.log(`  ${c.nome}: NÃO ENCONTRADO — pulando.`);
      continue;
    }
    if (antes.usinaId === USINA_LINHARES) {
      console.log(`  ${c.nome}: já em usina-linhares (no-op).`);
      continue;
    }
    const pct = Math.round((c.kwhMes / CAPACIDADE_LINHARES) * 100 * 10000) / 10000;
    const depois = await prisma.contrato.update({
      where: { id: c.id },
      data: { usinaId: USINA_LINHARES, percentualUsina: pct },
      select: { id: true, numero: true, usinaId: true, percentualUsina: true },
    });
    console.log(`  ${c.nome}`);
    console.log(`    antes:  usinaId=${antes.usinaId} pct=${antes.percentualUsina}`);
    console.log(`    depois: usinaId=${depois.usinaId} pct=${depois.percentualUsina}`);
  }

  const divergencias = await prisma.$queryRawUnsafe<any[]>(
    `SELECT ct.id, ct.numero
     FROM contratos ct
     LEFT JOIN usinas u ON u.id = ct."usinaId"
     WHERE ct."usinaId" IS NOT NULL
       AND u."cooperativaId" != ct."cooperativaId"`
  );
  console.log(`\nAuditoria global: ${divergencias.length} divergências (esperado: 0)`);
  await prisma.$disconnect();
}

main().catch(async (e) => {
  console.error('ERRO:', e);
  await prisma.$disconnect();
  process.exit(1);
});
