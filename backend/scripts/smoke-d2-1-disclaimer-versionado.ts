/**
 * Smoke E2E — Sprint D2.1 v2 Bloco (6) — Disclaimer Versionado (17/06/2026).
 *
 * Valida a Salvaguarda 5 versionada ponta-a-ponta com 3 papéis reais
 * (SUPER_ADMIN + ADMIN tenant + COOPERADO comum) contra
 * localhost:3000. Cobre os 8 passos do roteiro:
 *
 *  1. SUPER_ADMIN POST cria GLOBAL v2 (texto novo).
 *  2. Cooperado-comum (SISGDSOLAR, não-Estab) GET /portal/disclaimer-saque
 *     retorna v2 + origem=GLOBAL → aceita FK v2 + solicita saque →
 *     recibo grava disclaimerSaqueId=v2.id.
 *  3. ADMIN CoopereBR POST cria OVERRIDE tenant-v1.
 *  4. Cooperado-comum GET retorna tenant-v1 + origem=TENANT.
 *  5. SUPER_ADMIN POST cria GLOBAL v3 → cooperado da CoopereBR (com
 *     override tenant-v1) NÃO afetado (override prevalece sobre global).
 *  6. ADMIN DELETE desativa override → cooperado volta a ver global v3.
 *  7. Tentativa de saque com FK STALE (id de v2 antiga) → BadRequest
 *     "Termo de saque desatualizado".
 *  8. Lookup do recibo da etapa 2 → texto exato da v2 recuperado via FK
 *     (mesmo com global e tenant tendo evoluído várias vezes depois).
 *
 * Setup:
 *  - Reusa cooperado SISGDSOLAR (cmq57khne0002vavsis4v9oxk) do smoke M41.
 *  - Liga flag saqueColaboradorAtivo (cleanup restaura).
 *  - Insere CooperTokenLedger CREDITO DESCONTO_FATURA (Salvaguarda 1
 *    permite saque de origem DESCONTO_FATURA).
 *  - Whitelist (27981341348 + lucbragatto+sisgd@gmail.com).
 *
 * Cleanup ao final (idempotente):
 *  - Desativa global v3 + tenant-v1 + global v2 criados (deixa só seed v1
 *    inicial ativo). Versões NUNCA são deletadas (histórico imutável).
 *  - Deleta recibo + LancamentoCaixa criado (se chegou a etapa 2).
 *  - Deleta CooperTokenLedger CREDITO criado pra teste.
 *  - Restaura saldo + flag tenant.
 */
import { PrismaClient } from '@prisma/client';
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

const COOPERADO_ID = 'cmq57khne0002vavsis4v9oxk'; // SISGDSOLAR (não-Estab)
const COOPEREBR_ID = 'cmn0ho8bx0000uox8wu96u6fd';
const SUPER_ADMIN_ID = 'cmn3oj8040002uobotvxu872q';
const SUPER_ADMIN_EMAIL = 'superadmin@cooperebr.com.br';
const ADMIN_ID = 'cmn0ds0i80000uolsxtnts907';
const ADMIN_EMAIL = 'admin@cooperebr.com.br';
const COOPERADO_EMAIL = 'lucbragatto+sisgd@gmail.com';

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
  pathSuffix: string,
  opts: { token?: string; body?: any } = {},
): Promise<{ status: number; json: any }> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (opts.token) headers.Authorization = `Bearer ${opts.token}`;
  const res = await fetch(`${API}${pathSuffix}`, {
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

function jwtFor(usuarioId: string, email: string, perfil: string, cooperativaId: string | null, extra: any = {}) {
  return jwt.sign(
    {
      sub: usuarioId,
      id: usuarioId,
      userId: usuarioId,
      email,
      perfil,
      cooperativaId,
      ...extra,
    },
    JWT_SECRET!,
    { expiresIn: '1h' },
  );
}

const TEXTO_V2_GLOBAL = `Smoke D2.1 v2 — texto GLOBAL v2 publicado pelo SUPER_ADMIN durante smoke E2E. Este texto substitui o seed v1 (que continua acessível pelo histórico). Cooperados de qualquer tenant SEM override leem este texto.`;
const TEXTO_TENANT_V1 = `Smoke D2.1 v2 — texto OVERRIDE TENANT v1 publicado pelo ADMIN da CoopereBR. Substitui o GLOBAL pra cooperados da CoopereBR enquanto este override estiver ativo. Specificidade local do tenant.`;
const TEXTO_V3_GLOBAL = `Smoke D2.1 v2 — texto GLOBAL v3 publicado pelo SUPER_ADMIN. Cooperados de tenants com override ativo NAO veem este texto (override prevalece). Cooperados sem override sim.`;

interface SetupSnapshot {
  saldoInicialDisp: number;
  saldoInicialBloq: number;
  flagTenantOriginal: boolean;
  ledgerCreditoId: string | null;
}

async function setup(): Promise<SetupSnapshot> {
  console.log('\n[SETUP] Configurando estado pra smoke D2.1 v2');

  // 1. Cooperado SISGDSOLAR: ehEstabelecimento=false (smoke testa colaborador).
  const cooperado = await prisma.cooperado.findUnique({
    where: { id: COOPERADO_ID },
    select: { ehEstabelecimento: true, status: true, pixChave: true, pinHash: true },
  });
  if (!cooperado) throw new Error(`Cooperado ${COOPERADO_ID} nao encontrado (rode seed M40)`);
  if (cooperado.ehEstabelecimento) {
    fail('SISGDSOLAR está ehEstabelecimento=true — smoke testa colaborador comum');
    throw new Error('setup invalido');
  }
  if (!cooperado.pixChave) {
    fail('SISGDSOLAR sem pixChave — rode smoke-d2-saque-pix-colaborador.ts antes pra setup base');
    throw new Error('setup invalido');
  }
  if (!cooperado.pinHash) {
    fail('SISGDSOLAR sem pinHash — rode smoke-d2-saque-pix-colaborador.ts antes');
    throw new Error('setup invalido');
  }
  pass('SISGDSOLAR: ehEstabelecimento=false + pixChave + pinHash setados');

  // 2. Liga flag saqueColaboradorAtivo.
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
    pass('Cooperativa.saqueColaboradorAtivo=true (cleanup restaura)');
  } else {
    pass('Cooperativa.saqueColaboradorAtivo já era true');
  }
  if (process.env.AMBIENTE_REAL === 'true') {
    process.env.SAQUE_COLABORADOR_PRODUCAO_LIBERADO = 'true';
  }

  // 3. Saldo + ledger CooperToken (Salvaguarda 1 exige origem PERMITIDA).
  const saldo = await prisma.cooperTokenSaldo.upsert({
    where: { cooperadoId: COOPERADO_ID },
    create: {
      cooperadoId: COOPERADO_ID,
      cooperativaId: COOPEREBR_ID,
      saldoDisponivel: 10,
      saldoBloqueadoResgate: 0,
    },
    update: {},
  });
  const saldoInicialDisp = Number(saldo.saldoDisponivel);
  const saldoInicialBloq = Number(saldo.saldoBloqueadoResgate ?? 0);
  if (saldoInicialDisp < 5) {
    await prisma.cooperTokenSaldo.update({
      where: { cooperadoId: COOPERADO_ID },
      data: { saldoDisponivel: 10, saldoBloqueadoResgate: 0 },
    });
    pass(`Saldo bumped pra 10 tokens (era ${saldoInicialDisp})`);
  } else {
    pass(`Saldo SISGDSOLAR: disp=${saldoInicialDisp} bloq=${saldoInicialBloq}`);
  }

  // Insere DESCONTO_FATURA CREDITO pra Guard 1.5 deixar passar.
  let ledgerCreditoId: string | null = null;
  const ledgerExistente = await prisma.cooperTokenLedger.findFirst({
    where: {
      cooperadoId: COOPERADO_ID,
      cooperativaId: COOPEREBR_ID,
      tipo: 'DESCONTO_FATURA' as any,
      operacao: 'CREDITO' as any,
    },
  });
  if (!ledgerExistente) {
    const novo = await prisma.cooperTokenLedger.create({
      data: {
        cooperadoId: COOPERADO_ID,
        cooperativaId: COOPEREBR_ID,
        tipo: 'DESCONTO_FATURA' as any,
        operacao: 'CREDITO' as any,
        quantidade: 10,
        saldoApos: 10,
        descricao: 'smoke-d2-1: setup ledger origem PERMITIDA pro Guard 1.5',
      },
    });
    ledgerCreditoId = novo.id;
    pass(`Ledger DESCONTO_FATURA CREDITO=10 inserido (id=${novo.id.slice(0, 8)}…)`);
  } else {
    pass(`Ledger DESCONTO_FATURA CREDITO já existe (id=${ledgerExistente.id.slice(0, 8)}…)`);
  }

  // 4. Limpa recibos residuais HOJE.
  const inicioHoje = new Date();
  inicioHoje.setHours(0, 0, 0, 0);
  const residuais = await prisma.resgateRecibo.deleteMany({
    where: {
      cooperadoEstabelecimentoId: COOPERADO_ID,
      cooperativaId: COOPEREBR_ID,
      createdAt: { gte: inicioHoje },
    },
  });
  if (residuais.count > 0) pass(`Limpou ${residuais.count} recibo(s) residual(is) do dia`);

  // 5. Limpa override e versões novas globais residuais (idempotente, deixa só seed v1).
  await prisma.disclaimerSaque.updateMany({
    where: { cooperativaId: COOPEREBR_ID },
    data: { ativo: false },
  });
  const globaisAtivos = await prisma.disclaimerSaque.findMany({
    where: { cooperativaId: null, ativo: true },
    orderBy: { createdAt: 'asc' },
  });
  if (globaisAtivos.length > 1) {
    // Mantém só o mais antigo (seed v1) ativo, desativa os outros.
    const seedV1 = globaisAtivos[0];
    await prisma.disclaimerSaque.updateMany({
      where: { cooperativaId: null, ativo: true, id: { not: seedV1.id } },
      data: { ativo: false },
    });
    pass(`Pré-cleanup: ${globaisAtivos.length - 1} versões globais residuais desativadas`);
  }
  pass('Estado disclaimer pré-smoke: só seed v1 global ativo');

  return {
    saldoInicialDisp,
    saldoInicialBloq,
    flagTenantOriginal,
    ledgerCreditoId,
  };
}

async function cleanup(
  snap: SetupSnapshot,
  ctx: { reciboId: string | null; versoesCriadas: string[] },
) {
  console.log('\n[CLEANUP] Restaurando estado');

  // Desativa todas versões criadas no smoke (histórico preservado — só ativo=false).
  if (ctx.versoesCriadas.length > 0) {
    await prisma.disclaimerSaque.updateMany({
      where: { id: { in: ctx.versoesCriadas } },
      data: { ativo: false },
    });
    console.log(`  Desativou ${ctx.versoesCriadas.length} versão(ões) criada(s) no smoke (histórico mantido)`);
  }

  // Re-ativa seed v1 global (cleanup volta ao baseline).
  const seedV1 = await prisma.disclaimerSaque.findFirst({
    where: { cooperativaId: null },
    orderBy: { createdAt: 'asc' },
  });
  if (seedV1) {
    await prisma.disclaimerSaque.update({
      where: { id: seedV1.id },
      data: { ativo: true },
    });
    console.log(`  Seed v1 global re-ativado (${seedV1.id.slice(0, 8)}…)`);
  }

  // Deleta recibo + LancamentoCaixa
  if (ctx.reciboId) {
    await prisma.lancamentoCaixa.deleteMany({
      where: {
        cooperadoId: COOPERADO_ID,
        cooperativaId: COOPEREBR_ID,
        descricao: { contains: 'Resgate PIX' },
      },
    });
    await prisma.cooperTokenLedger.deleteMany({
      where: {
        cooperadoId: COOPERADO_ID,
        cooperativaId: COOPEREBR_ID,
        tipo: 'RESGATE_PIX' as any,
      },
    });
    await prisma.resgateRecibo.deleteMany({
      where: { id: ctx.reciboId },
    });
    console.log(`  Deletou recibo + ledger RESGATE_PIX + LancamentoCaixa`);
  }

  // Deleta ledger CREDITO inserido pelo smoke.
  if (snap.ledgerCreditoId) {
    await prisma.cooperTokenLedger.deleteMany({
      where: { id: snap.ledgerCreditoId },
    });
    console.log(`  Deletou ledger CREDITO setup`);
  }

  // Restaura saldo.
  await prisma.cooperTokenSaldo.update({
    where: { cooperadoId: COOPERADO_ID },
    data: {
      saldoDisponivel: snap.saldoInicialDisp,
      saldoBloqueadoResgate: snap.saldoInicialBloq,
    },
  });
  console.log(`  Saldo restaurado: disp=${snap.saldoInicialDisp} bloq=${snap.saldoInicialBloq}`);

  // Restaura flag tenant.
  if (!snap.flagTenantOriginal) {
    await prisma.cooperativa.update({
      where: { id: COOPEREBR_ID },
      data: { saqueColaboradorAtivo: false, saqueColaboradorAtivadoEm: null },
    });
    console.log(`  Flag saqueColaboradorAtivo restaurada pra false`);
  }
}

async function main() {
  const snap = await setup();
  const versoesCriadas: string[] = [];
  let reciboId: string | null = null;
  let globalV2Id: string | null = null;

  const tokenSuper = jwtFor(SUPER_ADMIN_ID, SUPER_ADMIN_EMAIL, 'SUPER_ADMIN', null);
  const tokenAdmin = jwtFor(ADMIN_ID, ADMIN_EMAIL, 'ADMIN', COOPEREBR_ID);
  const tokenCooperado = jwtFor(
    // userId vem do Usuario do cooperado (smoke M41 pattern).
    (
      await prisma.usuario.findUnique({
        where: { email: COOPERADO_EMAIL },
        select: { id: true },
      })
    )!.id,
    COOPERADO_EMAIL,
    'COOPERADO',
    COOPEREBR_ID,
    { cooperadoId: COOPERADO_ID },
  );

  try {
    // ─── PASSO 1: SUPER cria GLOBAL v2 ─────────────────────────────
    console.log('\n[PASSO 1] SUPER_ADMIN cria GLOBAL v2');
    const r1 = await call('POST', '/saas/disclaimer-saque/global', {
      token: tokenSuper,
      body: { texto: TEXTO_V2_GLOBAL },
    });
    if (r1.status !== 201) {
      fail(`POST global v2 status=${r1.status} body=${JSON.stringify(r1.json).slice(0, 200)}`);
      throw new Error('auth/endpoint travou em PASSO 1');
    }
    globalV2Id = r1.json.id;
    versoesCriadas.push(globalV2Id!);
    pass(`Global v2 criado: id=${globalV2Id!.slice(0, 8)}… versao=${r1.json.versao}`);

    // Confirma que v1 ficou ativo=false e v2 está ativo=true.
    const v1Check = await prisma.disclaimerSaque.findFirst({
      where: { cooperativaId: null, versao: { contains: 'v1-' } },
    });
    const v2Check = await prisma.disclaimerSaque.findUnique({ where: { id: globalV2Id! } });
    if (v1Check?.ativo === false && v2Check?.ativo === true) {
      pass('v1 desativada + v2 ativa (histórico imutável preservado)');
    } else {
      fail(`State inválido: v1.ativo=${v1Check?.ativo} v2.ativo=${v2Check?.ativo}`);
    }

    // ─── PASSO 2: Cooperado-comum aceita v2 + solicita saque ───────
    console.log('\n[PASSO 2] Cooperado-comum aceita FK v2 + solicita saque');
    const r2get = await call('GET', '/portal/disclaimer-saque', { token: tokenCooperado });
    if (r2get.status !== 200) {
      fail(`GET /portal/disclaimer-saque status=${r2get.status} body=${JSON.stringify(r2get.json).slice(0, 200)}`);
      throw new Error('auth/endpoint travou em PASSO 2 GET');
    }
    if (r2get.json.id !== globalV2Id) {
      fail(`Cooperado deveria ver v2 mas viu ${r2get.json.versao} (id=${r2get.json.id?.slice(0, 8)}…)`);
    } else {
      pass(`Cooperado vê v2 + origem=${r2get.json.origem}`);
    }
    if (r2get.json.origem !== 'GLOBAL') {
      fail(`Esperado origem=GLOBAL mas veio ${r2get.json.origem}`);
    }

    const clientReqId = `smoke-d2-1-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const r2post = await call('POST', '/cooper-token/empresa/resgatar', {
      token: tokenCooperado,
      body: {
        quantidade: 1,
        pin: '123456',
        clientRequestId: clientReqId,
        disclaimerAceito: true,
        disclaimerSaqueId: globalV2Id,
      },
    });
    if (r2post.status !== 200 && r2post.status !== 201) {
      fail(`POST resgatar status=${r2post.status} body=${JSON.stringify(r2post.json).slice(0, 300)}`);
      throw new Error('auth/endpoint travou em PASSO 2 POST');
    }
    reciboId = r2post.json.recibo?.id ?? null;
    if (!reciboId) {
      fail('Recibo não retornado no POST');
    } else {
      pass(`Recibo criado: ${r2post.json.recibo.numeroRecibo} (id=${reciboId.slice(0, 8)}…)`);
    }

    // Confirma FK gravada.
    const reciboCheck = await prisma.resgateRecibo.findUnique({
      where: { id: reciboId! },
      select: { disclaimerSaqueId: true, disclaimerVersao: true, disclaimerAceitoEm: true, disclaimerAceiteIp: true },
    });
    if (reciboCheck?.disclaimerSaqueId === globalV2Id) {
      pass(`Recibo grava FK disclaimerSaqueId=${globalV2Id!.slice(0, 8)}… + versão snapshot=${reciboCheck.disclaimerVersao}`);
    } else {
      fail(`FK não gravada: ${reciboCheck?.disclaimerSaqueId}`);
    }
    if (reciboCheck?.disclaimerAceitoEm) {
      pass(`disclaimerAceitoEm gravado: ${reciboCheck.disclaimerAceitoEm.toISOString()}`);
    } else {
      fail('disclaimerAceitoEm não gravado');
    }
    if (reciboCheck?.disclaimerAceiteIp) {
      pass(`disclaimerAceiteIp gravado (forense): ${reciboCheck.disclaimerAceiteIp}`);
    } else {
      fail('disclaimerAceiteIp não gravado');
    }

    // ─── PASSO 3: ADMIN cria OVERRIDE tenant-v1 ────────────────────
    console.log('\n[PASSO 3] ADMIN CoopereBR cria OVERRIDE tenant-v1');
    const r3 = await call('POST', '/cooperativa/disclaimer-saque', {
      token: tokenAdmin,
      body: { texto: TEXTO_TENANT_V1 },
    });
    if (r3.status !== 201) {
      fail(`POST tenant status=${r3.status} body=${JSON.stringify(r3.json).slice(0, 200)}`);
      throw new Error('auth/endpoint travou em PASSO 3');
    }
    const tenantV1Id = r3.json.id;
    versoesCriadas.push(tenantV1Id);
    pass(`Tenant override criado: id=${tenantV1Id.slice(0, 8)}… versao=${r3.json.versao} perfil=${r3.json.criadoPorPerfil}`);
    if (r3.json.criadoPorPerfil !== 'ADMIN') {
      fail(`Esperado criadoPorPerfil=ADMIN mas veio ${r3.json.criadoPorPerfil}`);
    }

    // ─── PASSO 4: Cooperado recarrega → vê override ────────────────
    console.log('\n[PASSO 4] Cooperado-comum recarrega → vê override tenant-v1');
    const r4 = await call('GET', '/portal/disclaimer-saque', { token: tokenCooperado });
    if (r4.json.id === tenantV1Id && r4.json.origem === 'TENANT') {
      pass(`Cooperado vê tenant-v1 + origem=TENANT (override prevalece)`);
    } else {
      fail(`Esperado tenant-v1 mas veio id=${r4.json.id?.slice(0, 8)}… origem=${r4.json.origem}`);
    }

    // ─── PASSO 5: SUPER cria GLOBAL v3 → cooperado da CoopereBR NÃO afetado ──
    console.log('\n[PASSO 5] SUPER cria GLOBAL v3 → cooperado com override NÃO afetado');
    const r5 = await call('POST', '/saas/disclaimer-saque/global', {
      token: tokenSuper,
      body: { texto: TEXTO_V3_GLOBAL },
    });
    if (r5.status !== 201) {
      fail(`POST global v3 status=${r5.status}`);
      throw new Error('travou em PASSO 5');
    }
    const globalV3Id = r5.json.id;
    versoesCriadas.push(globalV3Id);
    pass(`Global v3 criado: id=${globalV3Id.slice(0, 8)}… versao=${r5.json.versao}`);

    const r5cooperado = await call('GET', '/portal/disclaimer-saque', { token: tokenCooperado });
    if (r5cooperado.json.id === tenantV1Id && r5cooperado.json.origem === 'TENANT') {
      pass(`Cooperado AINDA vê tenant-v1 (override prevalece sobre global v3)`);
    } else {
      fail(`Vazamento! Cooperado deveria continuar em tenant-v1 mas viu ${r5cooperado.json.versao}`);
    }

    // ─── PASSO 6: ADMIN desativa override → cooperado vê global v3 ──
    console.log('\n[PASSO 6] ADMIN desativa override → cooperado volta a ver global v3');
    const r6del = await call('DELETE', '/cooperativa/disclaimer-saque/ativo', { token: tokenAdmin });
    if (r6del.status !== 200) {
      fail(`DELETE override status=${r6del.status} body=${JSON.stringify(r6del.json).slice(0, 200)}`);
      throw new Error('travou em PASSO 6');
    }
    pass(`Override desativado: ${JSON.stringify(r6del.json)}`);

    const r6cooperado = await call('GET', '/portal/disclaimer-saque', { token: tokenCooperado });
    if (r6cooperado.json.id === globalV3Id && r6cooperado.json.origem === 'GLOBAL') {
      pass(`Cooperado volta a ver global v3 + origem=GLOBAL`);
    } else {
      fail(`Esperado global v3 mas viu id=${r6cooperado.json.id?.slice(0, 8)}… origem=${r6cooperado.json.origem}`);
    }

    // Confirma histórico tenant preservado (ativo=false NUNCA delete).
    const tenantV1Persist = await prisma.disclaimerSaque.findUnique({ where: { id: tenantV1Id } });
    if (tenantV1Persist && tenantV1Persist.ativo === false && tenantV1Persist.texto === TEXTO_TENANT_V1) {
      pass(`Histórico tenant-v1 preservado (ativo=false, texto íntegro) — anti-deleção respeitada`);
    } else {
      fail(`Histórico tenant-v1 PERDIDO ou corrompido!`);
    }

    // ─── PASSO 7: FK STALE → BadRequest ────────────────────────────
    console.log('\n[PASSO 7] Tentativa de saque com FK STALE (id v2 antigo) → BadRequest');
    const r7 = await call('POST', '/cooper-token/empresa/resgatar', {
      token: tokenCooperado,
      body: {
        quantidade: 1,
        pin: '123456',
        clientRequestId: `smoke-d2-1-stale-${Date.now()}`,
        disclaimerAceito: true,
        disclaimerSaqueId: globalV2Id, // STALE — v3 é o ativo agora
      },
    });
    if (r7.status === 400) {
      const msg: string = r7.json.message ?? '';
      if (/desatualizado|Recarregue/i.test(msg)) {
        pass(`BadRequest com mensagem anti-staleness: "${msg.slice(0, 80)}…"`);
      } else {
        fail(`BadRequest mas mensagem errada: "${msg.slice(0, 100)}"`);
      }
    } else {
      fail(`Esperado 400 mas veio status=${r7.status} body=${JSON.stringify(r7.json).slice(0, 200)}`);
    }

    // ─── PASSO 8: Recibo da etapa 2 recupera texto v2 via FK ─────
    console.log('\n[PASSO 8] Recibo da etapa 2 recupera texto v2 via FK (rastro jurídico imutável)');
    const reciboAntigo = await prisma.resgateRecibo.findUnique({
      where: { id: reciboId! },
      select: {
        disclaimerSaqueId: true,
        disclaimerVersao: true,
        disclaimerSaque: { select: { id: true, versao: true, texto: true, ativo: true } },
      },
    });
    if (!reciboAntigo?.disclaimerSaque) {
      fail('Recibo NÃO conseguiu joinar com DisclaimerSaque via FK');
    } else if (reciboAntigo.disclaimerSaque.texto === TEXTO_V2_GLOBAL) {
      pass(`Recibo recupera texto EXATO da v2 via FK (mesmo com v2.ativo=${reciboAntigo.disclaimerSaque.ativo} agora)`);
      pass(`  versão snapshot no recibo: ${reciboAntigo.disclaimerVersao}`);
      pass(`  FK aponta pra: ${reciboAntigo.disclaimerSaque.id.slice(0, 8)}… (= v2 original)`);
    } else {
      fail(`Texto recuperado != v2 publicado: "${reciboAntigo.disclaimerSaque.texto.slice(0, 60)}…"`);
    }
  } catch (e: any) {
    console.error('\n[ERRO FATAL]', e?.message ?? e);
    failCount++;
  } finally {
    await cleanup(snap, { reciboId, versoesCriadas });
    await prisma.$disconnect();
  }

  console.log('\n═══════════════════════════════════════════════════');
  console.log(`Resultado: ${passCount} PASS / ${failCount} FAIL`);
  console.log('═══════════════════════════════════════════════════');
  process.exit(failCount > 0 ? 1 : 0);
}

main();
