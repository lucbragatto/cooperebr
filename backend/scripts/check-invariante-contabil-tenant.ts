/**
 * Sprint M52a v2 (23/06/2026) — Re-review final orquestrador: checar
 * invariante CONTÁBIL↔SALDO (FUNDACAO §4#1):
 *   Passivo 2.3.01 == Σ saldoTotal × valorTokenReais
 *
 * Esse é distinto do invariante LEDGER↔SALDO (Σ saldoTotal = Σ ledger).
 * A reconciliação Bloco D foi ledger-only (create direto no
 * CooperTokenLedger sem lançamento contábil) → pode haver resíduo
 * contábil↔ledger.
 */
import { PrismaClient, Prisma } from '@prisma/client';

const prisma = new PrismaClient();
const TENANT = process.env.TENANT_COOPEREBR_ID ?? 'cmn0ho8bx0000uox8wu96u6fd';
const CONTA_PASSIVO_TOKEN = '2.3.01';

async function main(): Promise<void> {
  // 1) Σ saldoTotal × valorToken — passivo "esperado" do circuito.
  const saldosAgg = await prisma.cooperTokenSaldo.aggregate({
    where: { cooperativaId: TENANT },
    _sum: {
      saldoDisponivel: true,
      saldoPendente: true,
      saldoBloqueadoResgate: true,
    },
  });
  const totalFace = new Prisma.Decimal(saldosAgg._sum.saldoDisponivel ?? 0)
    .plus(saldosAgg._sum.saldoPendente ?? 0)
    .plus(saldosAgg._sum.saldoBloqueadoResgate ?? 0);

  const plano = await prisma.plano.findFirst({
    where: { cooperativaId: TENANT, cooperTokenAtivo: true },
    select: { valorTokenReais: true },
  });
  const valorToken = plano?.valorTokenReais != null ? new Prisma.Decimal(plano.valorTokenReais) : new Prisma.Decimal('0.45');
  const passivoEsperado = totalFace.times(valorToken);

  // 2) Passivo contábil real = Σ LancamentoCaixa com planoContasId=2.3.01,
  // considerando o sinal contábil:
  //   C Passivo (credita 2.3.01) → aumenta passivo
  //   D Passivo (debita 2.3.01) → diminui passivo
  // Pós-faxina M52a v2, ambas as pernas têm tipo='MUTACAO_PASSIVO' (não
  // mais RECEITA/DESPESA). Discriminamos pelo `descricao` ou planoContas:
  //  - descricao começa com "[Token] C: ..." → CRÉDITO no passivo (+)
  //  - descricao começa com "[Token] D: ..." → DÉBITO no passivo (−)
  //  - descricao começa com "[Token] Resgate PIX" → DÉBITO (D Passivo)
  const contaPassivo = await prisma.planoContas.findFirst({
    where: { cooperativaId: TENANT, codigo: CONTA_PASSIVO_TOKEN },
    select: { id: true, nome: true },
  });

  if (!contaPassivo) {
    console.log(`[abort] Conta 2.3.01 (Passivo Tokens a Resgatar) não existe no tenant ${TENANT}. Sistema pode estar sem lançamento contábil de token ainda.`);
    console.log(`\n=== Resumo ===`);
    console.log(`  Σ saldoTotal face        = ${totalFace.toFixed(4)}`);
    console.log(`  valorTokenReais          = ${valorToken.toFixed(4)}`);
    console.log(`  Passivo ESPERADO         = ${passivoEsperado.toFixed(2)}`);
    console.log(`  Passivo CONTÁBIL atual   = 0.0000 (conta inexistente)`);
    console.log(`  Resíduo contábil↔saldo   = ${passivoEsperado.toFixed(2)}`);
    return;
  }

  const lancsPassivo = await prisma.lancamentoCaixa.findMany({
    where: {
      cooperativaId: TENANT,
      planoContasId: contaPassivo.id,
      status: { not: 'CANCELADO' },
    },
    select: {
      id: true,
      tipo: true,
      valor: true,
      descricao: true,
      observacoes: true,
    },
  });

  let creditoPassivo = new Prisma.Decimal(0);
  let debitoPassivo = new Prisma.Decimal(0);
  let naoClassificado = 0;
  for (const l of lancsPassivo) {
    const v = new Prisma.Decimal(l.valor);
    const desc = l.descricao || '';
    if (desc.includes('C: Passivo') || desc.includes('C Passivo')) {
      creditoPassivo = creditoPassivo.plus(v);
    } else if (
      desc.includes('D: Baixa Passivo') ||
      desc.includes('Resgate PIX') ||
      desc.includes('D Passivo')
    ) {
      debitoPassivo = debitoPassivo.plus(v);
    } else {
      naoClassificado += 1;
    }
  }
  const saldoPassivoContabil = creditoPassivo.minus(debitoPassivo);
  const residuo = passivoEsperado.minus(saldoPassivoContabil);

  console.log(`\n=== Invariante CONTÁBIL↔SALDO (FUNDACAO §4#1) — tenant ${TENANT} ===`);
  console.log(`  Σ saldoTotal face        = ${totalFace.toFixed(4)} tokens`);
  console.log(`  valorTokenReais          = R$ ${valorToken.toFixed(4)}`);
  console.log(`  Passivo ESPERADO         = R$ ${passivoEsperado.toFixed(2)}`);
  console.log(`  ─────────────────────────────────────────────────────`);
  console.log(`  Lançamentos 2.3.01 ativos: ${lancsPassivo.length}`);
  console.log(`  Créditos passivo (aumenta) = R$ ${creditoPassivo.toFixed(2)}`);
  console.log(`  Débitos  passivo (baixa)   = R$ ${debitoPassivo.toFixed(2)}`);
  console.log(`  Saldo passivo CONTÁBIL     = R$ ${saldoPassivoContabil.toFixed(2)}`);
  console.log(`  Não classificados          = ${naoClassificado}`);
  console.log(`  ─────────────────────────────────────────────────────`);
  console.log(`  RESÍDUO contábil↔saldo     = R$ ${residuo.toFixed(2)}`);

  if (residuo.abs().lessThan(new Prisma.Decimal('0.01'))) {
    console.log(`\n  ✅ INVARIANTE OK — passivo contábil bate com saldo face × valorToken.`);
  } else {
    console.log(`\n  ⚠️  RESÍDUO DETECTADO — D-novo-FAXINA-CONTABIL-LEDGER-ALIGN catalogado.`);
    console.log(`     Causa esperada: reconciliação Bloco D foi ledger-only (sem`);
    console.log(`     lançamento contábil espelhado). Tokens emitidos pré-M50 também`);
    console.log(`     podem ter passado sem 2.3.01.`);
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
