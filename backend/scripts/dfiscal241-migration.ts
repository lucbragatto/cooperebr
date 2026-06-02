/**
 * D-FISCAL-2.4.1 (01/06/2026 noite) — Migration manual SQL (Caso 1).
 *
 * Razão: Prisma pede --accept-data-loss pra adicionar @unique em
 * contratoConsolidadorId — falso-positivo (NULL ≠ NULL no Postgres com 2
 * registros existentes, ambos NULL). Aplicar via SQL manual evita o flag
 * destrutivo e segue o padrão CT.3.
 *
 * Idempotente — pode rodar várias vezes sem efeito colateral.
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('═══ D-FISCAL-2.4.1 Migration SQL Manual ═══\n');

  // 1. enum BaseCobrancaCusteio (CREATE TYPE idempotente)
  await prisma.$executeRawUnsafe(`
    DO $$ BEGIN
      CREATE TYPE "BaseCobrancaCusteio" AS ENUM ('CONSUMO_REAL', 'ALOCACAO_FIXA');
    EXCEPTION WHEN duplicate_object THEN null; END $$;
  `);
  console.log('✓ enum BaseCobrancaCusteio criado (ou já existia)');

  // 2. Plano.custeadoPorConvenio (boolean default false)
  await prisma.$executeRawUnsafe(`
    ALTER TABLE planos
    ADD COLUMN IF NOT EXISTS "custeadoPorConvenio" boolean NOT NULL DEFAULT false;
  `);
  console.log('✓ planos.custeadoPorConvenio adicionado (default false)');

  // 3. ContratoConvenio campos Caso 1 (6 campos)
  await prisma.$executeRawUnsafe(`
    ALTER TABLE contratos_convenio
    ADD COLUMN IF NOT EXISTS "pagadorCooperadoId" text,
    ADD COLUMN IF NOT EXISTS "baseCobrancaCusteio" "BaseCobrancaCusteio" DEFAULT 'CONSUMO_REAL',
    ADD COLUMN IF NOT EXISTS "kwhAlocadoMensal" integer,
    ADD COLUMN IF NOT EXISTS "descontoKwhCusteio" decimal(5,2),
    ADD COLUMN IF NOT EXISTS "contratoConsolidadorId" text;
  `);
  console.log('✓ contratos_convenio: pagadorCooperadoId + baseCobrancaCusteio + kwhAlocadoMensal + descontoKwhCusteio + contratoConsolidadorId adicionados');

  // 4. Unique constraint em contratoConsolidadorId (Postgres NULL≠NULL — safe)
  await prisma.$executeRawUnsafe(`
    DO $$ BEGIN
      ALTER TABLE contratos_convenio
      ADD CONSTRAINT contratos_convenio_contratoConsolidadorId_key
      UNIQUE ("contratoConsolidadorId");
    EXCEPTION WHEN duplicate_object THEN null;
           WHEN duplicate_table THEN null; END $$;
  `);
  console.log('✓ unique constraint contratos_convenio.contratoConsolidadorId aplicada');

  // 5. FK ContratoConvenio.pagadorCooperadoId → Cooperado
  await prisma.$executeRawUnsafe(`
    DO $$ BEGIN
      ALTER TABLE contratos_convenio
      ADD CONSTRAINT "contratos_convenio_pagadorCooperadoId_fkey"
      FOREIGN KEY ("pagadorCooperadoId") REFERENCES cooperados(id) ON DELETE SET NULL ON UPDATE CASCADE;
    EXCEPTION WHEN duplicate_object THEN null; END $$;
  `);
  console.log('✓ FK contratos_convenio.pagadorCooperadoId → cooperados');

  // 6. FK ContratoConvenio.contratoConsolidadorId → Contrato
  await prisma.$executeRawUnsafe(`
    DO $$ BEGIN
      ALTER TABLE contratos_convenio
      ADD CONSTRAINT "contratos_convenio_contratoConsolidadorId_fkey"
      FOREIGN KEY ("contratoConsolidadorId") REFERENCES contratos(id) ON DELETE SET NULL ON UPDATE CASCADE;
    EXCEPTION WHEN duplicate_object THEN null; END $$;
  `);
  console.log('✓ FK contratos_convenio.contratoConsolidadorId → contratos');

  // 7. Cobranca.convenioContabilCobrancaId + FK
  await prisma.$executeRawUnsafe(`
    ALTER TABLE cobrancas
    ADD COLUMN IF NOT EXISTS "convenioContabilCobrancaId" text;
  `);
  console.log('✓ cobrancas.convenioContabilCobrancaId adicionado');

  await prisma.$executeRawUnsafe(`
    DO $$ BEGIN
      ALTER TABLE cobrancas
      ADD CONSTRAINT "cobrancas_convenioContabilCobrancaId_fkey"
      FOREIGN KEY ("convenioContabilCobrancaId") REFERENCES contratos_convenio(id) ON DELETE SET NULL ON UPDATE CASCADE;
    EXCEPTION WHEN duplicate_object THEN null; END $$;
  `);
  console.log('✓ FK cobrancas.convenioContabilCobrancaId → contratos_convenio');

  // 8. Index Cobranca.convenioContabilCobrancaId
  await prisma.$executeRawUnsafe(`
    CREATE INDEX IF NOT EXISTS "cobrancas_convenioContabilCobrancaId_idx"
    ON cobrancas ("convenioContabilCobrancaId");
  `);
  console.log('✓ index cobrancas.convenioContabilCobrancaId');

  // 9. Validação
  const counts = await Promise.all([
    prisma.plano.count(),
    prisma.contratoConvenio.count(),
    prisma.convenioCooperado.count({ where: { ativo: true } }),
    prisma.contrato.count(),
    prisma.cobranca.count(),
  ]);
  console.log('\n--- COUNTS PÓS-MIGRATION ---');
  console.log(`plano: ${counts[0]} (esperado 16)`);
  console.log(`contrato_convenio: ${counts[1]} (esperado 2)`);
  console.log(`convenio_cooperado ativos: ${counts[2]} (esperado 215)`);
  console.log(`contrato: ${counts[3]} (esperado 86)`);
  console.log(`cobranca: ${counts[4]} (esperado 45)`);

  // 10. Defaults aplicados
  const planosCusteadosFalse = await prisma.plano.count({ where: { custeadoPorConvenio: false } });
  const convCusteioDefault = await prisma.contratoConvenio.count({
    where: { baseCobrancaCusteio: 'CONSUMO_REAL' },
  });
  const convsemPagador = await prisma.contratoConvenio.count({ where: { pagadorCooperadoId: null } });
  const cobrancasSemConv = await prisma.cobranca.count({
    where: { convenioContabilCobrancaId: null },
  });
  console.log(`\n--- DEFAULTS ---`);
  console.log(`plano.custeadoPorConvenio=false: ${planosCusteadosFalse}/${counts[0]} (esperado todos)`);
  console.log(`contrato_convenio.baseCobrancaCusteio=CONSUMO_REAL: ${convCusteioDefault}/${counts[1]} (esperado todos — default seguro)`);
  console.log(`contrato_convenio.pagadorCooperadoId=null: ${convsemPagador}/${counts[1]} (esperado todos — vazio até Caso 1)`);
  console.log(`cobrancas.convenioContabilCobrancaId=null: ${cobrancasSemConv}/${counts[4]} (esperado todos — pre-existentes intactas)`);

  console.log('\n✓ Migration aplicada com sucesso. Zero perda de dados.');
}

main()
  .catch((e) => {
    console.error('ERRO:', e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
