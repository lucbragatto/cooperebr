/**
 * Smoke C.4 — cadastro SEM_UC via 2 caminhos:
 *  1. POST /cooperados (admin com JWT) com tipoCooperado=SEM_UC
 *  2. POST /publico/cadastro-sem-uc (público, sem JWT)
 *
 * Limpa registros criados ao fim.
 */
import { PrismaClient } from '@prisma/client';
import * as jwt from 'jsonwebtoken';
const prisma = new PrismaClient();

const BASE = 'http://localhost:3000';
const SUFFIX = Date.now().toString().slice(-6);

async function main() {
  console.log('═══ Smoke C.4 — Cadastro SEM_UC E2E ═══\n');

  // Pré: tenant + admin
  const coopBR = await prisma.cooperativa.findFirst({
    where: { nome: 'CoopereBR' },
    select: { id: true },
  });
  if (!coopBR) throw new Error('CoopereBR não encontrada');

  const adminA = await prisma.usuario.findFirst({
    where: { perfil: 'ADMIN', cooperativaId: coopBR.id },
    select: { id: true, email: true, perfil: true },
  });
  if (!adminA) throw new Error('Admin CoopereBR não encontrado');
  const token = jwt.sign(
    { sub: adminA.id, userId: adminA.id, id: adminA.id, email: adminA.email, perfil: adminA.perfil, cooperativaId: coopBR.id },
    process.env.JWT_SECRET!,
    { expiresIn: '5m' },
  );

  // ─── Caso 1: admin POST /cooperados ─────────────────────────
  console.log('1. Admin POST /cooperados (SEM_UC):');
  const cpf1 = `9999${SUFFIX}0`;
  const r1 = await fetch(`${BASE}/cooperados`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({
      nomeCompleto: `Indicador Puro Admin ${SUFFIX}`,
      cpf: cpf1,
      email: `lucbragatto+semuc-admin-${SUFFIX}@gmail.com`,
      telefone: '27981341348',
      tipoPessoa: 'PF',
      tipoCooperado: 'SEM_UC',
      status: 'ATIVO',
    }),
  });
  const j1 = await r1.json();
  console.log(`  HTTP ${r1.status}`);
  console.log('  ', j1);
  if (r1.status !== 201 && r1.status !== 200) throw new Error('Caso 1 falhou');

  // ─── Caso 2: público POST /publico/cadastro-sem-uc ─────────
  console.log('\n2. Público POST /publico/cadastro-sem-uc (SEM_UC):');
  const cpf2 = `9999${SUFFIX}1`;
  const r2 = await fetch(`${BASE}/publico/cadastro-sem-uc?tenant=${coopBR.id}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      nome: `Indicador Puro Publico ${SUFFIX}`,
      cpf: cpf2,
      email: `lucbragatto+semuc-pub-${SUFFIX}@gmail.com`,
      telefone: '27981341348',
      tipoPessoa: 'PF',
    }),
  });
  const j2 = await r2.json();
  console.log(`  HTTP ${r2.status}`);
  console.log('  ', j2);
  if (r2.status !== 201 && r2.status !== 200) throw new Error('Caso 2 falhou');

  // ─── Validação SELECT no banco ──────────────────────────────
  console.log('\n3. SELECT cooperados criados:');
  const criados = await prisma.cooperado.findMany({
    where: { cpf: { in: [cpf1, cpf2] } },
    select: { id: true, nomeCompleto: true, cpf: true, tipoCooperado: true, status: true, modoRemuneracao: true, cooperativaId: true,
      ucs: { select: { id: true } },
      contratos: { select: { id: true } },
    },
  });
  console.table(criados.map(c => ({
    id: c.id.slice(0, 12) + '…',
    nome: c.nomeCompleto,
    cpf: c.cpf,
    tipo: c.tipoCooperado,
    status: c.status,
    modo: c.modoRemuneracao,
    ucs: c.ucs.length,
    contratos: c.contratos.length,
  })));

  // Validações
  let pass = 0, fail = 0;
  for (const c of criados) {
    if (c.tipoCooperado === 'SEM_UC') pass++; else { fail++; console.log(`  ❌ ${c.id} tipoCooperado=${c.tipoCooperado} (esperado SEM_UC)`); }
    if (c.ucs.length === 0) pass++; else { fail++; console.log(`  ❌ ${c.id} tem UC (esperado 0)`); }
    if (c.contratos.length === 0) pass++; else { fail++; console.log(`  ❌ ${c.id} tem contrato (esperado 0)`); }
  }
  console.log(`\n${pass} PASS / ${fail} FAIL`);

  // ─── Cleanup ────────────────────────────────────────────────
  console.log('\n4. Cleanup (remove os 2 cooperados smoke):');
  const del = await prisma.cooperado.deleteMany({
    where: { cpf: { in: [cpf1, cpf2] } },
  });
  console.log(`  → ${del.count} cooperados removidos`);

  if (fail > 0) process.exit(1);
  console.log('\n✅ Smoke C.4 OK');
}

main().catch(e => { console.error(e); process.exit(1); }).finally(() => prisma.$disconnect());
