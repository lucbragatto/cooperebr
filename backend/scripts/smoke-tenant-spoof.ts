/**
 * Smoke E2E — Sprint Hardening Tenant-Spoof (20/06/2026).
 *
 * Valida 3 cenários core ponta-a-ponta contra localhost:3000:
 *
 *  1. ADMIN cria cooperado com body.cooperativaId='tenant-B-MALICIOSO' →
 *     cooperado é criado no tenant do JWT (tenant-A); body é descartado.
 *  2. SUPER_ADMIN cria cooperado com body.cooperativaIdAlvo='<outro>' →
 *     cooperado é criado em <outro> (caminho cross-tenant explícito).
 *  3. Cadastro público /publico/cadastro-sem-uc com ?tenant=<id-fake> →
 *     404 NotFoundException (cooperativa não existe).
 *  4. Cadastro público /publico/convenios-pagador-empresa com ?tenant=<fake>
 *     → 404 (não vaza silencioso).
 *
 * Cleanup ao final: deleta cooperados smoke criados (idempotente).
 *
 * Setup: precisa do JWT_SECRET no .env + Cooperativa CoopereBR existente.
 */
import { PrismaClient } from '@prisma/client';
import * as jwt from 'jsonwebtoken';
import * as dotenv from 'dotenv';
import * as path from 'node:path';

dotenv.config({ path: path.resolve(__dirname, '..', '.env') });

if (process.env.NODE_ENV === 'production' && process.env.SMOKE_FORCE_PROD !== 'true') {
  console.error('[ABORT] Smoke não deve rodar em produção sem SMOKE_FORCE_PROD=true');
  process.exit(1);
}

const API = process.env.API ?? 'http://localhost:3000';
const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET) {
  console.error('JWT_SECRET nao encontrado no .env — abort');
  process.exit(1);
}

const COOPEREBR_ID = 'cmn0ho8bx0000uox8wu96u6fd';

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
  try { json = JSON.parse(text); } catch { json = text; }
  return { status: res.status, json };
}

function jwtAdmin(usuarioId: string, cooperativaId: string) {
  return jwt.sign(
    { sub: usuarioId, email: 'smoke-admin@test.com', perfil: 'ADMIN', cooperativaId },
    JWT_SECRET!,
    { expiresIn: '1h' },
  );
}

function jwtSuperAdmin(usuarioId: string) {
  return jwt.sign(
    { sub: usuarioId, email: 'smoke-sa@test.com', perfil: 'SUPER_ADMIN' },
    JWT_SECRET!,
    { expiresIn: '1h' },
  );
}

const CPF_C1 = '90011122233';
const CPF_C2 = '90011122244';
const EMAIL_C1 = 'lucbragatto+smoke-spoof-c1@gmail.com';
const EMAIL_C2 = 'lucbragatto+smoke-spoof-c2@gmail.com';
const SMOKE_INICIO = new Date();

async function cleanup() {
  console.log('\n[CLEANUP] Restaurando estado');
  const r = await prisma.cooperado.deleteMany({
    where: {
      OR: [
        { cpf: CPF_C1 }, { cpf: CPF_C2 },
        { email: EMAIL_C1 }, { email: EMAIL_C2 },
      ],
      createdAt: { gte: SMOKE_INICIO },
    },
  });
  console.log(`  Limpou ${r.count} cooperado(s) smoke`);
}

async function main() {
  await cleanup();

  const usuarioAdmin = await prisma.usuario.findFirst({
    where: { cooperativaId: COOPEREBR_ID, perfil: 'ADMIN' },
    select: { id: true },
  });
  if (!usuarioAdmin) { fail('Usuário ADMIN da CoopereBR não encontrado'); await cleanup(); return; }
  const tokenAdmin = jwtAdmin(usuarioAdmin.id, COOPEREBR_ID);

  const usuarioSa = await prisma.usuario.findFirst({
    where: { perfil: 'SUPER_ADMIN' },
    select: { id: true },
  });

  // Segundo tenant qualquer (não-CoopereBR) pra cenário 2.
  const outraCoop = await prisma.cooperativa.findFirst({
    where: { id: { not: COOPEREBR_ID }, ativo: true },
    select: { id: true, nome: true },
  });

  // ─── Cenário 1: ADMIN tenta cross-tenant via body — IGNORADO ───
  console.log('\n[C1] ADMIN cria cooperado com body.cooperativaId malicioso');
  const r1 = await call('POST', '/cooperados', {
    token: tokenAdmin,
    body: {
      nomeCompleto: 'SmokeSpoof C1',
      cpf: CPF_C1,
      email: EMAIL_C1,
      cooperativaId: 'tenant-B-MALICIOSO',
      ambienteTeste: true,
    },
  });
  if (r1.status === 201 || r1.status === 200) {
    const c = await prisma.cooperado.findFirst({ where: { cpf: CPF_C1 }, select: { cooperativaId: true } });
    if (c?.cooperativaId === COOPEREBR_ID) {
      pass(`Cooperado criado no tenant do JWT (CoopereBR), body descartado`);
    } else {
      fail(`Cooperado criado em ${c?.cooperativaId} — esperava CoopereBR`);
    }
  } else {
    fail(`POST /cooperados retornou ${r1.status}: ${JSON.stringify(r1.json).slice(0, 200)}`);
  }

  // ─── Cenário 2: SUPER_ADMIN cross-tenant via cooperativaIdAlvo ───
  console.log('\n[C2] SUPER_ADMIN cria cooperado cross-tenant via cooperativaIdAlvo');
  if (!usuarioSa) {
    console.log('  ⊘ Pulado — nenhum SUPER_ADMIN no banco');
  } else if (!outraCoop) {
    console.log('  ⊘ Pulado — só CoopereBR existe no banco');
  } else {
    const tokenSa = jwtSuperAdmin(usuarioSa.id);
    const r2 = await call('POST', '/cooperados', {
      token: tokenSa,
      body: {
        nomeCompleto: 'SmokeSpoof C2 (SA)',
        cpf: CPF_C2,
        email: EMAIL_C2,
        cooperativaIdAlvo: outraCoop.id,
        ambienteTeste: true,
      },
    });
    if (r2.status === 201 || r2.status === 200) {
      const c = await prisma.cooperado.findFirst({ where: { cpf: CPF_C2 }, select: { cooperativaId: true } });
      if (c?.cooperativaId === outraCoop.id) {
        pass(`SA criou cross-tenant em ${outraCoop.nome} via cooperativaIdAlvo`);
      } else {
        fail(`Cooperado SA criado em ${c?.cooperativaId} — esperava ${outraCoop.id}`);
      }
    } else {
      fail(`SA POST /cooperados retornou ${r2.status}: ${JSON.stringify(r2.json).slice(0, 200)}`);
    }
  }

  // ─── Cenário 3: público /cadastro-sem-uc com ?tenant=fake → 404 ─
  console.log('\n[C3] /publico/cadastro-sem-uc ?tenant=<id-fake> → 404');
  const r3 = await call('POST', '/publico/cadastro-sem-uc?tenant=ckXXXXX-fake-tenant-id', {
    body: { nome: 'Fake', cpf: '00011122233', email: 'fake@example.com', tipoPessoa: 'PF' },
  });
  if (r3.status === 404) {
    pass(`Tenant fake → 404 (não vaza silencioso)`);
  } else {
    fail(`Esperava 404, recebido ${r3.status}: ${JSON.stringify(r3.json).slice(0, 150)}`);
  }

  // ─── Cenário 4: /convenios-pagador-empresa ?tenant=fake → 404 ───
  console.log('\n[C4] /publico/convenios-pagador-empresa ?tenant=<fake> → 404');
  const r4 = await call('GET', '/publico/convenios-pagador-empresa?tenant=ckXXXXX-fake-tenant-id');
  if (r4.status === 404) {
    pass(`Tenant fake → 404 (sem enumeração silenciosa)`);
  } else {
    fail(`Esperava 404, recebido ${r4.status}: ${JSON.stringify(r4.json).slice(0, 150)}`);
  }

  // ─── Cenário 5: /convenios-pagador-empresa ?tenant=<real> → 200 ──
  console.log('\n[C5] /publico/convenios-pagador-empresa ?tenant=<real> → 200');
  const r5 = await call('GET', `/publico/convenios-pagador-empresa?tenant=${COOPEREBR_ID}`);
  if (r5.status === 200) {
    pass(`Tenant válido → 200 + lista (${Array.isArray(r5.json) ? r5.json.length : '?'} convênios)`);
  } else {
    fail(`Esperava 200, recebido ${r5.status}: ${JSON.stringify(r5.json).slice(0, 150)}`);
  }

  await cleanup();

  console.log(`\n[RESUMO] ${passCount} pass / ${failCount} fail`);
  process.exit(failCount > 0 ? 1 : 0);
}

main().catch(async (e) => {
  console.error('[ERRO FATAL]', e);
  await cleanup();
  process.exit(1);
});
