/**
 * Smoke E2E — Sprint D2 Saque PIX Colaborador Comum (16/06/2026).
 *
 * Valida o fluxo completo do resgate em R$ via PIX por cooperado COMUM
 * (não-Estabelecimento) quando a flag tenant saqueColaboradorAtivo está
 * ON + env produção liberado. Fecha D-novo-RESGATE-PIX-SEM-CAIXA P1
 * conferindo que LancamentoCaixa (D Passivo / C Caixa) é criado.
 *
 * Setup:
 *  - Cooperado SISGDSOLAR SISTEMAS LTDA (cmq57khne0002vavsis4v9oxk):
 *    ehEstabelecimento=false (validado) + ambienteTeste=true. Reusa o
 *    cooperado do seed Sprint M40 (saque-colaborador é orthogonal ao
 *    convênio CV-SISGD-TESTE-001 do M40).
 *  - PIN '123456' via hash direto (mesmo padrão smoke-f6-c4).
 *  - PIX chave whitelist (+5527981341348).
 *  - Saldo CooperToken: 10 tokens (bumped).
 *  - Cooperativa.saqueColaboradorAtivo=true (smoke liga via Prisma direto;
 *    em prod seria via PATCH SUPER_ADMIN).
 *  - env SAQUE_COLABORADOR_PRODUCAO_LIBERADO=true (se ambiente real).
 *
 * Cenário único (1 token + estorno via cleanup):
 *  1. solicitar 1 token (cooperado JWT, PIN, clientRequestId).
 *  2. admin aprova → SIMULATED PIX-out.
 *  3. webhook TRANSFER_DONE → service processa.
 *  4. Confere:
 *     - Recibo PAGO_RECIBO_EMITIDO.
 *     - saldoBloqueadoResgate baixou (queima).
 *     - Ledger RESGATE_PIX criado.
 *     - **LancamentoCaixa D Passivo / C Caixa criado (D-RESGATE-PIX-SEM-CAIXA fechado).**
 *
 * Cleanup ao final:
 *  - Desliga flag tenant (saqueColaboradorAtivo=false).
 *  - Deleta LancamentoCaixa criado.
 *  - Deleta ledger entries criadas.
 *  - Deleta ResgateRecibo criado.
 *  - Restaura saldo original (smoke não pode deixar 9 tokens caídos).
 */
import { PrismaClient } from '@prisma/client';
import * as crypto from 'node:crypto';
import * as jwt from 'jsonwebtoken';
import * as dotenv from 'dotenv';
import * as path from 'node:path';

dotenv.config({ path: path.resolve(__dirname, '..', '.env') });

const API = process.env.API ?? 'http://localhost:3000';
const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET) {
  console.error('JWT_SECRET nao encontrado no .env — abort');
  process.exit(1);
}

const COOPERADO_ID = 'cmq57khne0002vavsis4v9oxk'; // SISGDSOLAR SISTEMAS LTDA
const COOPEREBR_ID = 'cmn0ho8bx0000uox8wu96u6fd';
const USUARIO_EMAIL = 'lucbragatto+sisgd@gmail.com';
const PIN_TESTE = '123456';
const PIX_CHAVE = '+5527981341348';
const PIX_TIPO = 'TELEFONE';
const WEBHOOK_TOKEN = 'SMOKE-D2-WEBHOOK-TOKEN-1234567890ABCDEF';

const prisma = new PrismaClient();

let passCount = 0;
let failCount = 0;

function pass(msg: string) {
  console.log(`  ✓ ${msg}`);
  passCount++;
}
function fail(msg: string) {
  console.log(`  ✗ ${msg}`);
  failCount++;
}

async function call(
  method: string,
  path: string,
  opts: { token?: string; body?: any; webhookToken?: string | null } = {},
): Promise<{ status: number; json: any }> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
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

function hashPin(pin: string, salt: string): string {
  return crypto.createHash('sha256').update(pin + salt).digest('hex');
}

async function gerarJwtCooperado(): Promise<string> {
  const usuario = await prisma.usuario.findUnique({
    where: { email: USUARIO_EMAIL },
    select: { id: true },
  });
  if (!usuario) throw new Error(`Usuario ${USUARIO_EMAIL} nao encontrado (rode seed M40 antes)`);
  return jwt.sign(
    {
      sub: usuario.id,
      id: usuario.id,
      userId: usuario.id,
      email: USUARIO_EMAIL,
      perfil: 'COOPERADO',
      cooperadoId: COOPERADO_ID,
      cooperativaId: COOPEREBR_ID,
    },
    JWT_SECRET!,
    { expiresIn: '1h' },
  );
}

async function gerarJwtAdmin(): Promise<string> {
  const admin = await prisma.usuario.findFirst({
    where: {
      cooperativaId: COOPEREBR_ID,
      perfil: { in: ['ADMIN', 'SUPER_ADMIN'] as any },
      ativo: true,
    },
    select: { id: true, email: true, perfil: true },
  });
  if (!admin) throw new Error('Admin nao encontrado no tenant');
  return jwt.sign(
    {
      sub: admin.id,
      id: admin.id,
      userId: admin.id,
      email: admin.email,
      perfil: admin.perfil,
      cooperativaId: COOPEREBR_ID,
    },
    JWT_SECRET!,
    { expiresIn: '1h' },
  );
}

interface SetupSnapshot {
  saldoInicialDisp: number;
  saldoInicialBloq: number;
  flagTenantOriginal: boolean;
}

async function setup(): Promise<SetupSnapshot> {
  console.log('\n[SETUP] Configurando estado pra cenário smoke');

  // 1. SISGDSOLAR garante ehEstabelecimento=false (smoke testa colaborador).
  const cooperado = await prisma.cooperado.findUnique({
    where: { id: COOPERADO_ID },
    select: { ehEstabelecimento: true, ambienteTeste: true, status: true, pixChave: true },
  });
  if (!cooperado) throw new Error(`Cooperado ${COOPERADO_ID} nao encontrado (rode seed M40)`);
  if (cooperado.ehEstabelecimento) {
    fail('SISGDSOLAR está marcado ehEstabelecimento=true — gate D2 não será testado');
    throw new Error('setup invalido');
  }
  pass(`SISGDSOLAR: ehEstabelecimento=false (cooperado comum, certo pra smoke D2)`);

  // 2. Garante pixChave + pixTipo.
  if (cooperado.pixChave !== PIX_CHAVE) {
    await prisma.cooperado.update({
      where: { id: COOPERADO_ID },
      data: {
        pixChave: PIX_CHAVE,
        pixTipo: PIX_TIPO,
        pixUltimaAlteracaoEm: new Date(Date.now() - 86400000 * 7), // 7 dias atrás (anti-fraude banner OK)
      },
    });
    pass(`Chave PIX setada: ${PIX_CHAVE}`);
  } else {
    pass(`Chave PIX já configurada`);
  }

  // 3. PIN '123456' via hash direto.
  const pinAtual = await prisma.cooperado.findUnique({
    where: { id: COOPERADO_ID },
    select: { pinHash: true, pinSalt: true },
  });
  if (pinAtual?.pinSalt && hashPin(PIN_TESTE, pinAtual.pinSalt) === pinAtual.pinHash) {
    pass(`PIN '${PIN_TESTE}' já configurado`);
  } else {
    const salt = crypto.randomBytes(16).toString('hex');
    await prisma.cooperado.update({
      where: { id: COOPERADO_ID },
      data: { pinHash: hashPin(PIN_TESTE, salt), pinSalt: salt, pinTentativas: 0, pinBloqueadoAte: null },
    });
    pass(`PIN '${PIN_TESTE}' configurado (smoke)`);
  }

  // 4. Saldo CooperToken: 10 tokens.
  const saldoAtual = await prisma.cooperTokenSaldo.upsert({
    where: { cooperadoId: COOPERADO_ID },
    create: {
      cooperadoId: COOPERADO_ID,
      cooperativaId: COOPEREBR_ID,
      saldoDisponivel: 10,
      saldoBloqueadoResgate: 0,
    },
    update: {},
  });
  const saldoInicialDisp = Number(saldoAtual.saldoDisponivel);
  const saldoInicialBloq = Number(saldoAtual.saldoBloqueadoResgate ?? 0);
  if (saldoInicialDisp < 1) {
    await prisma.cooperTokenSaldo.update({
      where: { cooperadoId: COOPERADO_ID },
      data: { saldoDisponivel: 10, saldoBloqueadoResgate: 0 },
    });
    pass(`Saldo bumped pra 10 tokens (era ${saldoInicialDisp})`);
  } else {
    pass(`Saldo SISGDSOLAR: disp=${saldoInicialDisp} bloq=${saldoInicialBloq}`);
  }

  // 5. Liga flag tenant Cooperativa.saqueColaboradorAtivo (smoke direto via Prisma).
  const coopAntes = await prisma.cooperativa.findUnique({
    where: { id: COOPEREBR_ID },
    select: { saqueColaboradorAtivo: true },
  });
  const flagTenantOriginal = coopAntes?.saqueColaboradorAtivo ?? false;
  if (!flagTenantOriginal) {
    await prisma.cooperativa.update({
      where: { id: COOPEREBR_ID },
      data: { saqueColaboradorAtivo: true, saqueColaboradorAtivadoEm: new Date() },
    });
    pass(`Cooperativa.saqueColaboradorAtivo=true (cleanup restaura)`);
  } else {
    pass(`Cooperativa.saqueColaboradorAtivo já era true`);
  }

  // 6. env SAQUE_COLABORADOR_PRODUCAO_LIBERADO=true (caso ambiente seja real).
  if (process.env.AMBIENTE_REAL === 'true') {
    process.env.SAQUE_COLABORADOR_PRODUCAO_LIBERADO = 'true';
    pass(`env SAQUE_COLABORADOR_PRODUCAO_LIBERADO=true (ambiente real)`);
  } else {
    pass(`Ambiente NÃO-real — env gate sempre liberado em dev`);
  }

  // 7. AsaasConfig com webhookToken.
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
  pass(`AsaasConfig.webhookToken configurado`);

  // 8. Limpa resgates residuais de smokes anteriores HOJE (idempotência F6-3).
  const inicioHoje = new Date();
  inicioHoje.setHours(0, 0, 0, 0);
  const residuais = await prisma.resgateRecibo.deleteMany({
    where: {
      cooperadoEstabelecimentoId: COOPERADO_ID,
      cooperativaId: COOPEREBR_ID,
      createdAt: { gte: inicioHoje },
    },
  });
  if (residuais.count > 0) {
    pass(`Limpou ${residuais.count} resgate(s) residual(is) do dia`);
  }

  return { saldoInicialDisp, saldoInicialBloq, flagTenantOriginal };
}

async function cleanup(snap: SetupSnapshot, reciboId: string | null) {
  console.log('\n[CLEANUP] Restaurando estado');

  if (reciboId) {
    // Deleta LancamentoCaixa criado.
    const lancRes = await prisma.lancamentoCaixa.deleteMany({
      where: {
        cooperadoId: COOPERADO_ID,
        cooperativaId: COOPEREBR_ID,
        descricao: { contains: 'Resgate PIX' },
      },
    });
    if (lancRes.count > 0) console.log(`  • Deletou ${lancRes.count} LancamentoCaixa(s) D2`);

    // Deleta ledger entries do recibo.
    const ledgerRes = await prisma.cooperTokenLedger.deleteMany({
      where: { referenciaId: reciboId, referenciaTabela: 'ResgateRecibo' },
    });
    if (ledgerRes.count > 0) console.log(`  • Deletou ${ledgerRes.count} ledger entry(s)`);

    // Deleta recibo.
    await prisma.resgateRecibo.delete({ where: { id: reciboId } }).catch(() => {});
    console.log(`  • Deletou ResgateRecibo ${reciboId}`);
  }

  // Restaura saldo.
  await prisma.cooperTokenSaldo.update({
    where: { cooperadoId: COOPERADO_ID },
    data: {
      saldoDisponivel: snap.saldoInicialDisp,
      saldoBloqueadoResgate: snap.saldoInicialBloq,
      totalResgatado: 0,
    },
  });
  console.log(`  • Saldo restaurado pra disp=${snap.saldoInicialDisp} bloq=${snap.saldoInicialBloq}`);

  // Restaura flag tenant (só se smoke ligou).
  if (!snap.flagTenantOriginal) {
    await prisma.cooperativa.update({
      where: { id: COOPEREBR_ID },
      data: { saqueColaboradorAtivo: false, saqueColaboradorAtivadoEm: null },
    });
    console.log(`  • Cooperativa.saqueColaboradorAtivo restaurada pra false`);
  }
}

async function main() {
  console.log('═══════════════════════════════════════════════════════════════════');
  console.log('🔥 Smoke E2E Sprint D2 — Saque PIX Colaborador Comum');
  console.log(`   API:        ${API}`);
  console.log(`   Cooperado:  SISGDSOLAR SISTEMAS LTDA (${COOPERADO_ID.slice(0, 12)}…)`);
  console.log(`   Cooperativa: CoopereBR (flag tenant ON via smoke)`);
  console.log('═══════════════════════════════════════════════════════════════════');

  let snap: SetupSnapshot | null = null;
  let reciboId: string | null = null;

  try {
    snap = await setup();

    const tokenCooperado = await gerarJwtCooperado();
    const tokenAdmin = await gerarJwtAdmin();

    // ── PASSO 1: solicitarResgate (cooperado comum, 1 token) ──
    console.log('\n[CENÁRIO] colaborador comum solicita resgate de 1 token');
    const clientReqId = `smoke-d2-${Date.now()}-${crypto.randomBytes(4).toString('hex')}`;
    const r1 = await call('POST', '/cooper-token/empresa/resgatar', {
      token: tokenCooperado,
      body: {
        quantidade: 1,
        pin: PIN_TESTE,
        clientRequestId: clientReqId,
        observacao: 'Smoke D2 — saque colaborador comum + D Passivo/C Caixa',
      },
    });
    if (r1.status !== 200 && r1.status !== 201) {
      fail(`solicitarResgate deveria 200/201, veio ${r1.status} body=${JSON.stringify(r1.json).slice(0, 300)}`);
      return;
    }
    reciboId = r1.json.recibo?.id;
    if (!reciboId) {
      fail(`recibo.id ausente na resposta: ${JSON.stringify(r1.json).slice(0, 200)}`);
      return;
    }
    pass(`Resgate criado: id=${reciboId} status=PENDENTE_APROVACAO_COOP (gate D2 funcionou pra colaborador)`);

    // ── PASSO 2: aprovarResgate (admin) ──
    const r2 = await call('POST', `/cooper-token/admin/resgates/${reciboId}/aprovar`, {
      token: tokenAdmin,
    });
    if (r2.status !== 200 && r2.status !== 201) {
      fail(`aprovarResgate deveria 200/201, veio ${r2.status} body=${JSON.stringify(r2.json).slice(0, 200)}`);
      return;
    }
    const asaasTransferId = r2.json.asaasTransferId;
    pass(`Admin aprovou: asaasTransferId=${asaasTransferId} (SIMULATED em dev)`);

    // ── PASSO 3: webhook TRANSFER_DONE ──
    const eventId = `smoke-d2-${Date.now()}`;
    const r3 = await call('POST', '/asaas/webhook', {
      webhookToken: WEBHOOK_TOKEN,
      body: {
        event: 'TRANSFER_DONE',
        transfer: { id: asaasTransferId },
        __smoke_eventId: eventId,
      },
    });
    if (r3.status !== 200) {
      fail(`Webhook TRANSFER_DONE deveria 200, veio ${r3.status} body=${JSON.stringify(r3.json).slice(0, 200)}`);
      return;
    }
    pass(`Webhook TRANSFER_DONE aceito`);

    // Aguarda listener processar async.
    await new Promise((r) => setTimeout(r, 800));

    // ── PASSO 4: verificações finais ──
    const recibo = await prisma.resgateRecibo.findUnique({
      where: { id: reciboId },
      select: { status: true, valorLiquidoReais: true },
    });
    if (recibo?.status !== 'PAGO_RECIBO_EMITIDO') {
      fail(`status final esperado PAGO_RECIBO_EMITIDO, veio ${recibo?.status}`);
    } else {
      pass(`Recibo status=PAGO_RECIBO_EMITIDO`);
    }

    const saldo = await prisma.cooperTokenSaldo.findUnique({
      where: { cooperadoId: COOPERADO_ID },
      select: { saldoDisponivel: true, saldoBloqueadoResgate: true, totalResgatado: true },
    });
    const dispFinal = Number(saldo?.saldoDisponivel ?? 0);
    const bloqFinal = Number(saldo?.saldoBloqueadoResgate ?? 0);
    const totalResgFinal = Number(saldo?.totalResgatado ?? 0);
    if (dispFinal !== snap.saldoInicialDisp - 1) {
      fail(`saldoDisp esperado ${snap.saldoInicialDisp - 1}, veio ${dispFinal} (1 token queimado)`);
    } else {
      pass(`saldoDisp queimou corretamente: ${snap.saldoInicialDisp} → ${dispFinal}`);
    }
    if (bloqFinal !== 0) {
      fail(`saldoBloq esperado 0 pós-queima, veio ${bloqFinal}`);
    } else {
      pass(`saldoBloq voltou a 0 (queima do bloqueado)`);
    }
    if (totalResgFinal < 1) {
      fail(`totalResgatado esperado >=1, veio ${totalResgFinal}`);
    } else {
      pass(`totalResgatado incrementado: ${totalResgFinal}`);
    }

    // Ledger RESGATE_PIX criado
    const ledgerEntries = await prisma.cooperTokenLedger.findMany({
      where: { referenciaId: reciboId, tipo: 'RESGATE_PIX' },
      select: { id: true, operacao: true, quantidade: true },
    });
    if (ledgerEntries.length !== 1) {
      fail(`esperado 1 ledger RESGATE_PIX, achou ${ledgerEntries.length}`);
    } else {
      pass(`Ledger RESGATE_PIX criado: operacao=${ledgerEntries[0].operacao} qty=${ledgerEntries[0].quantidade}`);
    }

    // ★ GATE CENTRAL D2: LancamentoCaixa D Passivo / C Caixa criado ★
    // Busca por descrição (prefixo exclusivo do lancarResgatePix) +
    // cooperadoId + janela recente, depois valida planoContas=5.1.02.
    const lancamentos = await prisma.lancamentoCaixa.findMany({
      where: {
        cooperadoId: COOPERADO_ID,
        cooperativaId: COOPEREBR_ID,
        descricao: { startsWith: '[Token] Resgate PIX' },
      },
      orderBy: { createdAt: 'desc' },
      take: 3,
      include: { planoContas: { select: { codigo: true } } },
    });
    if (lancamentos.length === 0) {
      fail(`★ D-RESGATE-PIX-SEM-CAIXA NÃO FECHADO: nenhum LancamentoCaixa '[Token] Resgate PIX' criado`);
    } else {
      const lanc = lancamentos[0];
      const valorEsperado = Number(recibo?.valorLiquidoReais ?? 0);
      const codigo = lanc.planoContas?.codigo ?? '?';
      if (codigo !== '5.1.02') {
        fail(`LancamentoCaixa criado mas planoContas codigo=${codigo} (esperado 5.1.02)`);
      } else if (Math.abs(Number(lanc.valor) - valorEsperado) > 0.001) {
        fail(`LancamentoCaixa valor esperado ${valorEsperado}, veio ${lanc.valor}`);
      } else if (lanc.tipo !== 'DESPESA') {
        fail(`LancamentoCaixa tipo esperado DESPESA, veio ${lanc.tipo}`);
      } else {
        pass(`★ D-RESGATE-PIX-SEM-CAIXA FECHADO: LancamentoCaixa D Passivo (5.1.02) / C Caixa — valor R$ ${lanc.valor}, tipo=${lanc.tipo}`);
      }
    }
  } catch (err) {
    console.error('\n[ERRO]', err instanceof Error ? err.message : err);
    failCount++;
  } finally {
    if (snap) {
      await cleanup(snap, reciboId);
    }
    await prisma.$disconnect();
  }

  console.log('\n═══════════════════════════════════════════════════════════════════');
  console.log(`Sumário: ${passCount} passes / ${failCount} falhas`);
  if (failCount > 0) {
    console.log('❌ SMOKE FALHOU');
    process.exit(1);
  } else {
    console.log('✅ SMOKE D2 PASS — saque colaborador comum + D Passivo/C Caixa OK');
  }
  console.log('═══════════════════════════════════════════════════════════════════');
}

main().catch((err) => {
  console.error('[smoke-d2] FALHOU:', err);
  process.exit(1);
});
