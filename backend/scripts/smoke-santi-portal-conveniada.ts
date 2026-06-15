/**
 * Smoke E2E Track B.2 — portal do conveniado lista convênios da empresa.
 *
 * Antes (main): GET /convenios/meus retornaria [] porque o filtro era
 * `conveniadoId: cooperadoId` (legado, null em convênios D-FISCAL-2.4.1).
 *
 * Pós-fix (Track B.2): OR `[{conveniadoId}, {pagadorCooperadoId}]` + filtro
 * `cooperativaId` explícito (anti-IDOR cross-tenant).
 *
 * Cenário 1 — JWT Santi empresa_conveniada → /convenios/meus
 *   esperado: 1 convênio (CV-2026-0001 Clínica teste)
 *
 * Cenário 2 — /convenios/meus/:id/dashboard com convenioId real
 *   esperado: dashboard carregado
 *
 * Cenário 3 (anti-IDOR) — mesmo JWT tentando convenioId fictício de outro
 *   tenant: 404 (sem vazar existência)
 */
import { PrismaClient } from '@prisma/client';
import * as jwt from 'jsonwebtoken';

const CONVENIO_ID = 'cmpwof5h6000avaf8547cj3pb';
const COOPERADO_PAGADOR_ID = 'cmpwnuid50006vaf8th51y2s7';
const COOPERATIVA_ID = 'cmn0ho8bx0000uox8wu96u6fd';
const BACKEND_URL = 'http://localhost:3000';

async function main() {
  const prisma = new PrismaClient();
  const usuario = await prisma.usuario.findFirst({
    where: { email: 'lucbragatto+empresa-teste@gmail.com' },
    select: { id: true, email: true, perfil: true },
  });
  if (!usuario) throw new Error('Usuario Santi nao encontrado.');
  await prisma.$disconnect();

  const JWT_SECRET = process.env.JWT_SECRET;
  if (!JWT_SECRET) throw new Error('JWT_SECRET nao configurado.');

  const token = jwt.sign(
    {
      sub: usuario.id,
      email: usuario.email,
      perfil: usuario.perfil,
      cooperadoId: COOPERADO_PAGADOR_ID,
      cooperativaId: COOPERATIVA_ID,
    },
    JWT_SECRET,
    { expiresIn: '15m' },
  );
  console.log(`JWT empresa_conveniada gerado pra Santi (${usuario.email}).\n`);

  // ─── Cenario 1 — listar meus convenios ───
  console.log('═══ Cenario 1 — GET /convenios/meus ═══');
  const r1 = await fetch(`${BACKEND_URL}/convenios/meus`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const list = await r1.json();
  console.log(`HTTP ${r1.status}`);
  if (r1.status !== 200) {
    console.log('❌ FALHOU:', JSON.stringify(list, null, 2));
    process.exit(1);
  }
  if (!Array.isArray(list) || list.length === 0) {
    console.log('❌ FALHOU: lista vazia (bug ainda persiste).');
    console.log(JSON.stringify(list, null, 2));
    process.exit(1);
  }
  console.log(`✅ PASS — ${list.length} convenio(s) encontrado(s):`);
  for (const c of list) {
    console.log(`   ${c.numero} — ${c.empresaNome} (status=${c.status})`);
  }

  const meuConv = list.find((c: any) => c.id === CONVENIO_ID);
  if (!meuConv) {
    console.log(`❌ FALHOU: convenio alvo ${CONVENIO_ID} nao apareceu na lista.`);
    process.exit(1);
  }
  console.log(`   → CV-2026-0001 alvo PRESENTE.\n`);

  // ─── Cenario 2 — dashboard do convenio ───
  console.log('═══ Cenario 2 — GET /convenios/meus/:id/dashboard ═══');
  const r2 = await fetch(`${BACKEND_URL}/convenios/meus/${CONVENIO_ID}/dashboard`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const dash = await r2.json();
  console.log(`HTTP ${r2.status}`);
  if (r2.status !== 200) {
    console.log('❌ FALHOU:', JSON.stringify(dash, null, 2));
    process.exit(1);
  }
  console.log(`✅ PASS — dashboard carregado:`);
  console.log(`   numero=${dash.convenio?.numero ?? dash.numero}`);
  console.log(`   empresa=${dash.convenio?.empresaNome ?? dash.empresaNome}`);
  console.log(`   membros ativos=${dash.cooperados?.length ?? 0}\n`);

  // ─── Cenario 3 — anti-IDOR (convenioId ficticio de outro tenant) ───
  console.log('═══ Cenario 3 — Anti-IDOR (convenioId ficticio) ═══');
  const r3 = await fetch(`${BACKEND_URL}/convenios/meus/aaa-ficticio-id-xxx/dashboard`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const err3 = await r3.json();
  console.log(`HTTP ${r3.status}`);
  if (r3.status === 404 || r3.status === 400) {
    console.log(`✅ PASS — bloqueado (${err3.message}).`);
  } else {
    console.log('❌ FALHOU: deveria ser 404, mas:', JSON.stringify(err3, null, 2));
    process.exit(1);
  }

  console.log('\n═══ Smoke COMPLETO — Track B.2 portal validado ═══');
}

main().catch(e => {
  console.error('ERRO:', e);
  process.exit(1);
});
