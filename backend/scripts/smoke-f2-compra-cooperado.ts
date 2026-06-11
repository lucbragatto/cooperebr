/**
 * Smoke E2E — Sprint Clube P1 Fase 2 (11/06/2026).
 *
 * Valida end-to-end o caminho `cooperado-PJ compra tokens via Asaas
 * SANDBOX` + idempotencia 2 camadas via dual-webhook (CONFIRMED +
 * RECEIVED do mesmo payment.id, eventIds diferentes).
 *
 * Pre-requisitos:
 *  - Backend rodando em :3000.
 *  - Santi (cmq6qo4hi0002va2wti5k1sqw) ATIVO, tipoPessoa=PJ,
 *    ambienteTeste=true (confirmado em check-asaas-config-pre-smoke.ts).
 *  - AsaasConfig SANDBOX com apiKey + webhookToken (confirmado).
 *
 * Roteiro:
 *  1. Login Santi → JWT.
 *  2. POST /cooper-token/cooperado/comprar 100 PIX → cria
 *     CooperTokenCompra + Asaas SANDBOX cobranca.
 *  3. Le saldo inicial do cooperado.
 *  4. Dispara webhook 1: PAYMENT_CONFIRMED.
 *  5. Aguarda listener processar (~1.5s).
 *  6. Dispara webhook 2: PAYMENT_RECEIVED (mesmo payment.id, eventId diff).
 *  7. Aguarda listener processar (~1.5s).
 *  8. Assert: CooperTokenCompra status=PAGO; saldo +98 (taxa 2% F1.5);
 *     ledger COMPRA_PJ_COOPERADA com referenciaTabela=CooperTokenCompra;
 *     APENAS 1 entry no ledger (1 credito so — compare-and-swap funciona).
 */
import { PrismaClient } from '@prisma/client';

const API = process.env.API ?? 'http://localhost:3000';
const SANTI_LOGIN = 'lucbragatto+santi@gmail.com';
const SANTI_SENHA = 'Santi@2026';
const SANTI_COOPERADO_ID = 'cmq6qo4hi0002va2wti5k1sqw';
const COOPEREBR_ID = 'cmn0ho8bx0000uox8wu96u6fd';

const prisma = new PrismaClient();

async function call(method: string, path: string, opts: { token?: string; body?: any; rawHeaders?: Record<string, string> } = {}) {
  const res = await fetch(`${API}${path}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(opts.token ? { Authorization: `Bearer ${opts.token}` } : {}),
      ...(opts.rawHeaders ?? {}),
    },
    body: opts.body ? JSON.stringify(opts.body) : undefined,
  });
  const text = await res.text();
  let json: any;
  try { json = JSON.parse(text); } catch { json = text; }
  if (!res.ok) {
    throw new Error(`HTTP ${res.status} ${method} ${path}: ${text}`);
  }
  return json;
}

function sleep(ms: number) { return new Promise((r) => setTimeout(r, ms)); }

async function main() {
  console.log('═══ Smoke E2E F2 — Santi compra + dual-webhook ═══\n');

  // [0] Recupera webhookToken da CoopereBR via banco (smoke local).
  const cfg = await prisma.asaasConfig.findUnique({
    where: { cooperativaId: COOPEREBR_ID },
    select: { webhookToken: true, ambiente: true },
  });
  if (!cfg?.webhookToken) throw new Error('AsaasConfig.webhookToken nao configurado pra CoopereBR');
  console.log(`[0] AsaasConfig SANDBOX OK (ambiente=${cfg.ambiente}, webhookToken ${cfg.webhookToken.length} chars)\n`);

  // [1] Login Santi
  console.log('[1] Login Santi...');
  const login = await call('POST', '/auth/login', {
    body: { identificador: SANTI_LOGIN, senha: SANTI_SENHA },
  });
  const token: string = login.token ?? login.access_token;
  console.log(`    JWT recebido (${token.length} chars)`);

  // [2] Saldo inicial
  const saldoInicialQuery = await prisma.cooperTokenSaldo.findUnique({
    where: { cooperadoId: SANTI_COOPERADO_ID },
    select: { saldoDisponivel: true, totalEmitido: true },
  });
  const saldoInicial = Number(saldoInicialQuery?.saldoDisponivel ?? 0);
  console.log(`[2] Saldo inicial do cooperado Santi: ${saldoInicial} tokens\n`);

  // [3] POST /cooper-token/cooperado/comprar 100 PIX
  console.log('[3] POST /cooper-token/cooperado/comprar 100 PIX...');
  const compra = await call('POST', '/cooper-token/cooperado/comprar', {
    token,
    body: { quantidade: 100, formaPagamento: 'PIX' },
  });
  console.log(`    compraId=${compra.compraId}`);
  console.log(`    valorTotal=R$ ${compra.valorTotal}`);
  console.log(`    asaasId=${compra.asaasId}`);
  console.log(`    linkPagamento=${compra.linkPagamento ? 'OK' : '-'}`);
  console.log(`    pixQrCode=${compra.pixQrCode ? `OK (${compra.pixQrCode.length} chars base64)` : '-'}`);
  console.log(`    pixCopiaECola=${compra.pixCopiaECola ? `OK (${compra.pixCopiaECola.slice(0, 30)}...)` : '-'}`);

  // Assert CooperTokenCompra criada AGUARDANDO_PAGAMENTO
  const compraDb = await prisma.cooperTokenCompra.findUnique({
    where: { id: compra.compraId },
  });
  if (!compraDb) throw new Error('CooperTokenCompra nao achada no banco');
  if (compraDb.status !== 'AGUARDANDO_PAGAMENTO') {
    throw new Error(`Status inicial errado: ${compraDb.status}`);
  }
  if (compraDb.compradorCooperadoId !== SANTI_COOPERADO_ID) {
    throw new Error(`compradorCooperadoId errado: ${compraDb.compradorCooperadoId}`);
  }
  if (!compraDb.asaasId) {
    throw new Error('asaasId nao gravado');
  }
  if (!compraDb.asaasCobrancaId) {
    throw new Error('asaasCobrancaId nao gravado');
  }
  console.log(`    DB OK: status=${compraDb.status}, compradorCooperadoId=${compraDb.compradorCooperadoId}\n`);

  const asaasPaymentId = compraDb.asaasId;

  // [4] Webhook 1: PAYMENT_CONFIRMED
  console.log('[4] Webhook 1: PAYMENT_CONFIRMED...');
  const webhook1 = await call('POST', '/asaas/webhook', {
    rawHeaders: { 'asaas-access-token': cfg.webhookToken },
    body: {
      event: 'PAYMENT_CONFIRMED',
      payment: {
        id: asaasPaymentId,
        value: Number(compraDb.valorTotal),
        status: 'CONFIRMED',
        paymentDate: new Date().toISOString().slice(0, 10),
      },
    },
  });
  console.log(`    response: ${JSON.stringify(webhook1)}`);

  // Aguarda listener (eventEmitter async) processar
  await sleep(1500);

  // [5] Webhook 2: PAYMENT_RECEIVED (mesmo paymentId, eventId diferente)
  console.log('\n[5] Webhook 2: PAYMENT_RECEIVED (mesmo payment, eventId diff)...');
  const webhook2 = await call('POST', '/asaas/webhook', {
    rawHeaders: { 'asaas-access-token': cfg.webhookToken },
    body: {
      event: 'PAYMENT_RECEIVED',
      payment: {
        id: asaasPaymentId,
        value: Number(compraDb.valorTotal),
        status: 'RECEIVED',
        paymentDate: new Date().toISOString().slice(0, 10),
      },
    },
  });
  console.log(`    response: ${JSON.stringify(webhook2)}`);

  await sleep(1500);

  // [6] Asserts pos-webhook
  console.log('\n[6] Validando estado final do banco...');

  const compraFinal = await prisma.cooperTokenCompra.findUnique({
    where: { id: compra.compraId },
  });
  console.log(`    CooperTokenCompra.status: ${compraFinal?.status}`);
  console.log(`    CooperTokenCompra.dataPagamento: ${compraFinal?.dataPagamento?.toISOString() ?? '-'}`);
  console.log(`    CooperTokenCompra.ultimoWebhookEventId: ${compraFinal?.ultimoWebhookEventId}`);

  const saldoFinalQuery = await prisma.cooperTokenSaldo.findUnique({
    where: { cooperadoId: SANTI_COOPERADO_ID },
    select: { saldoDisponivel: true, totalEmitido: true },
  });
  const saldoFinal = Number(saldoFinalQuery?.saldoDisponivel ?? 0);
  const totalEmitidoFinal = Number(saldoFinalQuery?.totalEmitido ?? 0);
  const delta = Math.round((saldoFinal - saldoInicial) * 10000) / 10000;
  console.log(`    Saldo final: ${saldoFinal} (delta +${delta} tokens)`);
  console.log(`    Total emitido final: ${totalEmitidoFinal}`);

  const ledgerEntries = await prisma.cooperTokenLedger.findMany({
    where: {
      referenciaId: compra.compraId,
      referenciaTabela: 'CooperTokenCompra',
    },
    select: {
      id: true,
      tipo: true,
      operacao: true,
      quantidade: true,
      saldoApos: true,
      descricao: true,
      createdAt: true,
    },
  });
  console.log(`    Ledger entries pra compraId=${compra.compraId}: ${ledgerEntries.length}`);
  for (const l of ledgerEntries) {
    console.log(`      • tipo=${l.tipo} operacao=${l.operacao} qty=${l.quantidade} saldoApos=${l.saldoApos}`);
    console.log(`        descricao: ${l.descricao}`);
  }

  // Asserts criticos
  let ok = true;
  console.log('\n═══ ASSERTS ═══');
  if (compraFinal?.status === 'PAGO') {
    console.log('  ✅ status = PAGO');
  } else {
    console.log(`  ❌ status esperado PAGO, atual ${compraFinal?.status}`);
    ok = false;
  }
  if (delta === 98) {
    console.log('  ✅ saldo +98 tokens (taxa 2% F1.5 aplicada corretamente)');
  } else {
    console.log(`  ❌ delta esperado +98, atual +${delta}`);
    ok = false;
  }
  if (ledgerEntries.length === 1) {
    console.log('  ✅ ledger: 1 entry (compare-and-swap fechou a corrida — sem credito dobrado)');
  } else {
    console.log(`  ❌ ledger: ${ledgerEntries.length} entries (esperado 1)`);
    ok = false;
  }
  const entry = ledgerEntries[0];
  if (entry && entry.tipo === 'COMPRA_PJ_COOPERADA' && entry.operacao === 'CREDITO') {
    console.log(`  ✅ ledger entry: tipo=COMPRA_PJ_COOPERADA operacao=CREDITO`);
  } else {
    console.log(`  ❌ ledger entry tipo/operacao errados: tipo=${entry?.tipo} operacao=${entry?.operacao}`);
    ok = false;
  }
  if (webhook2 && (webhook2 as any).received === true) {
    console.log('  ✅ webhook 2 retornou 200 (sem erro)');
  } else {
    console.log(`  ❌ webhook 2 resposta inesperada: ${JSON.stringify(webhook2)}`);
    ok = false;
  }

  await prisma.$disconnect();

  if (!ok) {
    console.log('\n💥 SMOKE FALHOU');
    process.exit(1);
  }
  console.log('\n🟢 SMOKE PASS — F2 end-to-end OK (compra + dual-webhook + idempotencia + saldo correto)');
}

main().catch(async (err) => {
  console.error('\n💥 ERRO:', err.message);
  try { await prisma.$disconnect(); } catch {}
  process.exit(1);
});
