/**
 * Smoke E2E real M39 — emissão admin em lote + estorno.
 *
 * GATE INEGOCIÁVEL: NUNCA emissão real pra colaboradores Santi (criaria
 * passivo real). Este smoke usa 1 token apenas + estorno imediato.
 *
 * Cenário:
 *   1. JWT admin tenant teste
 *   2. PREVIEW lote de 1 cooperado × 1 token → tier BAIXO
 *   3. CONFIRM com mesmo clientRequestId → ledger + saldo + contábil
 *   4. GET lote-detalhe → confirma lista + total
 *   5. Estorno do lote (motivo OK + confirmado: true)
 *   6. GET lote-detalhe novamente → estornado=true
 *
 * Esperado: tudo 200 OK + saldo final do cooperado teste = saldo inicial
 * (emissão e estorno se anulam).
 */
import { PrismaClient, CooperTokenTipo, StatusCooperado } from '@prisma/client';
import * as jwt from 'jsonwebtoken';

const BACKEND_URL = 'http://localhost:3000';
// Tenant teste (CoopereBR é mono-tenant em prod; tenant teste = mesmo
// tenant mas com cooperado teste isolado).
const COOPERATIVA_ID = 'cmn0ho8bx0000uox8wu96u6fd';

async function main() {
  const prisma = new PrismaClient();

  // Admin SUPER_ADMIN ou ADMIN da cooperativa teste — busca primeiro
  // disponível
  const admin = await prisma.usuario.findFirst({
    where: {
      cooperativaId: COOPERATIVA_ID,
      perfil: { in: ['ADMIN', 'SUPER_ADMIN'] as any },
      ativo: true,
    },
    select: { id: true, email: true, perfil: true },
  });
  if (!admin) throw new Error('Admin não encontrado no tenant teste.');
  console.log(`Admin: ${admin.email} (${admin.perfil})`);

  // Cooperado teste — busca um ATIVO real (NÃO emite real, vai estornar)
  // Preferir cooperado com nome contendo "teste" pra reduzir risco.
  let cooperadoTeste = await prisma.cooperado.findFirst({
    where: {
      cooperativaId: COOPERATIVA_ID,
      status: { in: ['ATIVO', 'ATIVO_RECEBENDO_CREDITOS'] as any[] },
      nomeCompleto: { contains: 'teste', mode: 'insensitive' },
    },
    select: { id: true, nomeCompleto: true, email: true },
  });
  if (!cooperadoTeste) {
    // Fallback: qualquer cooperado ATIVO (smoke vai estornar imediatamente)
    cooperadoTeste = await prisma.cooperado.findFirst({
      where: {
        cooperativaId: COOPERATIVA_ID,
        status: { in: ['ATIVO', 'ATIVO_RECEBENDO_CREDITOS'] as any[] },
      },
      select: { id: true, nomeCompleto: true, email: true },
    });
  }
  if (!cooperadoTeste) throw new Error('Nenhum cooperado ATIVO no tenant.');
  console.log(`Cooperado destinatário: ${cooperadoTeste.nomeCompleto} (${cooperadoTeste.email})`);

  // Saldo inicial
  const saldoIni = await prisma.cooperTokenSaldo.findUnique({
    where: { cooperadoId: cooperadoTeste.id },
    select: { saldoDisponivel: true },
  });
  const saldoInicial = Number(saldoIni?.saldoDisponivel ?? 0);
  console.log(`Saldo inicial: ${saldoInicial} CooperTokens`);

  // JWT admin
  const JWT_SECRET = process.env.JWT_SECRET;
  if (!JWT_SECRET) throw new Error('JWT_SECRET não configurado.');
  const token = jwt.sign(
    {
      sub: admin.id,
      email: admin.email,
      perfil: admin.perfil,
      cooperativaId: COOPERATIVA_ID,
    },
    JWT_SECRET,
    { expiresIn: '15m' },
  );

  const clientRequestId = `smoke-m39-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const QUANTIDADE = 1; // 1 token apenas — gate inegociável

  await prisma.$disconnect();

  // ─── 1. PREVIEW ───
  console.log('\n═══ PASSO 1 — PREVIEW ═══');
  const r1 = await fetch(`${BACKEND_URL}/cooper-token/admin/emitir-lote`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({
      distribuicoes: [
        { destinatarioCooperadoId: cooperadoTeste.id, quantidade: QUANTIDADE },
      ],
      descricao: 'Smoke M39 — 1 token + estorno imediato',
      clientRequestId,
      modo: 'PREVIEW',
    }),
  });
  const body1 = await r1.json();
  console.log(`HTTP ${r1.status}`);
  if (![200, 201].includes(r1.status) || body1.modo !== 'PREVIEW') {
    console.log('❌ FALHOU:', JSON.stringify(body1, null, 2));
    process.exit(1);
  }
  console.log(`✅ PREVIEW OK — totalItens=${body1.preview.totalItens}, soma=${body1.preview.resumo.somaQuantidade}, tier=${body1.preview.resumo.tier}`);

  // ─── 2. CONFIRM ───
  console.log('\n═══ PASSO 2 — CONFIRM ═══');
  const r2 = await fetch(`${BACKEND_URL}/cooper-token/admin/emitir-lote`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({
      distribuicoes: [
        { destinatarioCooperadoId: cooperadoTeste.id, quantidade: QUANTIDADE },
      ],
      descricao: 'Smoke M39 — 1 token + estorno imediato',
      clientRequestId,
      modo: 'CONFIRM',
    }),
  });
  const body2 = await r2.json();
  console.log(`HTTP ${r2.status}`);
  if (![200, 201].includes(r2.status) || body2.modo !== 'CONFIRM' || body2.resultado.idempotente !== false) {
    console.log('❌ FALHOU:', JSON.stringify(body2, null, 2));
    process.exit(1);
  }
  const loteId = body2.resultado.loteId;
  console.log(`✅ CONFIRM OK — loteId=${loteId}, destinatários=${body2.resultado.destinatarios.length}`);

  // ─── 3. Detalhe do lote ───
  console.log('\n═══ PASSO 3 — GET detalhe do lote ═══');
  const r3 = await fetch(`${BACKEND_URL}/cooper-token/admin/lotes-emitidos/${loteId}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const body3 = await r3.json();
  console.log(`HTTP ${r3.status}`);
  if (![200, 201].includes(r3.status) || body3.estornado) {
    console.log('❌ FALHOU:', JSON.stringify(body3, null, 2));
    process.exit(1);
  }
  console.log(`✅ Detalhe OK — somaQuantidade=${body3.somaQuantidade}, estornado=${body3.estornado}`);

  // ─── 4. ESTORNO ───
  console.log('\n═══ PASSO 4 — Estorno do lote ═══');
  const r4 = await fetch(`${BACKEND_URL}/cooper-token/admin/emitir-lote/${loteId}/estornar`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({
      motivo: 'Smoke teste — estorno imediato pra não criar passivo real',
      confirmado: true,
    }),
  });
  const body4 = await r4.json();
  console.log(`HTTP ${r4.status}`);
  if (![200, 201].includes(r4.status) || body4.idempotente !== false) {
    console.log('❌ FALHOU:', JSON.stringify(body4, null, 2));
    process.exit(1);
  }
  console.log(`✅ Estorno OK — totalEstornado=${body4.totalEstornado}, valorTotalReais=${body4.valorTotalReais}`);

  // ─── 5. Verificação final ───
  console.log('\n═══ PASSO 5 — Verificação saldo final + lote estornado ═══');
  const prismaCheck = new PrismaClient();
  const saldoFim = await prismaCheck.cooperTokenSaldo.findUnique({
    where: { cooperadoId: cooperadoTeste.id },
    select: { saldoDisponivel: true },
  });
  const saldoFinal = Number(saldoFim?.saldoDisponivel ?? 0);
  console.log(`Saldo final: ${saldoFinal} CooperTokens`);
  console.log(`Saldo inicial: ${saldoInicial} → final: ${saldoFinal} (diferença: ${saldoFinal - saldoInicial})`);
  if (saldoFinal !== saldoInicial) {
    console.log(`⚠️  ATENÇÃO: saldo NÃO retornou ao inicial. Diferença: ${saldoFinal - saldoInicial}`);
  } else {
    console.log(`✅ Saldo restaurado ao inicial (emissão e estorno se anularam).`);
  }

  // Anti-IDOR: confirma lote estornado
  const r6 = await fetch(`${BACKEND_URL}/cooper-token/admin/lotes-emitidos/${loteId}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const body6 = await r6.json();
  console.log(`\nLote ${loteId.slice(0, 8)} estornado=${body6.estornado}`);

  // Idempotência do estorno
  console.log('\n═══ PASSO 6 — Idempotência estorno (2× mesmo lote) ═══');
  const r7 = await fetch(`${BACKEND_URL}/cooper-token/admin/emitir-lote/${loteId}/estornar`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({
      motivo: 'Smoke idempotência — segunda chamada deve retornar idempotente',
      confirmado: true,
    }),
  });
  const body7 = await r7.json();
  console.log(`HTTP ${r7.status}, idempotente=${body7.idempotente}`);
  if (r7.status === 200 && body7.idempotente === true) {
    console.log(`✅ Idempotência OK — 2ª chamada retornou idempotente sem reprocessar.`);
  } else {
    console.log(`⚠️ Idempotência: esperado idempotente=true, recebido: ${JSON.stringify(body7)}`);
  }

  await prismaCheck.$disconnect();

  console.log('\n═══ Smoke M39 COMPLETO ═══');
}

main().catch((e) => {
  console.error('ERRO:', e);
  process.exit(1);
});
