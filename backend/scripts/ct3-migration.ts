/**
 * CT.3 Migration aditiva manual — adiciona enum OrigemLancamento + colunas
 * origemTipo/origemId + @@unique em LancamentoCaixa.
 *
 * Manual via SQL pra evitar --accept-data-loss (Prisma desconfia mas
 * constraint é segura: 58 legados ficam (NULL,NULL) e Postgres aceita
 * múltiplos NULLs em unique).
 *
 * Idempotente. Rodar APÓS pm2 stop.
 */
import { PrismaClient } from '@prisma/client';
const p = new PrismaClient();

async function exec(sql: string) {
  try {
    await p.$executeRawUnsafe(sql);
    console.log(`  ✓ ${sql.slice(0, 80)}...`);
  } catch (e: any) {
    if (e.message?.includes('already exists')) {
      console.log(`  ⇢ já existe (skip): ${sql.slice(0, 60)}...`);
    } else {
      throw e;
    }
  }
}

async function main() {
  console.log('\n=== CT.3 Migration manual ===\n');

  // 1. Criar enum OrigemLancamento (idempotente — IF NOT EXISTS via tentativa)
  try {
    await p.$executeRawUnsafe(
      `CREATE TYPE "OrigemLancamento" AS ENUM ('COBRANCA', 'CONTA_PAGAR', 'REPASSE', 'MANUAL')`,
    );
    console.log('  ✓ enum OrigemLancamento criado');
  } catch (e: any) {
    if (e.message?.includes('already exists')) {
      console.log('  ⇢ enum OrigemLancamento já existe');
    } else throw e;
  }

  // 2. Adicionar colunas em lancamentos_caixa
  await exec(`ALTER TABLE "lancamentos_caixa" ADD COLUMN IF NOT EXISTS "origemTipo" "OrigemLancamento"`);
  await exec(`ALTER TABLE "lancamentos_caixa" ADD COLUMN IF NOT EXISTS "origemId" TEXT`);

  // 3. Unique constraint (idempotente)
  try {
    await p.$executeRawUnsafe(
      `ALTER TABLE "lancamentos_caixa" DROP CONSTRAINT IF EXISTS "lancamentos_caixa_origemTipo_origemId_key"`,
    );
    await p.$executeRawUnsafe(
      `ALTER TABLE "lancamentos_caixa" ADD CONSTRAINT "lancamentos_caixa_origemTipo_origemId_key" UNIQUE ("origemTipo", "origemId")`,
    );
    console.log('  ✓ constraint UNIQUE(origemTipo, origemId)');
  } catch (e: any) {
    console.error('Erro constraint:', e.message);
    throw e;
  }

  // 4. Verificar
  const cols: any = await p.$queryRawUnsafe(
    `SELECT column_name, data_type, udt_name FROM information_schema.columns
     WHERE table_name='lancamentos_caixa' AND column_name IN ('origemTipo','origemId')
     ORDER BY column_name`,
  );
  console.log('\nColunas:', JSON.stringify(cols, null, 2));

  const constraints: any = await p.$queryRawUnsafe(
    `SELECT conname FROM pg_constraint WHERE conname LIKE '%origem%'`,
  );
  console.log('Constraints:', constraints);

  const total = await p.lancamentoCaixa.count();
  console.log(`\nTotal LancamentoCaixa preservados: ${total}`);

  await p.$disconnect();
}

main().catch((e) => {
  console.error('Erro fatal:', e);
  process.exitCode = 1;
});
