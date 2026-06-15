/**
 * Smoke E2E real fix Santi 403 — distribuir tokens via empresa_conveniada.
 *
 * Bate em backend :3000 com JWT manual simulando empresa_conveniada da
 * Clínica Teste pagadora do convênio CV-2026-0001.
 *
 * Esperado pós-fix:
 *  1. GET /cooper-token/empresa/convenio/:id/membros-disponiveis → 200
 *  2. POST /cooper-token/empresa/distribuir (modo=PREVIEW) → 200
 *  3. (sem confirm) — só preview, validação cosmética
 *
 * Antes do fix: ambos retornavam 403 "Apenas a empresa conveniada
 * (representante)...".
 */
import { PrismaClient } from '@prisma/client';
import * as jwt from 'jsonwebtoken';

const CONVENIO_ID = 'cmpwof5h6000avaf8547cj3pb';
const COOPERADO_PAGADOR_ID = 'cmpwnuid50006vaf8th51y2s7'; // Clínica Teste PJ
const COOPERATIVA_ID = 'cmn0ho8bx0000uox8wu96u6fd';
const BACKEND_URL = 'http://localhost:3000';

async function main() {
  const prisma = new PrismaClient();

  // Acha o Usuario vinculado ao pagador (mesmo email).
  const pagador = await prisma.cooperado.findUnique({
    where: { id: COOPERADO_PAGADOR_ID },
    select: { email: true, nomeCompleto: true },
  });
  if (!pagador) throw new Error('Cooperado pagador não encontrado.');
  console.log(`Pagador: ${pagador.nomeCompleto} <${pagador.email}>`);

  const usuario = await prisma.usuario.findFirst({
    where: { email: pagador.email },
    select: { id: true, email: true, perfil: true },
  });
  if (!usuario) throw new Error('Usuario vinculado ao pagador nao encontrado (smoke depende dele).');
  console.log(`Usuario: ${usuario.id} (${usuario.perfil})`);

  await prisma.$disconnect();

  // Monta JWT empresa_conveniada (espelha auth.service.ts:694-709).
  const JWT_SECRET = process.env.JWT_SECRET;
  if (!JWT_SECRET) throw new Error('JWT_SECRET não configurado no .env.');

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
  console.log(`JWT empresa_conveniada gerado.\n`);

  // ─── PASSO 1 — Listar membros disponíveis (era 403 antes do fix) ───
  console.log('═══ PASSO 1 — GET /empresa/convenio/:id/membros-disponiveis ═══');
  const respMembros = await fetch(
    `${BACKEND_URL}/cooper-token/empresa/convenio/${CONVENIO_ID}/membros-disponiveis`,
    { headers: { Authorization: `Bearer ${token}` } },
  );
  const bodyMembros = await respMembros.json();
  console.log(`HTTP ${respMembros.status}`);
  if (respMembros.status !== 200) {
    console.log('❌ FALHOU — esperado 200, recebeu:', JSON.stringify(bodyMembros, null, 2));
    process.exit(1);
  }
  console.log('✅ PASS — fix funcionou. Resumo:');
  console.log(`   Convênio   : ${bodyMembros.convenio?.numero} — ${bodyMembros.convenio?.empresaNome}`);
  console.log(`   Saldo      : ${bodyMembros.saldoEmpresa?.saldoDisponivel} CooperTokens`);
  console.log(`   Membros ativos    : ${bodyMembros.membros?.ativos?.length ?? 0}`);
  console.log(`   Membros pendentes : ${bodyMembros.membros?.pendentes?.total ?? 0}`);

  const ativos = bodyMembros.membros?.ativos ?? [];
  if (ativos.length === 0) {
    console.log('\n⚠️  Convênio sem membros ATIVO — pulando PREVIEW de distribuição.');
    console.log('✅ Smoke completo (PASSO 1 confirma fix do guard).');
    return;
  }

  // ─── PASSO 2 — PREVIEW de distribuição (era 403 antes do fix) ───
  console.log('\n═══ PASSO 2 — POST /empresa/distribuir (modo=PREVIEW) ═══');
  const distribuicoes = ativos.slice(0, 2).map((m: any) => ({
    destinatarioCooperadoId: m.cooperadoId,
    quantidade: 1, // simbólico
  }));
  console.log(`   ${distribuicoes.length} linha(s) preview, 1 token/cada.`);

  const respPreview = await fetch(
    `${BACKEND_URL}/cooper-token/empresa/distribuir`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        convenioId: CONVENIO_ID,
        clientRequestId: `smoke-santi-${Date.now()}`,
        pin: '999999', // PIN inválido — esperado falhar APÓS o guard
        modo: 'PREVIEW',
        distribuicoes,
        naturezaDistribuicao: 'ORIGEM_REGULAMENTO',
      }),
    },
  );
  const bodyPreview = await respPreview.json();
  console.log(`HTTP ${respPreview.status}`);

  // O guard que estamos testando vem ANTES do PIN.
  // - Se preview chega no PIN: guard pagador OK (resposta 400/403 por PIN inválido).
  // - Se cair em 403 "Apenas a empresa pagadora": guard ainda quebrado.
  // - Se 403 "Apenas a empresa conveniada (representante)": código velho rodando.
  const msg = String(bodyPreview?.message ?? '').toLowerCase();
  if (msg.includes('conveniada (representante)')) {
    console.log('❌ FALHOU — mensagem antiga aparece, backend não recarregou o fix.');
    process.exit(1);
  }
  if (msg.includes('empresa pagadora') && respPreview.status === 403) {
    console.log('❌ FALHOU — guard pagador rejeitou. JWT inconsistente.');
    console.log(JSON.stringify(bodyPreview, null, 2));
    process.exit(1);
  }
  if (msg.includes('pin')) {
    console.log('✅ PASS — passou pelo guard pagador. Próximo erro foi PIN (esperado, smoke não tem PIN real).');
    console.log(`   Mensagem: ${bodyPreview.message}`);
  } else {
    console.log('ℹ️  Resposta:', JSON.stringify(bodyPreview, null, 2));
  }

  console.log('\n═══ Smoke COMPLETO — fix do guard validado ═══');
}

main().catch(e => {
  console.error('ERRO:', e);
  process.exit(1);
});
