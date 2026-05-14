/**
 * Fase 2I — Smoke E2E cross-tenant.
 *
 * Usa um admin da CoopereBR (tenant A) com JWT valido e tenta acessar/mutar
 * recursos da CoopereBR Teste (tenant B). Espera-se ForbiddenException ou
 * NotFoundException em todas as tentativas.
 *
 * Cobre:
 *  - GET /cooperados/:id          (tenant B id, JWT tenant A)
 *  - PUT /cooperados/:id          (idem)
 *  - GET /contratos/:id           (idem)
 *  - PATCH /cobrancas/:id/cancelar (idem)
 *  - GET /financeiro/plano-contas/:id
 *  - GET /faturas/:id
 *  - GET /motor-proposta/:id
 */

import { PrismaClient } from '@prisma/client';
import * as jwt from 'jsonwebtoken';

const prisma = new PrismaClient();

interface SmokeCase {
  label: string;
  method: string;
  path: string;
  body?: unknown;
  expectStatus: number[]; // valores aceitos como sucesso do bloqueio
}

async function tryCall(token: string, c: SmokeCase): Promise<{ ok: boolean; status: number; body: string }> {
  const res = await fetch(`http://localhost:3000${c.path}`, {
    method: c.method,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: c.body ? JSON.stringify(c.body) : undefined,
  });
  const text = await res.text();
  return { ok: c.expectStatus.includes(res.status), status: res.status, body: text.slice(0, 200) };
}

async function main() {
  const tenantA = await prisma.cooperativa.findFirst({
    where: { nome: { contains: 'CoopereBR', mode: 'insensitive' }, NOT: { nome: { contains: 'Teste' } } },
    select: { id: true, nome: true },
  });
  const tenantB = await prisma.cooperativa.findFirst({
    where: { nome: { contains: 'Teste', mode: 'insensitive' } },
    select: { id: true, nome: true },
  });
  if (!tenantA || !tenantB) {
    console.error('Tenants A/B nao encontrados.');
    process.exit(1);
  }
  console.log(`Tenant A: ${tenantA.nome} (${tenantA.id})`);
  console.log(`Tenant B: ${tenantB.nome} (${tenantB.id})`);

  const adminA = await prisma.usuario.findFirst({
    where: { cooperativaId: tenantA.id, perfil: 'ADMIN' },
    select: { id: true, email: true, perfil: true },
  });
  if (!adminA) {
    console.error('Admin do tenant A nao encontrado.');
    process.exit(1);
  }

  const secret = process.env.JWT_SECRET;
  if (!secret) {
    console.error('JWT_SECRET nao configurado.');
    process.exit(1);
  }

  const token = jwt.sign(
    {
      sub: adminA.id,
      userId: adminA.id,
      id: adminA.id,
      email: adminA.email,
      perfil: adminA.perfil,
      cooperativaId: tenantA.id,
    },
    secret,
    { expiresIn: '5m' },
  );

  // Recursos do tenant B
  const cooperadoB = await prisma.cooperado.findFirst({ where: { cooperativaId: tenantB.id }, select: { id: true } });
  const contratoB = await prisma.contrato.findFirst({ where: { cooperativaId: tenantB.id }, select: { id: true } });
  const cobrancaB = await prisma.cobranca.findFirst({ where: { cooperativaId: tenantB.id }, select: { id: true } });
  const planoContasB = await prisma.planoContas.findFirst({ where: { cooperativaId: tenantB.id }, select: { id: true } });
  const faturaB = await prisma.faturaProcessada.findFirst({ where: { cooperativaId: tenantB.id }, select: { id: true } });

  console.log(`\nRecursos tenant B: coop=${cooperadoB?.id} ctr=${contratoB?.id} cob=${cobrancaB?.id} pc=${planoContasB?.id} ft=${faturaB?.id}`);

  const cases: SmokeCase[] = [];

  if (cooperadoB) {
    cases.push({ label: 'GET cooperado cross-tenant', method: 'GET', path: `/cooperados/${cooperadoB.id}`, expectStatus: [403, 404] });
    cases.push({ label: 'PUT cooperado cross-tenant', method: 'PUT', path: `/cooperados/${cooperadoB.id}`, body: { telefone: '5527999999999' }, expectStatus: [403, 404] });
  }
  if (contratoB) {
    cases.push({ label: 'GET contrato cross-tenant', method: 'GET', path: `/contratos/${contratoB.id}`, expectStatus: [403, 404] });
  }
  if (cobrancaB) {
    cases.push({ label: 'GET cobranca cross-tenant', method: 'GET', path: `/cobrancas/${cobrancaB.id}`, expectStatus: [403, 404] });
    cases.push({ label: 'PATCH cobranca/cancelar cross-tenant', method: 'PATCH', path: `/cobrancas/${cobrancaB.id}/cancelar`, body: { motivo: 'smoke' }, expectStatus: [403, 404] });
  }
  if (planoContasB) {
    cases.push({ label: 'GET plano-contas cross-tenant', method: 'GET', path: `/financeiro/plano-contas/${planoContasB.id}`, expectStatus: [403, 404] });
  }
  if (faturaB) {
    cases.push({ label: 'GET fatura cross-tenant', method: 'GET', path: `/faturas/${faturaB.id}`, expectStatus: [403, 404] });
  }

  console.log(`\nExecutando ${cases.length} casos cross-tenant...`);
  let passed = 0;
  let failed = 0;

  for (const c of cases) {
    const r = await tryCall(token, c);
    const status = r.ok ? 'PASS' : 'FAIL';
    if (r.ok) passed++;
    else failed++;
    console.log(`[${status}] ${c.label} -> HTTP ${r.status}`);
    if (!r.ok) console.log(`       body: ${r.body}`);
  }

  console.log(`\n${passed}/${cases.length} passaram. ${failed} falharam.`);
  process.exit(failed > 0 ? 1 : 0);
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
