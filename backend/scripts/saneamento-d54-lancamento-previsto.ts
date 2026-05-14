/* Saneamento D-54 — criar LancamentoCaixa PREVISTO retroativo pras 4
   cobranças piloto Sub-Fase A (DIEGO, CAROLINA, ALMIR, THEOMAX).
   Idempotente. */
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const COBRANCA_IDS = [
  'cmp4ktvi80001va3kg2higq07', // DIEGO
  'cmp4ktyvi000lva3kzal4mcrt', // CAROLINA
  'cmp4ku2010015va3kzvqlb6va', // ALMIR
  'cmp4ku54j001pva3k7n90sij3', // THEOMAX
];

async function main() {
  const planoContas = await prisma.planoContas.findFirst({ where: { codigo: '1.1.01' } });

  for (const id of COBRANCA_IDS) {
    const cob = await prisma.cobranca.findUnique({
      where: { id },
      include: { contrato: { include: { cooperado: true } } },
    });
    if (!cob) {
      console.log(`SKIP ${id}: cobrança não encontrada`);
      continue;
    }

    const existing = await prisma.lancamentoCaixa.findFirst({
      where: {
        observacoes: { contains: `Ref. cobrança ${id}` },
        status: 'PREVISTO',
      },
    });
    if (existing) {
      console.log(`SKIP ${id} (${cob.contrato?.numero}): já existe LancamentoCaixa PREVISTO`);
      continue;
    }

    const nomeCooperado = cob.contrato?.cooperado?.nomeCompleto || 'Cooperado';
    const mesRef = `${String(cob.mesReferencia).padStart(2, '0')}/${cob.anoReferencia}`;
    const competencia = `${cob.anoReferencia}-${String(cob.mesReferencia).padStart(2, '0')}`;

    const lanc = await prisma.lancamentoCaixa.create({
      data: {
        tipo: 'RECEITA',
        descricao: `Mensalidade - ${nomeCooperado} - ${mesRef}`,
        valor: cob.valorLiquido,
        competencia,
        dataVencimento: cob.dataVencimento,
        status: 'PREVISTO',
        cooperativaId: cob.cooperativaId || undefined,
        cooperadoId: cob.contrato?.cooperadoId || undefined,
        planoContasId: planoContas?.id || undefined,
        observacoes: `Ref. cobrança ${id}`,
      },
    });
    console.log(`CREATED ${id} (${cob.contrato?.numero}): LancamentoCaixa.id=${lanc.id} valor=R$ ${cob.valorLiquido}`);
  }

  // Auditoria final
  const total = await prisma.lancamentoCaixa.count({
    where: {
      status: 'PREVISTO',
      observacoes: { in: COBRANCA_IDS.map((id) => `Ref. cobrança ${id}`) },
    },
  });
  console.log(`\nAuditoria: ${total} LancamentoCaixa PREVISTO pras 4 piloto (esperado 4).`);

  await prisma.$disconnect();
}

main().catch(async (e) => {
  console.error('ERRO:', e);
  await prisma.$disconnect();
  process.exit(1);
});
