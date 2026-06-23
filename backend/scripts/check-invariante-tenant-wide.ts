/**
 * Sprint M52a Bloco D — Smoke-check tenant-wide do invariante (23/06/2026).
 *
 * Valida que `saldoTotal == Σ ledger` pra TODOS os cooperados com saldo
 * no tenant. Usa o mesmo `sinalDaOperacao` exaustivo do cron.
 */
import { PrismaClient, Prisma } from '@prisma/client';
import { sinalDaOperacao } from '../src/cooper-token/cooper-token.ledger-utils';

const prisma = new PrismaClient();
// v2 fix re-review multitenant P3: padronização com os outros scripts
// faxina-d que usam TENANT_COOPEREBR_ID.
const TENANT = process.env.TENANT_COOPEREBR_ID ?? 'cmn0ho8bx0000uox8wu96u6fd';

async function somaLedger(cooperadoId: string): Promise<Prisma.Decimal> {
  const ledgers = await prisma.cooperTokenLedger.findMany({
    where: { cooperadoId, cooperativaId: TENANT },
    select: { operacao: true, quantidade: true },
  });
  let total = new Prisma.Decimal(0);
  for (const l of ledgers) {
    const q = new Prisma.Decimal(l.quantidade).abs();
    total = sinalDaOperacao(l.operacao) === 1 ? total.plus(q) : total.minus(q);
  }
  return total;
}

async function main(): Promise<void> {
  const saldos = await prisma.cooperTokenSaldo.findMany({
    where: { cooperativaId: TENANT },
    select: {
      cooperadoId: true,
      saldoDisponivel: true,
      saldoPendente: true,
      saldoBloqueadoResgate: true,
      cooperado: { select: { nomeCompleto: true } },
    },
  });
  console.log(`\nTENANT ${TENANT}: ${saldos.length} cooperados com CooperTokenSaldo`);
  const tol = new Prisma.Decimal('0.0001');
  const anomalos: Array<{ nome: string | null | undefined; total: string; ledger: string; delta: string }> = [];
  let somaAbsDelta = new Prisma.Decimal(0);
  let totalTenant = new Prisma.Decimal(0);
  let ledgerTenant = new Prisma.Decimal(0);

  for (const s of saldos) {
    const total = new Prisma.Decimal(s.saldoDisponivel)
      .plus(s.saldoPendente)
      .plus(s.saldoBloqueadoResgate);
    const ledger = await somaLedger(s.cooperadoId);
    const delta = total.minus(ledger);
    totalTenant = totalTenant.plus(total);
    ledgerTenant = ledgerTenant.plus(ledger);
    if (delta.abs().greaterThanOrEqualTo(tol)) {
      anomalos.push({
        nome: s.cooperado?.nomeCompleto,
        total: total.toFixed(4),
        ledger: ledger.toFixed(4),
        delta: delta.toFixed(4),
      });
      somaAbsDelta = somaAbsDelta.plus(delta.abs());
    }
  }

  console.log(`\n=== Invariante tenant-wide ===`);
  console.log(`Σ saldo TOTAL face   = ${totalTenant.toFixed(4)}`);
  console.log(`Σ ledger             = ${ledgerTenant.toFixed(4)}`);
  console.log(`Delta tenant         = ${totalTenant.minus(ledgerTenant).toFixed(4)}`);
  console.log(`\nCooperados anômalos  = ${anomalos.length}`);
  console.log(`Σ|delta| anômalos    = ${somaAbsDelta.toFixed(4)}`);

  if (anomalos.length > 0) {
    const lista = anomalos.length <= 15 ? anomalos : anomalos.slice(0, 15);
    console.log(`\nLista anômalos${anomalos.length > 15 ? ` (primeiros 15 de ${anomalos.length})` : ''}:`);
    for (const a of lista) {
      console.log(`  ${a.nome ?? '?'} | total=${a.total} ledger=${a.ledger} delta=${a.delta}`);
    }
  }
}

main()
  .catch((e) => {
    console.error('[ERRO]', e);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
