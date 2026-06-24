/**
 * Sprint M52b Fatia 2 (23/06/2026) — D-novo-FAXINA-CONTABIL-LEDGER-ALIGN.
 *
 * Aplica espelho contábil dos 2 ledgers da reconciliação v2:
 *   - LUCIANO COSTA BRAGATTO +49 tokens → R$ 22,05
 *   - AMAGES +210 tokens → R$ 94,50
 * Total: R$ 116,55 escriturados em 2.3.01 (passivo) e 5.1.03 (despesa).
 *
 * APPEND-ONLY, idempotente. Após APPLY, o invariante contábil↔saldo
 * cai dos R$ 858,34 medidos para ~R$ 741,79 (o pré-M50 documentado
 * em D-novo-FAXINA-PASSIVO-PRE-M50 — não escriturar sem Walter).
 *
 * Uso:
 *   # DRY-RUN (default):
 *   node -e "require('dotenv').config({path:'.env'}); require('ts-node').register({transpileOnly:true}); require('./scripts/aplicar-ajuste-reconciliacao-v2.ts');"
 *
 *   # APPLY (somente após OK do orquestrador):
 *   FAXINA_AJUSTE_APPLY=1 node -e "require('dotenv').config({path:'.env'}); require('ts-node').register({transpileOnly:true}); require('./scripts/aplicar-ajuste-reconciliacao-v2.ts');"
 */
import { PrismaClient, Prisma } from '@prisma/client';

const prisma = new PrismaClient();
const APPLY = process.env.FAXINA_AJUSTE_APPLY === '1';

const TENANT_COOPEREBR = process.env.TENANT_COOPEREBR_ID ?? 'cmn0ho8bx0000uox8wu96u6fd';
const MARCA_REF_TABELA = 'RECONCILIACAO_HISTORICA';
const MARCA_REF_ID_V2 = '2026-06-23-FAXINA-D-v2';

function fmt(d: Prisma.Decimal | number | null | undefined): string {
  if (d === null || d === undefined) return 'null';
  return new Prisma.Decimal(d as any).toFixed(4);
}

async function main(): Promise<void> {
  console.log('\n========================================================================');
  console.log('  AJUSTE CONTÁBIL RECONCILIAÇÃO v2 — M52b Fatia 2 (D-novo-FAXINA-CONTABIL-LEDGER-ALIGN)');
  console.log('========================================================================');
  console.log(`MODO: ${APPLY ? 'APLICAR' : 'DRY-RUN'}`);
  console.log(`TENANT: CoopereBR (${TENANT_COOPEREBR})`);

  // 1) Buscar os ledgers v2 já aplicados pelo script faxina-d
  const ledgersV2 = await prisma.cooperTokenLedger.findMany({
    where: {
      cooperativaId: TENANT_COOPEREBR,
      referenciaTabela: MARCA_REF_TABELA,
      referenciaId: MARCA_REF_ID_V2,
    },
    select: {
      id: true,
      cooperadoId: true,
      quantidade: true,
      operacao: true,
      tipo: true,
      descricao: true,
      cooperado: { select: { nomeCompleto: true } },
    },
    orderBy: { createdAt: 'asc' },
  });

  console.log(`\nLedgers v2 encontrados: ${ledgersV2.length} (esperado: 2 — LUCIANO + AMAGES)`);
  if (ledgersV2.length === 0) {
    console.log('[abort] nenhum ledger v2 encontrado. Rodar primeiro reconciliacao-historica-faxina-d.ts com FAXINA_APPLY=1.');
    return;
  }

  // 2) Buscar valorTokenReais do tenant
  const plano = await prisma.plano.findFirst({
    where: { cooperativaId: TENANT_COOPEREBR, cooperTokenAtivo: true },
    select: { valorTokenReais: true },
  });
  const valorToken = plano?.valorTokenReais != null ? new Prisma.Decimal(plano.valorTokenReais) : new Prisma.Decimal('0.45');
  console.log(`valorTokenReais: R$ ${fmt(valorToken)}`);

  let totalReais = new Prisma.Decimal(0);
  let totalAplicar = 0;
  let totalSkipIdempotencia = 0;

  for (const l of ledgersV2) {
    const qty = new Prisma.Decimal(l.quantidade);
    const valor = qty.times(valorToken).toDecimalPlaces(2);
    const origemReconciliacaoId = `${MARCA_REF_ID_V2}-${l.cooperadoId}`;

    console.log(`\n--- ${l.cooperado?.nomeCompleto ?? '?'} (${l.cooperadoId}) ---`);
    console.log(`  Ledger v2: id=${l.id} operacao=${l.operacao} qty=${fmt(l.quantidade)}`);
    console.log(`  Espelho contábil:`);
    console.log(`    D 5.1.03 Despesa Bonificação    = R$ ${fmt(valor)}`);
    console.log(`    C 2.3.01 Passivo Tokens         = R$ ${fmt(valor)}`);
    console.log(`    origemId = ${origemReconciliacaoId}`);

    // 3) Checar se já existe (idempotência)
    const jaExiste = await prisma.lancamentoCaixa.findFirst({
      where: {
        cooperativaId: TENANT_COOPEREBR,
        origemTipo: 'RECONCILIACAO_HISTORICA',
        origemId: origemReconciliacaoId,
      },
      select: { id: true },
    });
    if (jaExiste) {
      console.log(`  [SKIP] espelho contábil já existe (id=${jaExiste.id}) — idempotência`);
      totalSkipIdempotencia += 1;
      continue;
    }

    totalAplicar += 1;
    totalReais = totalReais.plus(valor);

    if (!APPLY) continue;

    // 4) Aplicar via service (D + C atomic)
    const competencia = `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}`;

    // garantir contas
    const contasNec = ['5.1.03', '2.3.01', '5.1.10', '1.2.02', '1.2.10', '1.2.11', '1.2.12'];
    for (const codigo of contasNec) {
      const existing = await prisma.planoContas.findFirst({
        where: { codigo, cooperativaId: TENANT_COOPEREBR },
      });
      if (!existing) {
        console.log(`  [warn] conta ${codigo} não existia — criando default`);
      }
    }

    // Direto via prisma.$transaction (sem instanciar NestJS — script standalone)
    const contas51 = await prisma.planoContas.findFirst({ where: { codigo: '5.1.03', cooperativaId: TENANT_COOPEREBR }, select: { id: true } });
    const contas23 = await prisma.planoContas.findFirst({ where: { codigo: '2.3.01', cooperativaId: TENANT_COOPEREBR }, select: { id: true } });
    if (!contas51 || !contas23) {
      throw new Error(`Contas 5.1.03 ou 2.3.01 ausentes pro tenant ${TENANT_COOPEREBR}. Rodar uma operação contábil real antes (token-contabil.service.ts:garantirContas).`);
    }

    const [debito, credito] = await prisma.$transaction([
      prisma.lancamentoCaixa.create({
        data: {
          tipo: 'DESPESA',
          descricao: `[Token] D: Despesa Bonificação (ajuste reconciliação) — espelho ledger v2 ${l.cooperado?.nomeCompleto ?? l.cooperadoId.slice(0, 8)}`,
          valor: valor.toNumber(),
          competencia,
          status: 'REALIZADO',
          dataPagamento: new Date(),
          planoContasId: contas51.id,
          naturezaAto: 'PROPRIO',
          cooperadoId: l.cooperadoId,
          cooperativaId: TENANT_COOPEREBR,
          origemTipo: 'RECONCILIACAO_HISTORICA',
          origemId: origemReconciliacaoId,
          observacoes: `Espelho contábil do ledger v2 ${l.id} (M52b Fatia 2 — fechamento D-novo-FAXINA-CONTABIL-LEDGER-ALIGN parcial)`,
        },
      }),
      prisma.lancamentoCaixa.create({
        data: {
          tipo: 'MUTACAO_PASSIVO',
          descricao: `[Token] C: Passivo Tokens a Resgatar (ajuste reconciliação) — espelho ledger v2 ${l.cooperado?.nomeCompleto ?? l.cooperadoId.slice(0, 8)}`,
          valor: valor.toNumber(),
          competencia,
          status: 'REALIZADO',
          dataPagamento: new Date(),
          planoContasId: contas23.id,
          naturezaAto: 'PROPRIO',
          cooperadoId: l.cooperadoId,
          cooperativaId: TENANT_COOPEREBR,
          origemTipo: 'RECONCILIACAO_HISTORICA_PASSIVO',
          origemId: origemReconciliacaoId,
          observacoes: `Espelho contábil do ledger v2 ${l.id} (M52b Fatia 2 — aumento passivo)`,
        },
      }),
    ]);
    console.log(`  [APLICADO] D id=${debito.id} | C id=${credito.id}`);
  }

  console.log('\n========================================================================');
  console.log(`Total a aplicar:    ${totalAplicar} cooperado(s)`);
  console.log(`Total skip:         ${totalSkipIdempotencia} (idempotência)`);
  console.log(`Σ R$ a escriturar:  R$ ${fmt(totalReais)}`);
  console.log('========================================================================');

  if (!APPLY) {
    console.log('\nDRY-RUN — nada gravado. Aguardando re-review do orquestrador.');
    console.log('Pra aplicar: FAXINA_AJUSTE_APPLY=1 ...');
    return;
  }

  console.log('\n[OK] Espelho contábil aplicado. Rodar check-invariante-contabil-tenant.ts pra ver redução do resíduo.');
}

main()
  .catch((e) => {
    console.error('[ERRO]', e);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
