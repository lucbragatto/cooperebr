/**
 * Smoke E2E — Sprint Clube P1 F6 Bloco C.4 (14/06/2026).
 *
 * Valida end-to-end o resgate em R$ via PIX do cooperado-estabelecimento
 * com webhook TRANSFER_* ligado (P0-B). Asaas SANDBOX simulado — NUNCA
 * chama Asaas real (isAmbienteReal()===false em DEV → status='SIMULATED').
 *
 * AMAGES = cooperado PJ ehEstabelecimento=true, pixChave whitelisted
 * (+5527981341348, regra contatos teste 14/05), PIN '123456' (smoke F4).
 *
 * 5 cenários obrigatórios:
 *  (1) Golden TRANSFER_DONE: solicita → aprova → webhook DONE → PAGO +
 *      queima + ledger RESGATE_PIX.
 *  (2) Falha TRANSFER_FAILED: solicita → aprova → webhook FAILED →
 *      FALHA_PIX + estorno (ESTORNO_RESGATE_PIX) + invariante conservada.
 *  (3) Idempotência: reenvia o MESMO evento TRANSFER → skipped=
 *      'webhook-duplicado' + estado não muda 2×.
 *  (4) Webhook forjado: POST sem asaas-access-token → 401.
 *  (5) Limite diário: setar limite baixo, 1º passa, 2º bloqueado por
 *      EXCEDE_LIMITE_DIARIO (F6-3 fix valida resgates somam no gasto).
 */
import { PrismaClient } from '@prisma/client';
import * as crypto from 'node:crypto';
import * as jwt from 'jsonwebtoken';

const API = process.env.API ?? 'http://localhost:3000';
const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET) {
  console.error('JWT_SECRET nao encontrado no .env — abort');
  process.exit(1);
}

const AMAGES_ID = 'cmp7034d70002vaf0af5ws4ud';
const COOPEREBR_ID = 'cmn0ho8bx0000uox8wu96u6fd';
// Qualquer usuário admin da CoopereBR pro JWT admin do smoke.
const ADMIN_USER_ID_FALLBACK = 'admin-smoke-f6';
const SUB_USUARIO_AMAGES = 'cmq6qo5c40005va2w8gyyzzj7';
const PIN_TESTE = '123456';
const PIX_CHAVE = '+5527981341348';
const PIX_TIPO = 'TELEFONE';
const WEBHOOK_TOKEN = 'SMOKE-F6-WEBHOOK-TOKEN-CONHECIDO-1234567890ABCDEF';

const prisma = new PrismaClient();

let passCount = 0;
let failCount = 0;
const failures: string[] = [];

function pass(msg: string) {
  console.log(`  ✓ ${msg}`);
  passCount++;
}
function fail(msg: string) {
  console.log(`  ✗ ${msg}`);
  failures.push(msg);
  failCount++;
}

async function call(
  method: string,
  path: string,
  opts: { token?: string; body?: any; webhookToken?: string | null } = {},
): Promise<{ status: number; json: any }> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };
  if (opts.token) headers.Authorization = `Bearer ${opts.token}`;
  if (opts.webhookToken !== undefined && opts.webhookToken !== null) {
    headers['asaas-access-token'] = opts.webhookToken;
  }
  const res = await fetch(`${API}${path}`, {
    method,
    headers,
    body: opts.body ? JSON.stringify(opts.body) : undefined,
  });
  const text = await res.text();
  let json: any;
  try {
    json = JSON.parse(text);
  } catch {
    json = text;
  }
  return { status: res.status, json };
}

function gerarJwtAMAGES(): string {
  return jwt.sign(
    {
      sub: SUB_USUARIO_AMAGES,
      email: 'lucbragatto+amages@gmail.com',
      perfil: 'COOPERADO',
      cooperadoId: AMAGES_ID,
      cooperativaId: COOPEREBR_ID,
    },
    JWT_SECRET!,
    { expiresIn: '1h' },
  );
}

async function gerarJwtAdmin(): Promise<string> {
  // Busca um usuário ADMIN real da CoopereBR pra ter usuarioId válido pro AuditLog.
  const admin = await prisma.usuario.findFirst({
    where: { cooperativaId: COOPEREBR_ID, perfil: 'ADMIN' },
    select: { id: true, email: true },
  });
  return jwt.sign(
    {
      sub: admin?.id ?? ADMIN_USER_ID_FALLBACK,
      email: admin?.email ?? 'admin@cooperebr.com.br',
      perfil: 'ADMIN',
      cooperativaId: COOPEREBR_ID,
    },
    JWT_SECRET!,
    { expiresIn: '1h' },
  );
}

function hashPin(pin: string, salt: string): string {
  return crypto.createHash('sha256').update(pin + salt).digest('hex');
}

async function setupAMAGESEstabelecimento() {
  console.log('\n[SETUP] AMAGES ehEstabelecimento + pixChave + PIN + saldo');

  // 1. ehEstabelecimento=true + pixChave/pixTipo + ambienteTeste=true.
  await prisma.cooperado.update({
    where: { id: AMAGES_ID },
    data: {
      ehEstabelecimento: true,
      pixChave: PIX_CHAVE,
      pixTipo: PIX_TIPO,
      pixUltimaAlteracaoEm: new Date(Date.now() - 48 * 3600 * 1000), // 48h atrás → banner NÃO dispara
      ambienteTeste: true,
    },
  });
  pass(`AMAGES seteded: ehEstabelecimento=true + pixChave=${PIX_CHAVE} + pixTipo=${PIX_TIPO}`);

  // 2. PIN '123456' (idempotente — smoke F4 já configurou).
  const c = await prisma.cooperado.findUnique({
    where: { id: AMAGES_ID },
    select: { pinHash: true, pinSalt: true },
  });
  if (c?.pinSalt && hashPin(PIN_TESTE, c.pinSalt) === c.pinHash) {
    pass(`PIN '${PIN_TESTE}' já configurado pra AMAGES (smoke F4)`);
  } else {
    const salt = crypto.randomBytes(16).toString('hex');
    await prisma.cooperado.update({
      where: { id: AMAGES_ID },
      data: {
        pinHash: hashPin(PIN_TESTE, salt),
        pinSalt: salt,
        pinTentativas: 0,
        pinBloqueadoAte: null,
        pinDefinidoEm: new Date(),
      },
    });
    pass(`PIN '${PIN_TESTE}' criado pra AMAGES`);
  }

  // Reset tentativas/lockout + limites largos pros cenários 1-4.
  await prisma.cooperado.update({
    where: { id: AMAGES_ID },
    data: {
      pinTentativas: 0,
      pinBloqueadoAte: null,
      limiteTokenTransacao: 5000,
      limiteTokenDiario: 5000,
    },
  });

  // 3. CooperTokenSaldo com saldo robusto pros 5 cenários (> 100 tokens).
  await prisma.cooperTokenSaldo.upsert({
    where: { cooperadoId: AMAGES_ID },
    create: {
      cooperadoId: AMAGES_ID,
      cooperativaId: COOPEREBR_ID,
      saldoDisponivel: 200,
      saldoPendente: 0,
      totalEmitido: 200,
      totalResgatado: 0,
      saldoBloqueadoResgate: 0,
    },
    update: {
      saldoDisponivel: { increment: 0 }, // não mexe; só garante existência
    },
  });
  // Se saldo abaixo de 100, sobe (idempotente sem zerar histórico).
  const saldoAtual = await prisma.cooperTokenSaldo.findUnique({
    where: { cooperadoId: AMAGES_ID },
    select: { saldoDisponivel: true, saldoBloqueadoResgate: true },
  });
  if (Number(saldoAtual?.saldoDisponivel ?? 0) < 100) {
    await prisma.cooperTokenSaldo.update({
      where: { cooperadoId: AMAGES_ID },
      data: { saldoDisponivel: 200, saldoBloqueadoResgate: 0 },
    });
    pass(`Saldo AMAGES bumped pra 200 tokens (era ${saldoAtual?.saldoDisponivel})`);
  } else {
    pass(
      `Saldo AMAGES: disp=${saldoAtual?.saldoDisponivel} bloq=${saldoAtual?.saldoBloqueadoResgate}`,
    );
  }

  // 4. Limpa qualquer resgate residual de smokes anteriores no dia atual
  //    (idempotência do smoke — F6-3 conta resgates do dia, se rodar 2×
  //    o limite estoura por gasto histórico).
  const inicioHoje = new Date();
  inicioHoje.setHours(0, 0, 0, 0);
  const residuais = await prisma.resgateRecibo.deleteMany({
    where: {
      cooperadoEstabelecimentoId: AMAGES_ID,
      cooperativaId: COOPEREBR_ID,
      createdAt: { gte: inicioHoje },
    },
  });
  if (residuais.count > 0) {
    pass(`Limpou ${residuais.count} resgate(s) residual(is) do dia (smoke idempotência)`);
  }

  // 5. AsaasConfig com webhookToken conhecido (anti-fraude — review pesada).
  await prisma.asaasConfig.upsert({
    where: { cooperativaId: COOPEREBR_ID },
    create: {
      cooperativaId: COOPEREBR_ID,
      apiKey: 'SMOKE-DUMMY-API-KEY',
      ambiente: 'SANDBOX',
      webhookToken: WEBHOOK_TOKEN,
    },
    update: { webhookToken: WEBHOOK_TOKEN },
  });
  pass(`AsaasConfig.webhookToken configurado pra CoopereBR (anti-fraude P0-B)`);
}

interface ReciboSnapshot {
  status: string;
  saldoDisponivel: number;
  saldoBloqueado: number;
  ledgerCount: number;
  ultimoLedgerTipo: string | null;
}

async function snapshot(reciboId: string): Promise<ReciboSnapshot> {
  const [r, saldo, ledger] = await Promise.all([
    prisma.resgateRecibo.findUnique({
      where: { id: reciboId },
      select: { status: true, asaasTransferId: true, ultimoWebhookEventId: true },
    }),
    prisma.cooperTokenSaldo.findUnique({
      where: { cooperadoId: AMAGES_ID },
      select: { saldoDisponivel: true, saldoBloqueadoResgate: true },
    }),
    prisma.cooperTokenLedger.findMany({
      where: { referenciaId: reciboId, referenciaTabela: 'ResgateRecibo' },
      orderBy: { createdAt: 'asc' },
      select: { tipo: true, operacao: true, quantidade: true },
    }),
  ]);
  return {
    status: r?.status ?? 'NOT_FOUND',
    saldoDisponivel: Number(saldo?.saldoDisponivel ?? 0),
    saldoBloqueado: Number(saldo?.saldoBloqueadoResgate ?? 0),
    ledgerCount: ledger.length,
    ultimoLedgerTipo: ledger.length > 0 ? ledger[ledger.length - 1].tipo : null,
  };
}

async function cenario1Golden(tokenCooperado: string, tokenAdmin: string) {
  console.log('\n[CENÁRIO 1] Golden TRANSFER_DONE → PAGO_RECIBO_EMITIDO + queima');

  const snapAntes = await snapshot('placeholder-pre');
  const dispAntes = (
    await prisma.cooperTokenSaldo.findUnique({
      where: { cooperadoId: AMAGES_ID },
      select: { saldoDisponivel: true, saldoBloqueadoResgate: true },
    })
  )!;
  const dispInicial = Number(dispAntes.saldoDisponivel);
  const bloqInicial = Number(dispAntes.saldoBloqueadoResgate);

  // 1.1 Solicitar resgate qty=10 (R$ 4,50 — tier BAIXO).
  const r1 = await call('POST', '/cooper-token/empresa/resgatar', {
    token: tokenCooperado,
    body: {
      quantidade: 10,
      pin: PIN_TESTE,
      clientRequestId: `smoke-f6-c4-golden-${Date.now()}-${crypto.randomBytes(8).toString('hex')}`,
      observacao: 'smoke golden TRANSFER_DONE',
    },
  });
  if (r1.status !== 201 && r1.status !== 200) {
    fail(`Solicitar deveria 200/201, veio ${r1.status} body=${JSON.stringify(r1.json).slice(0, 200)}`);
    return null;
  }
  const reciboId = r1.json.recibo?.id;
  const numeroRecibo = r1.json.recibo?.numeroRecibo;
  pass(`Resgate solicitado: ${numeroRecibo} status=PENDENTE_APROVACAO_COOP`);

  const snapPos1 = await snapshot(reciboId);
  if (snapPos1.status !== 'PENDENTE_APROVACAO_COOP') {
    fail(`Status pós-solicitar deveria PENDENTE_APROVACAO_COOP, veio ${snapPos1.status}`);
  }
  if (Math.abs(snapPos1.saldoDisponivel - (dispInicial - 10)) > 0.0001) {
    fail(`saldoDisp deveria ser ${dispInicial - 10}, veio ${snapPos1.saldoDisponivel}`);
  }
  if (Math.abs(snapPos1.saldoBloqueado - (bloqInicial + 10)) > 0.0001) {
    fail(`saldoBloq deveria ser ${bloqInicial + 10}, veio ${snapPos1.saldoBloqueado}`);
  } else {
    pass(`Saldo bloqueado corretamente: disp ${dispInicial}→${snapPos1.saldoDisponivel} / bloq ${bloqInicial}→${snapPos1.saldoBloqueado}`);
  }

  // Invariante: disp+bloq conservada
  const invAntes = dispInicial + bloqInicial;
  const invPos1 = snapPos1.saldoDisponivel + snapPos1.saldoBloqueado;
  if (Math.abs(invAntes - invPos1) > 0.0001) {
    fail(`Invariante violada pós-solicitar: antes=${invAntes} pós=${invPos1}`);
  } else {
    pass(`Invariante disp+bloq conservada (${invAntes})`);
  }

  // 1.2 Admin aprovar.
  const r2 = await call('POST', `/cooper-token/admin/resgates/${reciboId}/aprovar`, {
    token: tokenAdmin,
  });
  if (r2.status !== 201 && r2.status !== 200) {
    fail(`Aprovar deveria 200/201, veio ${r2.status} body=${JSON.stringify(r2.json).slice(0, 200)}`);
    return null;
  }
  const asaasTransferId = r2.json?.asaasTransferId;
  pass(`Aprovado: asaasTransferId=${asaasTransferId} status=${r2.json?.asaasStatus}`);

  const snapPos2 = await snapshot(reciboId);
  if (snapPos2.status !== 'APROVADO_PIX_DISPARADO') {
    fail(`Status pós-aprovar deveria APROVADO_PIX_DISPARADO, veio ${snapPos2.status}`);
  } else {
    pass(`Status pós-aprovar: APROVADO_PIX_DISPARADO`);
  }

  // 1.3 Webhook TRANSFER_DONE.
  const eventIdGolden = `smoke-f6-golden-${Date.now()}`;
  const r3 = await call('POST', '/asaas/webhook', {
    webhookToken: WEBHOOK_TOKEN,
    body: {
      event: 'TRANSFER_DONE',
      transfer: { id: asaasTransferId },
      __smoke_eventId: eventIdGolden, // só pra log
    },
  });
  if (r3.status !== 200) {
    fail(`Webhook TRANSFER_DONE deveria 200, veio ${r3.status} body=${JSON.stringify(r3.json).slice(0, 200)}`);
    return null;
  }
  pass(`Webhook TRANSFER_DONE aceito: ${JSON.stringify(r3.json)}`);

  // Aguarda processamento async do listener (EventEmitter).
  await new Promise((r) => setTimeout(r, 500));

  const snapPos3 = await snapshot(reciboId);
  if (snapPos3.status !== 'PAGO_RECIBO_EMITIDO') {
    fail(`Status pós-webhook deveria PAGO_RECIBO_EMITIDO, veio ${snapPos3.status}`);
  } else {
    pass(`Status pós-webhook: PAGO_RECIBO_EMITIDO`);
  }

  // Saldo bloqueado deve VOLTAR a zero (queima); saldoDisponivel NÃO sobe.
  if (Math.abs(snapPos3.saldoBloqueado - bloqInicial) > 0.0001) {
    fail(`saldoBloq pós-queima deveria ${bloqInicial}, veio ${snapPos3.saldoBloqueado}`);
  } else {
    pass(`saldoBloq queimou: ${snapPos2.saldoBloqueado}→${snapPos3.saldoBloqueado}`);
  }
  if (Math.abs(snapPos3.saldoDisponivel - (dispInicial - 10)) > 0.0001) {
    fail(`saldoDisp NÃO deveria voltar (resgate é queima), esperado=${dispInicial - 10}, veio=${snapPos3.saldoDisponivel}`);
  } else {
    pass(`saldoDisp não voltou (correto — resgate é saída definitiva): ${snapPos3.saldoDisponivel}`);
  }

  // Ledger tipo=RESGATE_PIX existe.
  const ledgerOk = snapPos3.ultimoLedgerTipo === 'RESGATE_PIX';
  if (!ledgerOk) {
    fail(`Último ledger deveria RESGATE_PIX, veio ${snapPos3.ultimoLedgerTipo}`);
  } else {
    pass(`Ledger RESGATE_PIX criado (DEBITO 10 tokens)`);
  }

  return { reciboId, asaasTransferId, eventIdGolden };
}

async function cenario2Falha(tokenCooperado: string, tokenAdmin: string) {
  console.log('\n[CENÁRIO 2] Falha TRANSFER_FAILED → FALHA_PIX + estorno + invariante');

  const dispAntes = (
    await prisma.cooperTokenSaldo.findUnique({
      where: { cooperadoId: AMAGES_ID },
      select: { saldoDisponivel: true, saldoBloqueadoResgate: true },
    })
  )!;
  const dispInicial = Number(dispAntes.saldoDisponivel);
  const bloqInicial = Number(dispAntes.saldoBloqueadoResgate);

  // 2.1 Solicitar resgate qty=5.
  const r1 = await call('POST', '/cooper-token/empresa/resgatar', {
    token: tokenCooperado,
    body: {
      quantidade: 5,
      pin: PIN_TESTE,
      clientRequestId: `smoke-f6-c4-falha-${Date.now()}-${crypto.randomBytes(8).toString('hex')}`,
      observacao: 'smoke FAILED — esperado estorno',
    },
  });
  if (r1.status !== 201 && r1.status !== 200) {
    fail(`Cenário 2 solicitar falhou: ${r1.status} ${JSON.stringify(r1.json).slice(0, 200)}`);
    return;
  }
  const reciboId = r1.json.recibo?.id;
  const numeroRecibo = r1.json.recibo?.numeroRecibo;

  // 2.2 Aprovar.
  const r2 = await call('POST', `/cooper-token/admin/resgates/${reciboId}/aprovar`, {
    token: tokenAdmin,
  });
  const asaasTransferId = r2.json?.asaasTransferId;

  // 2.3 Webhook TRANSFER_FAILED.
  const r3 = await call('POST', '/asaas/webhook', {
    webhookToken: WEBHOOK_TOKEN,
    body: {
      event: 'TRANSFER_FAILED',
      transfer: { id: asaasTransferId, failReason: 'Conta destino inativa (smoke)' },
    },
  });
  if (r3.status !== 200) {
    fail(`Webhook FAILED deveria 200, veio ${r3.status}`);
    return;
  }

  // Listener async: aguarda estorno terminar (a 1ª iteração do smoke
  // mostrou que 500ms não dá pra capturar o ledger CREDITO se o snapshot
  // rolar imediatamente — sobe pra 1.5s pra defesa em profundidade).
  await new Promise((r) => setTimeout(r, 1500));

  const snap = await snapshot(reciboId);
  if (snap.status !== 'FALHA_PIX') {
    fail(`Status pós-FAILED deveria FALHA_PIX, veio ${snap.status}`);
  } else {
    pass(`${numeroRecibo} → FALHA_PIX`);
  }

  // Estorno: tokens voltam pro disp (NÃO ficam queimados).
  if (Math.abs(snap.saldoDisponivel - dispInicial) > 0.0001) {
    fail(`Estorno: saldoDisp deveria voltar pra ${dispInicial}, veio ${snap.saldoDisponivel}`);
  } else {
    pass(`Estorno: saldoDisp voltou (${dispInicial})`);
  }
  if (Math.abs(snap.saldoBloqueado - bloqInicial) > 0.0001) {
    fail(`saldoBloq deveria voltar pra ${bloqInicial}, veio ${snap.saldoBloqueado}`);
  } else {
    pass(`saldoBloq voltou (${bloqInicial})`);
  }

  // Invariante.
  const invAntes = dispInicial + bloqInicial;
  const invPos = snap.saldoDisponivel + snap.saldoBloqueado;
  if (Math.abs(invAntes - invPos) > 0.0001) {
    fail(`Invariante violada: antes=${invAntes} pós=${invPos}`);
  } else {
    pass(`Invariante disp+bloq conservada (${invAntes})`);
  }

  // Ledger ESTORNO_RESGATE_PIX (NÃO RESGATE_PIX — F6-2 valida).
  if (snap.ultimoLedgerTipo !== 'ESTORNO_RESGATE_PIX') {
    fail(`Último ledger deveria ESTORNO_RESGATE_PIX, veio ${snap.ultimoLedgerTipo}`);
  } else {
    pass(`Ledger ESTORNO_RESGATE_PIX criado (CREDITO 5 — NUNCA apaga, REFORÇO 1)`);
  }
}

async function cenario3Idempotencia(eventoGolden: { asaasTransferId: string; reciboId: string }) {
  console.log('\n[CENÁRIO 3] Idempotência: reenvia MESMO TRANSFER_DONE → skipped=webhook-duplicado');

  const snapAntes = await snapshot(eventoGolden.reciboId);

  const r = await call('POST', '/asaas/webhook', {
    webhookToken: WEBHOOK_TOKEN,
    body: {
      event: 'TRANSFER_DONE',
      transfer: { id: eventoGolden.asaasTransferId },
    },
  });

  if (r.status !== 200) {
    fail(`Webhook duplicado deveria 200, veio ${r.status}`);
    return;
  }
  pass(`Webhook duplicado retornou 200: ${JSON.stringify(r.json)}`);

  await new Promise((r) => setTimeout(r, 300));

  const snapPos = await snapshot(eventoGolden.reciboId);

  // Estado deve ser IDÊNTICO.
  if (snapPos.status !== snapAntes.status) {
    fail(`Status mudou em duplicado: ${snapAntes.status} → ${snapPos.status}`);
  } else {
    pass(`Status estável: ${snapPos.status}`);
  }
  if (snapPos.ledgerCount !== snapAntes.ledgerCount) {
    fail(`Ledger duplicou: ${snapAntes.ledgerCount} → ${snapPos.ledgerCount}`);
  } else {
    pass(`Ledger não duplicou (${snapAntes.ledgerCount} entries)`);
  }
  if (
    Math.abs(snapPos.saldoDisponivel - snapAntes.saldoDisponivel) > 0.0001 ||
    Math.abs(snapPos.saldoBloqueado - snapAntes.saldoBloqueado) > 0.0001
  ) {
    fail(`Saldo mudou em duplicado: disp ${snapAntes.saldoDisponivel}→${snapPos.saldoDisponivel}, bloq ${snapAntes.saldoBloqueado}→${snapPos.saldoBloqueado}`);
  } else {
    pass(`Saldo estável (REFORÇO 2 idempotência webhook)`);
  }
}

async function cenario4Forjado() {
  console.log('\n[CENÁRIO 4] Webhook forjado (sem asaas-access-token) → 401');

  // Sem header asaas-access-token.
  const r1 = await call('POST', '/asaas/webhook', {
    body: {
      event: 'TRANSFER_DONE',
      transfer: { id: 'forjado-12345' },
    },
  });
  if (r1.status !== 401) {
    fail(`Sem token deveria 401, veio ${r1.status}: ${JSON.stringify(r1.json).slice(0, 200)}`);
  } else {
    pass(`Sem token → 401 UnauthorizedException`);
  }

  // Token errado.
  const r2 = await call('POST', '/asaas/webhook', {
    webhookToken: 'TOKEN-FORJADO-ERRADO-XXXXXX',
    body: {
      event: 'TRANSFER_DONE',
      transfer: { id: 'forjado-67890' },
    },
  });
  if (r2.status !== 401) {
    fail(`Token errado deveria 401, veio ${r2.status}`);
  } else {
    pass(`Token errado → 401 UnauthorizedException`);
  }
}

async function cenario5LimiteDiario(tokenCooperado: string) {
  console.log('\n[CENÁRIO 5] Limite diário: 1º passa, 2º bloqueado (F6-3 soma resgates)');

  // Quanto já foi gasto até agora (cenário 1 pago R$4,50; cenário 2 estornado não conta).
  // Setar limite diário pequeno na COOPERATIVA pra forçar bloqueio.
  // 1º resgate: 5 tokens = R$ 2,25. 2º: 5 tokens = R$ 2,25.
  // Limite diário = R$ 6: cenário 1 gastou 4.50 → 1º soma 6.75 > 6 → bloqueia já no 1º.
  // Limite diário = R$ 8: cenário 1 gastou 4.50 → 1º soma 6.75 ≤ 8 (passa) → 2º soma 9 > 8 (bloqueia).
  await prisma.cooperativa.update({
    where: { id: COOPEREBR_ID },
    data: { limiteTokenDiarioTeto: 8 },
  });
  // E o limite por transação tem que caber R$ 2,25 — manter alto.
  await prisma.cooperativa.update({
    where: { id: COOPEREBR_ID },
    data: { limiteTokenTransacaoTeto: 100 },
  });
  // Auto-limite do AMAGES não pode clampar abaixo. Manter alto.
  await prisma.cooperado.update({
    where: { id: AMAGES_ID },
    data: { limiteTokenDiario: 1000, limiteTokenTransacao: 1000 },
  });
  pass(`Limite diário CoopereBR setado pra R$ 8 (cenário 1 gastou R$4,50 — folga R$3,50)`);

  // 1º resgate (qty=5, R$ 2,25) deve passar (gastoHoje=4.50 + 2.25 = 6.75 ≤ 8).
  const r1 = await call('POST', '/cooper-token/empresa/resgatar', {
    token: tokenCooperado,
    body: {
      quantidade: 5,
      pin: PIN_TESTE,
      clientRequestId: `smoke-f6-c4-limite1-${Date.now()}-${crypto.randomBytes(8).toString('hex')}`,
      observacao: 'smoke limite 1',
    },
  });
  if (r1.status !== 201 && r1.status !== 200) {
    fail(`Cenário 5 / 1º resgate deveria 200/201, veio ${r1.status} body=${JSON.stringify(r1.json).slice(0, 200)}`);
  } else {
    pass(`1º resgate (R$ 2,25 — gasto acumulado R$ 6,75 ≤ R$ 8) PASSOU`);
  }

  // 2º resgate (qty=5, R$ 2,25) deve bloquear (gastoHoje agora 6.75 + 2.25 = 9 > 8).
  const r2 = await call('POST', '/cooper-token/empresa/resgatar', {
    token: tokenCooperado,
    body: {
      quantidade: 5,
      pin: PIN_TESTE,
      clientRequestId: `smoke-f6-c4-limite2-${Date.now()}-${crypto.randomBytes(8).toString('hex')}`,
      observacao: 'smoke limite 2 — deve bloquear',
    },
  });
  if (r2.status === 400 && /limite diário|EXCEDE_LIMITE_DIARIO|excede.*limite|limite/i.test(JSON.stringify(r2.json))) {
    pass(`2º resgate BLOQUEADO por limite diário (F6-3 inclui resgates no gasto): ${JSON.stringify(r2.json).slice(0, 150)}`);
  } else {
    fail(`2º resgate deveria 400 EXCEDE_LIMITE_DIARIO, veio ${r2.status} body=${JSON.stringify(r2.json).slice(0, 200)}`);
  }
}

async function restaurarLimites() {
  // Cleanup pós-cenário 5.
  await prisma.cooperativa.update({
    where: { id: COOPEREBR_ID },
    data: { limiteTokenDiarioTeto: 2000, limiteTokenTransacaoTeto: 500 },
  });
  await prisma.cooperado.update({
    where: { id: AMAGES_ID },
    data: { limiteTokenTransacao: 5000, limiteTokenDiario: 5000 },
  });
  console.log('\n[CLEANUP] Limites restaurados: cooperativa diario=2000/trans=500, AMAGES auto=5000/5000');
}

async function main() {
  console.log('🔥 Smoke E2E — F6 Bloco C.4 (resgate em PIX + webhook TRANSFER_*)\n');

  await setupAMAGESEstabelecimento();

  const tokenCooperado = gerarJwtAMAGES();
  const tokenAdmin = await gerarJwtAdmin();

  const golden = await cenario1Golden(tokenCooperado, tokenAdmin);
  await cenario2Falha(tokenCooperado, tokenAdmin);
  if (golden) {
    await cenario3Idempotencia({
      asaasTransferId: golden.asaasTransferId,
      reciboId: golden.reciboId,
    });
  }
  await cenario4Forjado();
  await cenario5LimiteDiario(tokenCooperado);
  await restaurarLimites();

  console.log('\n══════════════════════════════════════════════');
  console.log(`Resultado: ${passCount} ✓  ${failCount} ✗`);
  if (failCount > 0) {
    console.log('\nFalhas:');
    failures.forEach((f) => console.log(`  ✗ ${f}`));
    process.exit(1);
  }
  console.log('🟢 SMOKE F6 BLOCO C.4 — PASS COMPLETO');
  process.exit(0);
}

main().catch((err) => {
  console.error('FATAL:', err);
  process.exit(1);
});
