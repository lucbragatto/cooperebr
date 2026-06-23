/**
 * Sprint Faxina Contábil do Token — Smoke E2E REAL (Fase A/B).
 *
 * Não requer HTTP/JWT — chama services diretamente via NestFactory.
 * Verifica end-to-end:
 *   1. INGRESSO_PAGO (COMPRA_PJ_COOPERADA via creditar): cria
 *      D Caixa(planoContasId=null) + C Passivo 2.3.01 (PROPRIO).
 *   2. BONIFICACAO_DESCONTO (FATURA_CHEIA via creditar): cria
 *      D 5.1.10 Custo Desconto + C Passivo 2.3.01 (PROPRIO).
 *   3. BONIFICACAO_ADMIN (BONUS_INDICACAO via creditar): cria
 *      D 5.1.03 Despesa Bonificação + C Passivo 2.3.01 (PROPRIO).
 *   4. ABATE (lancarResgateFatura direto): D 2.3.01 com origemId.
 *
 * NÃO usa cooperado pré-existente (lição re-review M49 22/06).
 * Cria 2 cooperados-teste FRESCOS no CoopereBR Teste com whitelist
 * + deleta no final (cleanup limpo).
 */
import { NestFactory } from '@nestjs/core';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma.service';
import { CooperTokenService } from '../src/cooper-token/cooper-token.service';
import { TokenContabilService } from '../src/financeiro/token-contabil.service';

const TENANT_NOME = 'CoopereBR Teste';
const EMAIL_COOP_PJ = 'lucbragatto+faxina-pj@gmail.com';
const TELEFONE = '27981341348';

async function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

async function main() {
  console.log('\n=== FAXINA CONTÁBIL — Smoke E2E REAL Fase A/B ===\n');

  const app = await NestFactory.createApplicationContext(AppModule, { logger: ['error', 'warn'] });
  const prisma = app.get(PrismaService);
  const cooperToken = app.get(CooperTokenService);
  const contabil = app.get(TokenContabilService);

  try {
    const tenant = await prisma.cooperativa.findFirstOrThrow({
      where: { nome: TENANT_NOME },
      select: { id: true, nome: true },
    });
    console.log(`Tenant: ${tenant.nome} (${tenant.id})`);

    // 1. Cooperado-teste fresco (PJ pra COMPRA_PJ_COOPERADA fazer sentido)
    console.log('\n[1] Criar/recriar cooperado-teste PJ fresco...');
    let coop = await prisma.cooperado.findFirst({
      where: { email: EMAIL_COOP_PJ, cooperativaId: tenant.id },
      select: { id: true },
    });
    if (coop) {
      console.log(`  [cleanup] cooperado de smoke anterior id=${coop.id} — deletando ledgers/saldos antes`);
      await prisma.cooperTokenLedger.deleteMany({ where: { cooperadoId: coop.id } });
      await prisma.cooperTokenSaldo.deleteMany({ where: { cooperadoId: coop.id } });
      await prisma.lancamentoCaixa.deleteMany({ where: { cooperadoId: coop.id } });
      await prisma.cooperado.delete({ where: { id: coop.id } });
    }
    // cpf é @unique obrigatório no model; usamos um fake-de-teste isolado.
    const cpfFake = '99988877766';
    await prisma.cooperado.deleteMany({ where: { cpf: cpfFake } }).catch(() => {});
    const novo = await prisma.cooperado.create({
      data: {
        cooperativa: { connect: { id: tenant.id } },
        nomeCompleto: 'M50 Faxina PJ Smoke',
        cpf: cpfFake,
        email: EMAIL_COOP_PJ,
        telefone: TELEFONE,
        status: 'ATIVO',
        tipoPessoa: 'PJ',
        ambienteTeste: true,
      } as any,
    });
    console.log(`  novo cooperado PJ: ${novo.id}`);

    // 2. Apaga lancamentos pré-existentes do tenant pra começar limpo
    console.log('\n[2] Snapshot ANTES (zera contagem do smoke):');
    const antesCounts = await prisma.lancamentoCaixa.groupBy({
      by: ['planoContasId'],
      where: { cooperativaId: tenant.id, planoContas: { codigo: { in: ['2.3.01', '5.1.10', '5.1.03'] } } },
      _count: { _all: true },
      _sum: { valor: true },
    });
    for (const a of antesCounts) {
      const c = await prisma.planoContas.findUnique({
        where: { id: a.planoContasId! },
        select: { codigo: true, nome: true },
      });
      console.log(`  ${c?.codigo} ${c?.nome}: count=${a._count._all} Σ=R$${Number(a._sum.valor ?? 0).toFixed(2)}`);
    }

    // 3. INGRESSO_PAGO via creditar(COMPRA_PJ_COOPERADA)
    console.log('\n[3] INGRESSO_PAGO (COMPRA_PJ_COOPERADA, 100 tokens @ R$0.45 = R$45)...');
    await cooperToken.creditar({
      cooperadoId: novo.id,
      cooperativaId: tenant.id,
      tipo: 'COMPRA_PJ_COOPERADA' as any,
      quantidade: 100,
      valorEmissao: 0.45,
      forcarDisponivel: true,
      referenciaId: 'smoke-faxina-ingresso',
      referenciaTabela: 'smoke',
    } as any);
    await sleep(800); // listener pós-commit

    // 4. BONIFICACAO_DESCONTO via creditar(FATURA_CHEIA)
    console.log('\n[4] BONIFICACAO_DESCONTO (FATURA_CHEIA, 50 tokens @ R$0.45 = R$22.50)...');
    await cooperToken.creditar({
      cooperadoId: novo.id,
      cooperativaId: tenant.id,
      tipo: 'FATURA_CHEIA' as any,
      quantidade: 50,
      valorEmissao: 0.45,
      forcarDisponivel: true,
      referenciaId: 'smoke-faxina-faturacheia',
      referenciaTabela: 'smoke',
    } as any);
    await sleep(800);

    // 5. BONIFICACAO_ADMIN via creditar(BONUS_INDICACAO)
    console.log('\n[5] BONIFICACAO_ADMIN (BONUS_INDICACAO, 20 tokens @ R$0.45 = R$9)...');
    await cooperToken.creditar({
      cooperadoId: novo.id,
      cooperativaId: tenant.id,
      tipo: 'BONUS_INDICACAO' as any,
      quantidade: 20,
      valorEmissao: 0.45,
      forcarDisponivel: true,
      referenciaId: 'smoke-faxina-bonusind',
      referenciaTabela: 'smoke',
    } as any);
    await sleep(800);

    // 6. ABATE via lancarResgateFatura direto (sem ledger; só lança contábil)
    console.log('\n[6] ABATE (lancarResgateFatura direto, R$10 com origemId=cob-smoke-1)...');
    await contabil.lancarResgateFatura({
      cooperativaId: tenant.id,
      cooperadoId: novo.id,
      valor: 10,
      descricao: 'smoke-faxina-abate',
      origemId: 'cob-smoke-1',
    });

    // 7. ABATE 2× com mesmo origemId (idempotência)
    console.log('\n[7] ABATE idempotência (mesmo origemId — deve retornar existente)...');
    const idem = await contabil.lancarResgateFatura({
      cooperativaId: tenant.id,
      cooperadoId: novo.id,
      valor: 10,
      descricao: 'smoke-faxina-abate-retry',
      origemId: 'cob-smoke-1',
    });
    console.log(`  retorno idempotência: id=${idem.id}`);

    // ===== ASSERTS =====
    console.log('\n=== ASSERTS ===');

    // [A] Lançamento INGRESSO_PAGO: D Caixa (planoContasId=null) + C Passivo 2.3.01
    const ingressoLancs = await prisma.lancamentoCaixa.findMany({
      where: {
        cooperadoId: novo.id,
        descricao: { contains: 'ingresso pago' },
      },
      select: { id: true, tipo: true, descricao: true, valor: true, planoContasId: true, naturezaAto: true, planoContas: { select: { codigo: true } } },
    });
    console.log(`  [A] INGRESSO_PAGO lancamentos: ${ingressoLancs.length} (esperado 2)`);
    const dCaixa = ingressoLancs.find((l) => l.descricao.startsWith('[Token] D: Caixa'));
    const cPassivoIng = ingressoLancs.find((l) => l.descricao.startsWith('[Token] C: Passivo Tokens a Resgatar (ingresso pago)'));
    if (!dCaixa || dCaixa.planoContasId !== null) throw new Error('FAIL: D Caixa NÃO tem planoContasId=null');
    if (!cPassivoIng || cPassivoIng.planoContas?.codigo !== '2.3.01') throw new Error('FAIL: C Passivo NÃO aponta 2.3.01');
    if (dCaixa.tipo !== 'RECEITA') throw new Error('FAIL: D Caixa não é tipo RECEITA');
    if (cPassivoIng.tipo !== 'RECEITA') throw new Error('FAIL: C Passivo não é tipo RECEITA (convenção pós-faxina)');
    if (dCaixa.naturezaAto !== 'PROPRIO') throw new Error('FAIL: naturezaAto COMPRA_PJ não é PROPRIO');
    console.log('     OK — D Caixa(null/RECEITA) + C 2.3.01(RECEITA) + PROPRIO');

    // [B] BONIFICACAO_DESCONTO: D 5.1.10 + C 2.3.01
    const bdLancs = await prisma.lancamentoCaixa.findMany({
      where: {
        cooperadoId: novo.id,
        descricao: { contains: 'FATURA_CHEIA' },
      },
      select: { tipo: true, descricao: true, planoContas: { select: { codigo: true } } },
    });
    console.log(`  [B] BONIFICACAO_DESCONTO lancamentos: ${bdLancs.length} (esperado 2)`);
    const dCusto = bdLancs.find((l) => l.descricao.includes('D: Custo Desconto Token'));
    const cPassivoBd = bdLancs.find((l) => l.descricao.includes('C: Passivo Tokens a Resgatar') && l.descricao.includes('FATURA_CHEIA'));
    if (!dCusto || dCusto.planoContas?.codigo !== '5.1.10') throw new Error('FAIL: D Custo Desconto NÃO em 5.1.10');
    if (!cPassivoBd || cPassivoBd.planoContas?.codigo !== '2.3.01') throw new Error('FAIL: C Passivo NÃO em 2.3.01');
    if (dCusto.tipo !== 'DESPESA') throw new Error('FAIL: D Custo não é DESPESA');
    if (cPassivoBd.tipo !== 'RECEITA') throw new Error('FAIL: C Passivo não é RECEITA');
    console.log('     OK — D 5.1.10(DESPESA) + C 2.3.01(RECEITA)');

    // [C] BONIFICACAO_ADMIN: D 5.1.03 + C 2.3.01 (via lancarEmissaoAdminLote através do handleEmitido)
    const baLancs = await prisma.lancamentoCaixa.findMany({
      where: {
        cooperadoId: novo.id,
        descricao: { contains: 'BONUS_INDICACAO' },
      },
      select: { descricao: true, planoContas: { select: { codigo: true } } },
    });
    console.log(`  [C] BONIFICACAO_ADMIN lancamentos: ${baLancs.length} (esperado >=2)`);
    const dDespesaBonif = baLancs.find((l) => l.descricao.includes('D: Despesa de Bonificação'));
    const cPassivoBa = baLancs.find((l) => l.descricao.includes('C: Passivo Tokens a Resgatar') && l.descricao.includes('BONUS_INDICACAO'));
    if (!dDespesaBonif || dDespesaBonif.planoContas?.codigo !== '5.1.03') throw new Error('FAIL: D Despesa Bonif NÃO em 5.1.03');
    if (!cPassivoBa || cPassivoBa.planoContas?.codigo !== '2.3.01') throw new Error('FAIL: C Passivo (admin) NÃO em 2.3.01');
    console.log('     OK — D 5.1.03 + C 2.3.01 (via lancarEmissaoAdminLote)');

    // [D] ABATE: D 2.3.01 com origemTipo=COBRANCA_ABATE_FATURA + origemId=cob-smoke-1
    const abateLancs = await prisma.lancamentoCaixa.findMany({
      where: {
        cooperadoId: novo.id,
        origemTipo: 'COBRANCA_ABATE_FATURA',
        origemId: 'cob-smoke-1',
      },
      select: { id: true, tipo: true, planoContas: { select: { codigo: true } } },
    });
    console.log(`  [D] ABATE com origemId=cob-smoke-1: ${abateLancs.length} (esperado 1 — idempotência)`);
    if (abateLancs.length !== 1) throw new Error(`FAIL: idempotência falhou — ${abateLancs.length} lançamentos (era pra ser 1)`);
    if (abateLancs[0].planoContas?.codigo !== '2.3.01') throw new Error('FAIL: ABATE NÃO em 2.3.01');
    if (abateLancs[0].tipo !== 'DESPESA') throw new Error('FAIL: D ABATE deveria ser tipo DESPESA');
    console.log('     OK — 1 lançamento D 2.3.01(DESPESA) com origemId protegido por @@unique');

    // [E] 1.2.01 Receita Venda Tokens NÃO recebe nenhum lançamento novo
    const venda = await prisma.planoContas.findFirst({
      where: { codigo: '1.2.01', cooperativaId: tenant.id },
    });
    if (venda) {
      const vendaLancs = await prisma.lancamentoCaixa.count({
        where: { planoContasId: venda.id, cooperadoId: novo.id },
      });
      console.log(`  [E] 1.2.01 Receita Venda novos lançamentos: ${vendaLancs} (esperado 0 — APOSENTADA)`);
      if (vendaLancs > 0) throw new Error('FAIL: 1.2.01 ainda recebe lançamentos novos');
      console.log('     OK — 1.2.01 não recebe nada (armadilha tributária aposentada)');
    }

    // [F] Invariante: Σ saldo do cooperado deve casar com Σ ledger
    const saldoCoop = await prisma.cooperTokenSaldo.findUnique({
      where: { cooperadoId: novo.id },
      select: { saldoDisponivel: true },
    });
    const ledgers = await prisma.cooperTokenLedger.groupBy({
      by: ['operacao'],
      where: { cooperadoId: novo.id },
      _sum: { quantidade: true },
    });
    let cre = 0, deb = 0;
    for (const g of ledgers) {
      const v = Number(g._sum.quantidade ?? 0);
      if (g.operacao === 'CREDITO') cre += v;
      else deb += v;
    }
    const delta = Number(saldoCoop?.saldoDisponivel ?? 0) - (cre - deb);
    console.log(`  [F] Invariante cooperado: saldo=${Number(saldoCoop?.saldoDisponivel ?? 0)} ledger=${cre - deb} delta=${delta}`);
    if (Math.abs(delta) > 0.0001) throw new Error(`FAIL: invariante quebrado pra novo cooperado (delta=${delta})`);
    console.log('     OK — invariante FUNDACAO §4#1 preservado');

    // Cleanup
    console.log('\n=== CLEANUP ===');
    await prisma.lancamentoCaixa.deleteMany({ where: { cooperadoId: novo.id } });
    await prisma.cooperTokenLedger.deleteMany({ where: { cooperadoId: novo.id } });
    await prisma.cooperTokenSaldo.deleteMany({ where: { cooperadoId: novo.id } });
    await prisma.cooperado.delete({ where: { id: novo.id } });
    console.log(`  cooperado smoke + ledgers + lançamentos deletados (limpo)`);

    console.log('\n✅ SMOKE FAXINA Fase A/B PASSOU — modelo voucher + ato cooperativo funcionando.\n');
  } catch (err) {
    console.error('\n❌ SMOKE FAXINA FALHOU:', err);
    process.exit(1);
  } finally {
    await app.close();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
