/**
 * Sprint M52a — FAXINA Bloco D — Reconciliação histórica APPEND-ONLY v2.
 *
 * CORREÇÃO 23/06/2026 (re-review do orquestrador pós-reversão):
 * A v1 desse script comparou contra `saldoDisponivel`, mas o ledger reflete
 * o TOTAL (disponível + pendente + bloqueado). Resultado: AGOSTINHO (6.86
 * pendente) e LEONARDO (980 pendente) levaram DEBITOS errados; AMAGES foi
 * sub-corrigido (+200 em vez de +210). Os 4 ledgers errados foram revertidos
 * via `reverter-reconciliacao-historica-faxina-d.ts`.
 *
 * v2 ANCORA NO TOTAL e classifica cada CooperTokenOperacao explicitamente:
 *   saldoTotal = saldoDisponivel + saldoPendente + saldoBloqueadoResgate
 *   Σ(ledger)  via switch exaustivo (CREDITO/DOACAO_RECEBIDA/COMPRA_PARCEIRO
 *               somam; DEBITO/EXPIRACAO/DOACAO_ENVIADA/ABATIMENTO_ENERGIA/
 *               TRANSFERENCIA_PARCEIRO/RESGATE_CLUBE/OXIDACAO subtraem).
 *
 * ESTADO ATUAL ESPERADO (após reversão da v1):
 *  - LUCIANO: saldo total 147 / Σ ledger 98 → delta +49 → CREDITO 49
 *  - AMAGES:  saldo total 180 / Σ ledger -30 → delta +210 → CREDITO 210
 *  - AGOSTINHO: saldo total 6.86 / Σ ledger 6.86 → delta 0 (nada)
 *  - LEONARDO:  saldo total 980 / Σ ledger 980 → delta 0 (nada)
 *  - TESTE E2E: saldo total 1.96 / Σ ledger 1.96 → delta 0 (nada)
 *
 * Estratégia (mantida):
 *  - APPEND-ONLY: NUNCA modifica ledger existente. Cria lançamentos
 *    compensatórios marcados com referenciaTabela=RECONCILIACAO_HISTORICA.
 *  - PRESERVA todos os saldos (verdade — não tocar).
 *  - saldoApos no lançamento novo = saldoTotal atual (não muda nada).
 *  - DRY-RUN obrigatório.
 *  - Aplica somente com FAXINA_APPLY=1 + OK explícito pós-re-review.
 *  - Guard de idempotência: rodar de novo após apply NÃO duplica
 *    (checa ledger pré-existente com mesmo refTabela+refId+cooperadoId).
 *
 * Fix estrutural M52a já em produção: quantidade SEMPRE positiva no
 * model (guard no creditar/debitar). Este script respeita isso —
 * usa CooperTokenOperacao pra direção e Math.abs no campo quantidade.
 *
 * Uso:
 *   # DRY-RUN (default):
 *   node -e "require('dotenv').config({path:'.env'}); require('ts-node').register({transpileOnly:true}); require('./scripts/reconciliacao-historica-faxina-d.ts');"
 *
 *   # APPLY (somente depois do OK do orquestrador):
 *   FAXINA_APPLY=1 node -e "require('dotenv').config({path:'.env'}); require('ts-node').register({transpileOnly:true}); require('./scripts/reconciliacao-historica-faxina-d.ts');"
 */
import { PrismaClient, CooperTokenOperacao, CooperTokenTipo, Prisma } from '@prisma/client';
// v2 re-review code (a)+(b): import de arquivo dedicado pra evitar carregar
// CooperTokenJob inteiro (decorators @Cron, deps NestJS) no script ts-node.
import { sinalDaOperacao } from '../src/cooper-token/cooper-token.ledger-utils';

const prisma = new PrismaClient();
const APPLY = process.env.FAXINA_APPLY === '1';

const TENANT_COOPEREBR = process.env.TENANT_COOPEREBR_ID ?? 'cmn0ho8bx0000uox8wu96u6fd';
const MARCA_REF_TABELA = 'RECONCILIACAO_HISTORICA';
// v2 (23/06): tag bumpada pra distinguir das 4 entradas v1 já revertidas.
const MARCA_REF_ID = '2026-06-23-FAXINA-D-v2';
const MARCA_DESCRICAO_PREFIX = 'RECONCILIACAO_HISTORICA_2026_06_23_v2';

const COOPERADOS_ALVO: ReadonlyArray<{ id: string; rotulo: string }> = [
  { id: 'cmobfandh0002vaa8p35bluig', rotulo: 'TESTE E2E CLUBE SPRINT9' },
  { id: 'cmn0dsc4w005guols56peyc5h', rotulo: 'LUCIANO COSTA BRAGATTO' },
  { id: 'cmn0ds1ol000buolsf088k9mj', rotulo: 'AGOSTINHO SOBRAL SAMPAIO' },
  { id: 'cmp7034d70002vaf0af5ws4ud', rotulo: 'AMAGES' },
  { id: 'cmq1hm5q9000kvatgxlmnidlq', rotulo: 'LEONARDO PIZZOL VIGNA' },
];

function fmt(d: Prisma.Decimal | number | null | undefined): string {
  if (d === null || d === undefined) return 'null';
  return new Prisma.Decimal(d as any).toFixed(4);
}

async function calcularLedgerSum(cooperadoId: string): Promise<Prisma.Decimal> {
  // v2 fix re-review orquestrador 23/06: scope multi-tenant + switch
  // exaustivo via helper compartilhada `sinalDaOperacao` (cooper-token.job).
  const ledgers = await prisma.cooperTokenLedger.findMany({
    where: { cooperadoId, cooperativaId: TENANT_COOPEREBR },
    select: { operacao: true, quantidade: true },
  });

  let total = new Prisma.Decimal(0);
  for (const l of ledgers) {
    const q = new Prisma.Decimal(l.quantidade).abs();
    const sinal = sinalDaOperacao(l.operacao);
    total = sinal === 1 ? total.plus(q) : total.minus(q);
  }
  return total;
}

interface PlanoReconciliacao {
  cooperadoId: string;
  rotulo: string;
  saldoDisponivel: Prisma.Decimal;
  saldoPendente: Prisma.Decimal;
  saldoBloqueado: Prisma.Decimal;
  saldoTotal: Prisma.Decimal;
  somaLedger: Prisma.Decimal;
  delta: Prisma.Decimal;
  operacaoCompensatoria: CooperTokenOperacao | null;
  quantidadeCompensatoria: Prisma.Decimal;
  precisaAjuste: boolean;
  // v2: tolerância 0.0001 alinhada Decimal(10,4).
}

// v2 fix re-review: tolerância no Decimal(10,4) — evita falso-positivo
// quando delta < 0.0001.
const TOLERANCIA = new Prisma.Decimal('0.0001');

async function montarPlano(): Promise<PlanoReconciliacao[]> {
  const planos: PlanoReconciliacao[] = [];

  for (const alvo of COOPERADOS_ALVO) {
    const saldoRow = await prisma.cooperTokenSaldo.findUnique({
      where: { cooperadoId: alvo.id },
      select: {
        saldoDisponivel: true,
        saldoPendente: true,
        saldoBloqueadoResgate: true,
        cooperativaId: true,
      },
    });

    if (!saldoRow) {
      console.log(`[skip] cooperado ${alvo.id} (${alvo.rotulo}) sem CooperTokenSaldo — não pode reconciliar.`);
      continue;
    }

    if (saldoRow.cooperativaId !== TENANT_COOPEREBR) {
      console.log(`[abort] cooperado ${alvo.id} (${alvo.rotulo}) está no tenant ${saldoRow.cooperativaId}, esperado ${TENANT_COOPEREBR}.`);
      continue;
    }

    const saldoDisponivel = new Prisma.Decimal(saldoRow.saldoDisponivel);
    const saldoPendente = new Prisma.Decimal(saldoRow.saldoPendente);
    const saldoBloqueado = new Prisma.Decimal(saldoRow.saldoBloqueadoResgate);
    // v2 fix re-review: TOTAL (disponível + pendente + bloqueado) é o
    // passivo real; ledger reflete isso.
    const saldoTotal = saldoDisponivel.plus(saldoPendente).plus(saldoBloqueado);

    const somaLedger = await calcularLedgerSum(alvo.id);
    const delta = saldoTotal.minus(somaLedger);

    let operacao: CooperTokenOperacao | null = null;
    let quantidade = new Prisma.Decimal(0);
    let precisa = false;

    if (delta.abs().greaterThanOrEqualTo(TOLERANCIA)) {
      precisa = true;
      quantidade = delta.abs();
      operacao = delta.isPositive() ? CooperTokenOperacao.CREDITO : CooperTokenOperacao.DEBITO;
    }

    planos.push({
      cooperadoId: alvo.id,
      rotulo: alvo.rotulo,
      saldoDisponivel,
      saldoPendente,
      saldoBloqueado,
      saldoTotal,
      somaLedger,
      delta,
      operacaoCompensatoria: operacao,
      quantidadeCompensatoria: quantidade,
      precisaAjuste: precisa,
    });
  }

  return planos;
}

function imprimirAntes(p: PlanoReconciliacao): void {
  console.log(`\n--- ${p.rotulo} (${p.cooperadoId}) ---`);
  console.log(`  ANTES:`);
  console.log(`    saldoDisponivel        = ${fmt(p.saldoDisponivel)}`);
  console.log(`    saldoPendente          = ${fmt(p.saldoPendente)}`);
  console.log(`    saldoBloqueadoResgate  = ${fmt(p.saldoBloqueado)}`);
  console.log(`    saldoTOTAL             = ${fmt(p.saldoTotal)}`);
  console.log(`    Σ ledger (switch exaustivo) = ${fmt(p.somaLedger)}`);
  console.log(`    delta (total − Σ)      = ${fmt(p.delta)}`);
}

function imprimirPlano(p: PlanoReconciliacao): void {
  if (!p.precisaAjuste) {
    console.log(`  AÇÃO: nenhum ajuste necessário (delta = 0).`);
    return;
  }
  const tipo =
    p.operacaoCompensatoria === CooperTokenOperacao.CREDITO
      ? CooperTokenTipo.BONIFICACAO_ADMIN
      : CooperTokenTipo.ESTORNO_BONIFICACAO_ADMIN;
  console.log(`  AÇÃO: criar 1 CooperTokenLedger compensatório (APPEND-ONLY)`);
  console.log(`    operacao         = ${p.operacaoCompensatoria}`);
  console.log(`    tipo             = ${tipo}`);
  console.log(`    quantidade       = ${fmt(p.quantidadeCompensatoria)}  (sempre POSITIVA — fix estrutural M52a)`);
  console.log(`    saldoApos        = ${fmt(p.saldoTotal)}  (saldo TOTAL atual; ancora invariante)`);
  console.log(`    referenciaTabela = ${MARCA_REF_TABELA}`);
  console.log(`    referenciaId     = ${MARCA_REF_ID}`);
  console.log(`    descricao        = ${MARCA_DESCRICAO_PREFIX} — delta=${fmt(p.delta)}`);
}

function imprimirDepois(p: PlanoReconciliacao): void {
  if (!p.precisaAjuste) return;
  const somaDepois =
    p.operacaoCompensatoria === CooperTokenOperacao.CREDITO
      ? p.somaLedger.plus(p.quantidadeCompensatoria)
      : p.somaLedger.minus(p.quantidadeCompensatoria);
  const deltaDepois = p.saldoTotal.minus(somaDepois);
  console.log(`  DEPOIS (projetado):`);
  console.log(`    saldoTOTAL             = ${fmt(p.saldoTotal)}  (INALTERADO)`);
  console.log(`    Σ ledger               = ${fmt(somaDepois)}`);
  console.log(`    delta (total − Σ)      = ${fmt(deltaDepois)}  ${deltaDepois.abs().lessThan(TOLERANCIA) ? 'OK (zerou)' : 'ERRO — não zerou'}`);
}

async function aplicar(p: PlanoReconciliacao): Promise<void> {
  if (!p.precisaAjuste || !p.operacaoCompensatoria) return;

  // v2 fix re-review: guard de idempotência — não duplica ledger
  // compensatório se script rodar 2x com FAXINA_APPLY=1.
  const jaExiste = await prisma.cooperTokenLedger.findFirst({
    where: {
      cooperadoId: p.cooperadoId,
      cooperativaId: TENANT_COOPEREBR,
      referenciaTabela: MARCA_REF_TABELA,
      referenciaId: MARCA_REF_ID,
    },
    select: { id: true },
  });
  if (jaExiste) {
    console.log(`  [SKIP] ledger compensatório já existe (id=${jaExiste.id}) — idempotência`);
    return;
  }

  const tipo =
    p.operacaoCompensatoria === CooperTokenOperacao.CREDITO
      ? CooperTokenTipo.BONIFICACAO_ADMIN
      : CooperTokenTipo.ESTORNO_BONIFICACAO_ADMIN;

  const criado = await prisma.cooperTokenLedger.create({
    data: {
      cooperadoId: p.cooperadoId,
      cooperativaId: TENANT_COOPEREBR,
      tipo,
      operacao: p.operacaoCompensatoria,
      quantidade: p.quantidadeCompensatoria,
      saldoApos: p.saldoTotal,
      referenciaTabela: MARCA_REF_TABELA,
      referenciaId: MARCA_REF_ID,
      descricao: `${MARCA_DESCRICAO_PREFIX} — delta=${fmt(p.delta)} — reconcilia saldo TOTAL vs Σ ledger (switch exaustivo) pré-disciplina M39`,
    },
    select: { id: true },
  });
  console.log(`  [APLICADO] ledger novo id=${criado.id}`);
}

async function main(): Promise<void> {
  console.log('\n========================================================================');
  console.log('  FAXINA Bloco D — Reconciliação histórica APPEND-ONLY (M52a)');
  console.log('========================================================================');
  console.log(`MODO: ${APPLY ? 'APLICAR' : 'DRY-RUN'}`);
  console.log(`TENANT: CoopereBR (${TENANT_COOPEREBR})`);
  console.log(`Cooperados-alvo: ${COOPERADOS_ALVO.length}`);

  const planos = await montarPlano();

  let totalDelta = new Prisma.Decimal(0);
  let totalAjustes = 0;
  for (const p of planos) {
    imprimirAntes(p);
    imprimirPlano(p);
    imprimirDepois(p);
    totalDelta = totalDelta.plus(p.delta);
    if (p.precisaAjuste) totalAjustes += 1;
  }

  console.log('\n========================================================================');
  console.log(`Σ delta dos ${planos.length} cooperados = ${fmt(totalDelta)}`);
  console.log(`Ajustes a aplicar = ${totalAjustes}`);
  console.log('========================================================================');

  if (!APPLY) {
    console.log('\nDRY-RUN — nada gravado. Aguardando re-review do orquestrador.');
    console.log('Pra aplicar: FAXINA_APPLY=1 ...');
    return;
  }

  console.log('\n>>> APLICANDO (APPEND-ONLY no CooperTokenLedger; saldoDisponivel intocado) <<<');
  for (const p of planos) {
    console.log(`\n--- ${p.rotulo} (${p.cooperadoId}) ---`);
    await aplicar(p);
  }
  console.log('\n[OK] Reconciliação aplicada. Rodar o script de novo (DRY-RUN) deve mostrar delta=0 em todos.');
}

main()
  .catch((e) => {
    console.error('[ERRO]', e);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
