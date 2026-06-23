/**
 * Sprint M52a Bloco D — REVERSÃO da reconciliação histórica corrompida (23/06/2026).
 *
 * Contexto: o re-review do orquestrador detectou que a reconciliação aplicada
 * pelo `reconciliacao-historica-faxina-d.ts` foi CORROMPIDA pelo bug do
 * invariante — compararam contra `saldoDisponivel` quando o ledger reflete
 * o TOTAL (disponível + pendente + bloqueado).
 *
 * Resultado da corrupção:
 *  - AGOSTINHO (saldoPendente=6.86): foi marcado como -6.86 → DEBITO 6.86
 *    aplicado errado (era 0 anômalo).
 *  - LEONARDO  (saldoPendente=980): foi marcado como -980 → DEBITO 980
 *    aplicado errado (era 0 anômalo).
 *  - AMAGES    (saldoBloqueado=10): sub-corrigido (+200 em vez de +210).
 *  - LUCIANO   (sem pendente/bloqueado): único certo (+49).
 *
 * Esta reversão deleta os 4 ledgers tagueados
 * `referenciaTabela='RECONCILIACAO_HISTORICA' AND referenciaId='2026-06-23-FAXINA-D'`
 * pra restaurar o estado pré-reconciliação. NÃO toca `saldoDisponivel`
 * (que nunca foi alterado).
 *
 * Próximo passo após reversão: corrigir os 3 bugs e re-rodar `reconciliacao-
 * historica-faxina-d.ts` (corrigido) com o invariante ancorado em saldo TOTAL.
 *
 * Uso:
 *   # DRY-RUN (default):
 *   node -e "require('dotenv').config({path:'.env'}); require('ts-node').register({transpileOnly:true}); require('./scripts/reverter-reconciliacao-historica-faxina-d.ts');"
 *
 *   # APPLY:
 *   FAXINA_REVERT_APPLY=1 node -e "require('dotenv').config({path:'.env'}); require('ts-node').register({transpileOnly:true}); require('./scripts/reverter-reconciliacao-historica-faxina-d.ts');"
 */
import { PrismaClient, Prisma } from '@prisma/client';

const prisma = new PrismaClient();
const APPLY = process.env.FAXINA_REVERT_APPLY === '1';

// v2 fix re-review multitenant (P3 → fechado): DELETE escopado por tenant.
const TENANT_COOPEREBR = process.env.TENANT_COOPEREBR_ID ?? 'cmn0ho8bx0000uox8wu96u6fd';
const MARCA_REF_TABELA = 'RECONCILIACAO_HISTORICA';
const MARCA_REF_ID = '2026-06-23-FAXINA-D';

function fmt(d: Prisma.Decimal | number | null | undefined): string {
  if (d === null || d === undefined) return 'null';
  return new Prisma.Decimal(d as any).toFixed(4);
}

async function main(): Promise<void> {
  console.log('\n========================================================================');
  console.log('  REVERSÃO Bloco D — deletar 4 ledgers RECONCILIACAO_HISTORICA corrompidos');
  console.log('========================================================================');
  console.log(`MODO: ${APPLY ? 'APLICAR (delete)' : 'DRY-RUN'}`);
  console.log(`Tag: referenciaTabela='${MARCA_REF_TABELA}' AND referenciaId='${MARCA_REF_ID}'`);

  const alvos = await prisma.cooperTokenLedger.findMany({
    where: {
      cooperativaId: TENANT_COOPEREBR,
      referenciaTabela: MARCA_REF_TABELA,
      referenciaId: MARCA_REF_ID,
    },
    select: {
      id: true,
      cooperadoId: true,
      cooperativaId: true,
      tipo: true,
      operacao: true,
      quantidade: true,
      saldoApos: true,
      descricao: true,
      createdAt: true,
      cooperado: { select: { nomeCompleto: true } },
    },
    orderBy: { createdAt: 'asc' },
  });

  console.log(`\nLedgers tagueados encontrados: ${alvos.length}`);

  if (alvos.length === 0) {
    console.log('[skip] nada a reverter.');
    return;
  }

  for (const l of alvos) {
    // ANTES — estado pré-reversão (com o ledger errado presente).
    const saldoRow = await prisma.cooperTokenSaldo.findUnique({
      where: { cooperadoId: l.cooperadoId },
      select: {
        saldoDisponivel: true,
        saldoPendente: true,
        saldoBloqueadoResgate: true,
      },
    });

    const disp = new Prisma.Decimal(saldoRow?.saldoDisponivel ?? 0);
    const pend = new Prisma.Decimal(saldoRow?.saldoPendente ?? 0);
    const bloq = new Prisma.Decimal(saldoRow?.saldoBloqueadoResgate ?? 0);
    const total = disp.plus(pend).plus(bloq);

    console.log(`\n--- ${l.cooperado?.nomeCompleto ?? '?'} (${l.cooperadoId}) ---`);
    console.log(`  Ledger errado a reverter:`);
    console.log(`    id=${l.id}`);
    console.log(`    tipo=${l.tipo}  operacao=${l.operacao}`);
    console.log(`    quantidade=${fmt(l.quantidade)}  saldoApos=${fmt(l.saldoApos)}`);
    console.log(`    descricao=${l.descricao}`);
    console.log(`    createdAt=${l.createdAt.toISOString()}`);
    console.log(`  Saldos ANTES da reversão (inalterados pela reversão):`);
    console.log(`    saldoDisponivel       = ${fmt(disp)}`);
    console.log(`    saldoPendente         = ${fmt(pend)}`);
    console.log(`    saldoBloqueadoResgate = ${fmt(bloq)}`);
    console.log(`    TOTAL face            = ${fmt(total)}`);
    console.log(`  Ação: DELETE do ledger (saldos NÃO mudam).`);
  }

  console.log('\n========================================================================');
  console.log(`Total a reverter: ${alvos.length} ledger(s)`);
  console.log('========================================================================');

  if (!APPLY) {
    console.log('\nDRY-RUN — nada deletado. Aguardando OK do orquestrador.');
    console.log('Pra aplicar: FAXINA_REVERT_APPLY=1 ...');
    return;
  }

  console.log('\n>>> APLICANDO REVERSÃO (delete) <<<');
  const r = await prisma.cooperTokenLedger.deleteMany({
    where: {
      cooperativaId: TENANT_COOPEREBR,
      referenciaTabela: MARCA_REF_TABELA,
      referenciaId: MARCA_REF_ID,
    },
  });
  console.log(`[OK] ${r.count} ledger(s) deletado(s). saldoDisponivel/Pendente/Bloqueado intocados.`);
}

main()
  .catch((e) => {
    console.error('[ERRO]', e);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
