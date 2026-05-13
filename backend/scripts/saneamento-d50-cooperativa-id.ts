/* Saneamento D-50 — popular cooperativaId nas 4 cobrancas piloto Sub-Fase A
   geradas via gerarCobrancaPosFatura antes do fix do bug latente em
   faturas.service.ts:662-690 (cooperativaId não passado no data do create).

   Idempotente — se cooperativaId ja igual ao contrato, no-op.

   Uso: cd backend && npx ts-node scripts/saneamento-d50-cooperativa-id.ts */
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const ids = [
    'cmp4ktvi80001va3kg2higq07', // DIEGO R$ 447,68
    'cmp4ktyvi000lva3kzal4mcrt', // CAROLINA R$ 142,32
    'cmp4ku2010015va3kzvqlb6va', // ALMIR R$ 940,93
    'cmp4ku54j001pva3k7n90sij3', // THEOMAX R$ 1.011,33
  ];

  for (const id of ids) {
    const cob = await prisma.cobranca.findUnique({
      where: { id },
      include: { contrato: { select: { cooperativaId: true, numero: true } } },
    });
    if (!cob) {
      console.log(`SKIP ${id}: nao encontrada`);
      continue;
    }
    if (cob.cooperativaId === cob.contrato.cooperativaId) {
      console.log(`SKIP ${id} (${cob.contrato.numero}): ja populado com ${cob.cooperativaId}`);
      continue;
    }
    await prisma.cobranca.update({
      where: { id },
      data: { cooperativaId: cob.contrato.cooperativaId },
    });
    console.log(`UPDATED ${id} (${cob.contrato.numero}): cooperativaId = ${cob.contrato.cooperativaId}`);
  }

  // Auditoria pos-saneamento
  const audit = await prisma.cobranca.findMany({
    where: { id: { in: ids } },
    select: { id: true, cooperativaId: true, contrato: { select: { cooperativaId: true, numero: true } } },
  });
  console.log('\nAuditoria pos-saneamento:');
  audit.forEach((c) => {
    const ok = c.cooperativaId === c.contrato.cooperativaId;
    console.log(`  ${c.contrato.numero}: ${ok ? 'OK' : 'DIVERGENTE'} (cob=${c.cooperativaId}, ct=${c.contrato.cooperativaId})`);
  });
}

main()
  .catch((e) => {
    console.error('ERRO:', e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
