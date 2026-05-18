/**
 * Fase 1 read-only ampla Sprint 8 — auditoria estado real.
 * Read-only — só SELECTs, sem mutations.
 */
require('dotenv').config();
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

(async () => {
  console.log('═══ AUDITORIA USINAS — capacidade vs alocação ═══\n');
  const usinas = await prisma.$queryRawUnsafe(`
    SELECT u.id, u.nome, u."apelidoInterno",
           u."capacidadeKwh"::float AS capacidade,
           u."producaoMensalKwh"::float AS producao_mensal,
           u."classeGdAnotada",
           u.distribuidora,
           u."cooperativaId",
           (SELECT COALESCE(SUM(c."kwhContrato"), 0)::float
            FROM contratos c
            WHERE c."usinaId" = u.id AND c.status IN ('ATIVO','PENDENTE_ATIVACAO')) AS alocado_kwh_mes,
           (SELECT COUNT(*)::int
            FROM contratos c
            WHERE c."usinaId" = u.id AND c.status IN ('ATIVO','PENDENTE_ATIVACAO')) AS qtd_cooperados
    FROM usinas u
    ORDER BY u.nome ASC
  `);
  console.log('Total usinas:', usinas.length);
  for (const u of usinas) {
    const pct = u.capacidade > 0 ? (u.alocado_kwh_mes / u.capacidade * 100).toFixed(2) : 'N/A';
    console.log(`  ${u.nome} (${u.apelidoInterno || '-'}) | cap=${u.capacidade} kWh/mês | aloc=${u.alocado_kwh_mes} kWh | ${pct}% | qtd=${u.qtd_cooperados} | classeGd=${u.classeGdAnotada || '-'} | distrib=${u.distribuidora || '-'}`);
  }

  console.log('\n═══ CONCENTRAÇÃO > 25% por cooperado-usina (D-30A) ═══');
  const concentracao = await prisma.$queryRawUnsafe(`
    SELECT c.id AS contrato_id, c.numero, c."percentualUsina"::float AS pct,
           cp.nome_completo AS cooperado, u.nome AS usina, u."apelidoInterno",
           c."kwhContrato"::float AS kwh_mes, c.status
    FROM contratos c
    JOIN usinas u ON u.id = c."usinaId"
    JOIN cooperados cp ON cp.id = c."cooperadoId"
    WHERE c.status IN ('ATIVO','PENDENTE_ATIVACAO')
      AND c."percentualUsina"::float > 25
    ORDER BY c."percentualUsina"::float DESC
  `).catch((e) => { console.log('Query erro (nome_completo? case-sensitive):', e.message); return []; });
  if (concentracao.length === 0) {
    console.log('  Nenhum contrato com percentualUsina > 25%');
  } else {
    for (const c of concentracao) {
      console.log(`  ${c.cooperado} | ${c.usina} | ${c.pct}% | ${c.kwh_mes} kWh/mês | ${c.status}`);
    }
  }

  console.log('\n═══ LISTA ESPERA entries ═══');
  const espera = await prisma.listaEspera.count({
    where: { status: { in: ['AGUARDANDO', 'PENDENTE'] } },
  });
  const esperaTotal = await prisma.listaEspera.count();
  console.log(`  Total: ${esperaTotal} | Pendentes (AGUARDANDO+PENDENTE): ${espera}`);

  console.log('\n═══ CONTRATOS COM dataInicio < 3 MESES (estabilidade Sprint 8) ═══');
  const tresMesesAtras = new Date();
  tresMesesAtras.setMonth(tresMesesAtras.getMonth() - 3);
  const novos = await prisma.contrato.count({
    where: { status: { in: ['ATIVO', 'PENDENTE_ATIVACAO'] }, dataInicio: { gte: tresMesesAtras } },
  });
  const total = await prisma.contrato.count({
    where: { status: { in: ['ATIVO', 'PENDENTE_ATIVACAO'] } },
  });
  console.log(`  Ativos com dataInicio >= ${tresMesesAtras.toISOString().slice(0, 10)} (não realocáveis): ${novos} / total ATIVO+PEND ${total}`);

  console.log('\n═══ classeGdAplicada / FioB no schema (Caminho B) ═══');
  const checkCols = await prisma.$queryRawUnsafe(`
    SELECT column_name, data_type
    FROM information_schema.columns
    WHERE table_name = 'contratos'
      AND (column_name LIKE '%classeGd%' OR column_name LIKE '%FioB%' OR column_name LIKE '%fioB%')
  `);
  console.log('  contratos:', JSON.stringify(checkCols, null, 2));

  const checkColsUsina = await prisma.$queryRawUnsafe(`
    SELECT column_name, data_type
    FROM information_schema.columns
    WHERE table_name = 'usinas'
      AND (column_name LIKE '%classeGd%' OR column_name LIKE '%FioB%')
  `);
  console.log('  usinas:', JSON.stringify(checkColsUsina, null, 2));

  console.log('\n═══ Convenção MENSAL — auditar usinas com cap suspeita ANUAL ═══');
  const suspeitas = await prisma.$queryRawUnsafe(`
    SELECT id, nome, "apelidoInterno",
           "capacidadeKwh"::float AS cap,
           "producaoMensalKwh"::float AS prod_mes,
           CASE WHEN "producaoMensalKwh"::float > 0
                THEN ROUND(("capacidadeKwh"::float / "producaoMensalKwh"::float)::numeric, 2)
                ELSE NULL END AS ratio_cap_prod
    FROM usinas
    WHERE "capacidadeKwh" IS NOT NULL
    ORDER BY ratio_cap_prod DESC NULLS LAST
  `);
  console.log('  ratio = capacidadeKwh / producaoMensalKwh (esperado ~1.0 se MENSAL; ~12 se ANUAL):');
  for (const u of suspeitas) {
    console.log(`    ${u.nome} | cap=${u.cap} | prod_mes=${u.prod_mes} | ratio=${u.ratio_cap_prod}`);
  }

  await prisma.$disconnect();
})().catch(async (e) => { console.error('ERRO:', e.message); await prisma.$disconnect(); process.exit(1); });
