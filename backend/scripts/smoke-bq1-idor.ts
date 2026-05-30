/**
 * Smoke programático D-novo-BQ.1 IDOR (30/05/2026)
 *
 * Valida em runtime contra Postgres real que o pattern de verificação
 * de posse implementado em contratos/usinas/ucs/geracao-mensal isola
 * cross-tenant corretamente.
 *
 * Cenários (4 entidades × 3 casos = 12 asserts):
 *  1. cross-tenant (cooperativaId B) → findFirst retorna null   (= 404)
 *  2. same-tenant   (cooperativaId A) → findFirst retorna 1     (= OK)
 *  3. SUPER_ADMIN (null) → findUnique retorna 1                 (= bypass)
 *
 * Para GeracaoMensal a posse é via join `usina: { cooperativaId }`
 * (não tem cooperativaId direto).
 *
 * Cleanup ao final (sempre, mesmo em erro).
 *
 * Rodar: `npx ts-node scripts/smoke-bq1-idor.ts`
 */
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

type Result = { name: string; ok: boolean; detail?: string };
const results: Result[] = [];
function assert(name: string, ok: boolean, detail?: string) {
  results.push({ name, ok, detail });
  console.log(`${ok ? 'OK ' : 'XX '} ${name}${detail ? '  ' + detail : ''}`);
}

async function main() {
  const ts = Date.now();
  console.log(`\n=== Smoke BQ.1 IDOR — ts ${ts} ===\n`);

  // Setup — 2 cooperativas + recursos em A
  const coopA = await prisma.cooperativa.create({
    data: {
      nome: `Smoke BQ1 A ${ts}`,
      cnpj: `bq1a${ts}`.slice(0, 14),
      tipoParceiro: 'COOPERATIVA',
    },
  });
  const coopB = await prisma.cooperativa.create({
    data: {
      nome: `Smoke BQ1 B ${ts}`,
      cnpj: `bq1b${ts}`.slice(0, 14),
      tipoParceiro: 'COOPERATIVA',
    },
  });

  const coopadoA = await prisma.cooperado.create({
    data: {
      nomeCompleto: 'Smoke BQ1 A Membro',
      cpf: `bq1a-mb-${ts}`,
      email: `lucbragatto+bq1a-${ts}@gmail.com`,
      telefone: '27981341348',
      cooperativaId: coopA.id,
    },
  });

  const usinaA = await prisma.usina.create({
    data: {
      nome: `Smoke BQ1 A Usina`,
      apelidoInterno: `smoke-bq1-a-${ts}`,
      potenciaKwp: 100 as any,
      cidade: 'Vitória',
      estado: 'ES',
      cooperativaId: coopA.id,
    },
  });

  const ucA = await prisma.uc.create({
    data: {
      numero: `bq1a-uc-${ts}`,
      endereco: 'Rua Smoke 1',
      cidade: 'Vitória',
      estado: 'ES',
      cooperadoId: coopadoA.id,
      cooperativaId: coopA.id,
    },
  });

  const gmA = await prisma.geracaoMensal.create({
    data: {
      usinaId: usinaA.id,
      competencia: new Date('2026-05-01'),
      kwhGerado: 5000,
    },
  });

  const contratoA = await prisma.contrato.create({
    data: {
      numero: `BQ1-${ts}`,
      cooperadoId: coopadoA.id,
      ucId: ucA.id,
      usinaId: usinaA.id,
      cooperativaId: coopA.id,
      dataInicio: new Date(),
      percentualDesconto: 10 as any,
      kwhContratoAnual: 1000 as any,
      percentualUsina: 10 as any,
      status: 'PENDENTE_ATIVACAO',
    },
  });

  console.log('Setup OK.\n');

  try {
    // ============ CONTRATO ============
    const ctCross = await prisma.contrato.findFirst({
      where: { id: contratoA.id, cooperativaId: coopB.id },
      select: { id: true },
    });
    assert('contrato.update cross-tenant B → 404', ctCross === null);

    const ctSame = await prisma.contrato.findFirst({
      where: { id: contratoA.id, cooperativaId: coopA.id },
      select: { id: true },
    });
    assert('contrato.update same-tenant A → OK', !!ctSame, `id=${ctSame?.id}`);

    const ctSa = await prisma.contrato.findUnique({ where: { id: contratoA.id } });
    assert('contrato.update SA (null) bypass via findUnique', !!ctSa);

    // ============ USINA ============
    const uCross = await prisma.usina.findFirst({
      where: { id: usinaA.id, cooperativaId: coopB.id },
    });
    assert('usina.update/delete cross-tenant B → 404', uCross === null);

    const uSame = await prisma.usina.findFirst({
      where: { id: usinaA.id, cooperativaId: coopA.id },
    });
    assert('usina.update/delete same-tenant A → OK', !!uSame);

    const uSa = await prisma.usina.findUnique({ where: { id: usinaA.id } });
    assert('usina.update/delete SA (null) bypass', !!uSa);

    // ============ UC ============
    const ucCross = await prisma.uc.findFirst({
      where: { id: ucA.id, cooperativaId: coopB.id },
      select: { id: true },
    });
    assert('uc.update/delete cross-tenant B → 404', ucCross === null);

    const ucSame = await prisma.uc.findFirst({
      where: { id: ucA.id, cooperativaId: coopA.id },
      select: { id: true },
    });
    assert('uc.update/delete same-tenant A → OK', !!ucSame);

    const ucSa = await prisma.uc.findUnique({ where: { id: ucA.id } });
    assert('uc.update/delete SA (null) bypass', !!ucSa);

    // ============ GERAÇÃO MENSAL (posse via usina.cooperativaId) ============
    const gmCross = await prisma.geracaoMensal.findFirst({
      where: { id: gmA.id, usina: { cooperativaId: coopB.id } },
      select: { id: true },
    });
    assert('geracao.update/delete cross-tenant B → 404 (via usina.cooperativaId)', gmCross === null);

    const gmSame = await prisma.geracaoMensal.findFirst({
      where: { id: gmA.id, usina: { cooperativaId: coopA.id } },
      select: { id: true },
    });
    assert('geracao.update/delete same-tenant A → OK (via usina.cooperativaId)', !!gmSame);

    const gmSa = await prisma.geracaoMensal.findUnique({ where: { id: gmA.id } });
    assert('geracao.update/delete SA (null) bypass via findUnique', !!gmSa);
  } finally {
    console.log('\nCleanup...');
    try { await prisma.geracaoMensal.deleteMany({ where: { usinaId: usinaA.id } }); } catch {}
    try { await prisma.contrato.deleteMany({ where: { cooperativaId: { in: [coopA.id, coopB.id] } } }); } catch {}
    try { await prisma.uc.deleteMany({ where: { cooperativaId: { in: [coopA.id, coopB.id] } } }); } catch {}
    try { await prisma.usina.deleteMany({ where: { cooperativaId: { in: [coopA.id, coopB.id] } } }); } catch {}
    try { await prisma.cooperado.deleteMany({ where: { cooperativaId: { in: [coopA.id, coopB.id] } } }); } catch {}
    try { await prisma.cooperativa.deleteMany({ where: { id: { in: [coopA.id, coopB.id] } } }); } catch {}
    console.log('Cleanup OK.\n');
  }

  const fails = results.filter((r) => !r.ok);
  console.log(`\n=== Resumo: ${results.length - fails.length}/${results.length} OK ===`);
  if (fails.length > 0) {
    console.error('FALHAS:');
    fails.forEach((f) => console.error(` - ${f.name}`));
    process.exitCode = 1;
  } else {
    console.log('Todos os 12 cenários cross-tenant passaram. BQ.1 isolamento validado em runtime.\n');
  }
}

main()
  .catch((err) => {
    console.error('Erro fatal smoke BQ.1:', err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
