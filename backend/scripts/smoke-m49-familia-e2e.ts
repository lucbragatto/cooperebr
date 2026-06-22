/**
 * Sprint Convênio FAMÍLIA M49 (22/06/2026) — Fatia G Smoke E2E REAL.
 *
 * Exerce o ciclo COMPLETO do convênio FAMÍLIA na CoopereBR Teste via HTTP.
 *
 * Estratégia minimalista:
 *  - Aproveita 2 cooperados ATIVOS existentes no banco da CoopereBR Teste
 *    (precisamos ter contratos+cobrança pra um deles).
 *  - JWT assinado manualmente com JWT_SECRET (mesmo helper do AuthService).
 *  - WhatsApp roteia REAL pra whitelist (telefone substituído nos cooperados
 *    selecionados — regra inegociável 14/05).
 *
 * Validações:
 *  - saldo PAGADORA debitado
 *  - cobrança TITULAR.tokenDescontoQt > 0
 *  - AuditLog 'token.usar-na-fatura.familiar' criado
 *  - MensagemWhatsapp tipoDisparo TOKEN_ABATE_FATURA_*_FAMILIAR
 *  - AutorizacaoTokenFamiliar.totalAbatesCount incrementado
 */
import { PrismaClient } from '@prisma/client';
import * as jwt from 'jsonwebtoken';
import * as crypto from 'crypto';
function hashOtp(codigo: string, salt: string): string {
  return crypto.createHash('sha256').update(codigo + salt).digest('hex');
}

const prisma = new PrismaClient();
const API = 'http://localhost:3000';
// Re-review orquestrador 22/06: próximos smokes vão pra `CoopereBR Teste`
// (tenant dedicado, isolado dos 307 cooperados reais). O smoke original do
// M49 usou `CoopereBR` com cooperados-whitelist (carolina+amages) por falta
// de cobrança em Teste — cleanup-m49-smoke.ts já reverteu artefatos.
//
// Pra rodar AGORA contra tenant Teste é preciso seed antes: 2 cooperados
// ATIVO + 1 contrato + 1 cobrança A_VENCER. Catalogado como pré-requisito
// no doc-sessão M49.
const TENANT_NOME = process.env.SMOKE_M49_TENANT ?? 'CoopereBR Teste';
const EMAIL_PAGADORA =
  process.env.SMOKE_M49_PAGADORA ?? 'lucbragatto+m49-pagadora@gmail.com';
const EMAIL_TITULAR =
  process.env.SMOKE_M49_TITULAR ?? 'lucbragatto+m49-titular@gmail.com';

const TELEFONE_WHITELIST = '27981341348';

const PIN_PAGADORA = '111111';
const PIN_TITULAR = '222222';

const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET) {
  console.error('JWT_SECRET não definido no env. Carregue o .env do backend.');
  process.exit(1);
}

function assinarToken(opts: {
  usuarioId: string;
  email: string;
  cooperadoId: string;
  cooperativaId: string;
}): string {
  return jwt.sign(
    {
      sub: opts.usuarioId,
      email: opts.email,
      perfil: 'COOPERADO',
      cooperadoId: opts.cooperadoId,
      cooperativaId: opts.cooperativaId,
    },
    JWT_SECRET!,
    { expiresIn: '15m' },
  );
}

async function obterTenant() {
  const t = await prisma.cooperativa.findFirst({
    where: { nome: TENANT_NOME },
    select: { id: true, nome: true, tokenFamiliarSacavel: true },
  });
  if (!t) throw new Error(`Tenant "${TENANT_NOME}" não encontrado.`);
  return t;
}

async function escolherDoisCooperados(cooperativaId: string): Promise<{
  pagador: { id: string; email: string; nomeCompleto: string };
  titular: { id: string; email: string; nomeCompleto: string; cobrancaId: string };
}> {
  // M49 smoke usa cooperados WHITELIST emails (lucbragatto+suffix) que já
  // têm telefone do Luciano (27981341348) e ambienteTeste=true.
  const titularCand = await prisma.cooperado.findFirst({
    where: { email: EMAIL_TITULAR, cooperativaId, status: 'ATIVO' },
    select: {
      id: true,
      email: true,
      nomeCompleto: true,
      contratos: {
        select: {
          cobrancas: {
            where: { status: { in: ['A_VENCER', 'VENCIDO'] } },
            select: { id: true, valorLiquido: true },
            take: 1,
          },
        },
        take: 5,
      },
    },
  });
  if (!titularCand) {
    throw new Error(`Cooperado titular whitelist "${EMAIL_TITULAR}" não encontrado no tenant.`);
  }
  const cobranca = titularCand.contratos.flatMap((c) => c.cobrancas)[0];
  if (!cobranca) {
    throw new Error(
      `Cooperado titular "${EMAIL_TITULAR}" sem cobrança A_VENCER/VENCIDO — crie uma antes do smoke.`,
    );
  }

  const pagadoraCand = await prisma.cooperado.findFirst({
    where: { email: EMAIL_PAGADORA, cooperativaId, status: 'ATIVO' },
    select: { id: true, email: true, nomeCompleto: true },
  });
  if (!pagadoraCand) {
    throw new Error(`Cooperado pagadora whitelist "${EMAIL_PAGADORA}" não encontrado no tenant.`);
  }

  return {
    pagador: pagadoraCand,
    titular: { ...titularCand, cobrancaId: cobranca.id },
  };
}

async function setarPinECtos(cooperadoId: string, pinPlain: string) {
  const salt = crypto.randomBytes(16).toString('hex');
  const pinHash = hashOtp(pinPlain, salt);
  await prisma.cooperado.update({
    where: { id: cooperadoId },
    data: {
      pinHash,
      pinSalt: salt,
      pinTentativas: 0,
      pinBloqueadoAte: null,
      pinDefinidoEm: new Date(),
      telefone: TELEFONE_WHITELIST,
      ambienteTeste: true,
    },
  });
}

async function obterOuCriarUsuarioPraCooperado(opts: {
  cooperadoId: string;
  cooperativaId: string;
  email: string;
}): Promise<string> {
  const existente = await prisma.usuario.findFirst({
    where: { email: opts.email },
    select: { id: true },
  });
  if (existente) return existente.id;
  const novo = await prisma.usuario.create({
    data: {
      email: opts.email,
      nome: 'smoke-m49',
      perfil: 'COOPERADO' as any,
      cooperativaId: opts.cooperativaId,
    },
  });
  return novo.id;
}

async function creditarTokens(opts: {
  cooperativaId: string;
  cooperadoId: string;
  quantidade: number;
}) {
  await prisma.$transaction(async (tx) => {
    const existente = await tx.cooperTokenSaldo.findUnique({
      where: { cooperadoId: opts.cooperadoId },
    });
    let saldoApos: number;
    if (existente) {
      const upd = await tx.cooperTokenSaldo.update({
        where: { cooperadoId: opts.cooperadoId },
        data: { saldoDisponivel: { increment: opts.quantidade } },
        select: { saldoDisponivel: true },
      });
      saldoApos = Number(upd.saldoDisponivel);
    } else {
      await tx.cooperTokenSaldo.create({
        data: {
          cooperadoId: opts.cooperadoId,
          cooperativaId: opts.cooperativaId,
          saldoDisponivel: opts.quantidade,
          saldoBloqueadoResgate: 0,
        },
      });
      saldoApos = opts.quantidade;
    }
    await tx.cooperTokenLedger.create({
      data: {
        cooperadoId: opts.cooperadoId,
        cooperativaId: opts.cooperativaId,
        tipo: 'BONUS_INDICACAO' as any,
        operacao: 'CREDITO',
        quantidade: opts.quantidade,
        saldoApos,
        descricao: 'Smoke M49 — setup saldo pagadora',
        referenciaTabela: 'smoke',
        referenciaId: crypto.randomUUID(),
      },
    });
  });
}

async function main() {
  console.log('\n=== M49 Smoke E2E — Convênio FAMÍLIA ===\n');

  const tenant = await obterTenant();
  console.log(`Tenant: ${tenant.nome} (${tenant.id}) tokenFamiliarSacavel=${tenant.tokenFamiliarSacavel}`);

  console.log('\n[1/7] Escolhendo 2 cooperados + cobrança...');
  const { pagador, titular } = await escolherDoisCooperados(tenant.id);
  console.log(`  PAGADORA: ${pagador.nomeCompleto} (${pagador.id}) email=${pagador.email}`);
  console.log(`  TITULAR:  ${titular.nomeCompleto} (${titular.id}) email=${titular.email}`);
  console.log(`  COBRANÇA: ${titular.cobrancaId}`);

  console.log('\n[2/7] Setando PIN whitelist + telefone whitelist nos 2 cooperados...');
  await setarPinECtos(pagador.id, PIN_PAGADORA);
  await setarPinECtos(titular.id, PIN_TITULAR);

  console.log('\n[3/7] Credito setup 200 tokens pra PAGADORA...');
  await creditarTokens({ cooperativaId: tenant.id, cooperadoId: pagador.id, quantidade: 200 });
  const saldoPre = await prisma.cooperTokenSaldo.findUnique({
    where: { cooperadoId: pagador.id },
    select: { saldoDisponivel: true },
  });
  console.log(`  saldo PAGADORA pré-abate: ${saldoPre?.saldoDisponivel}`);

  console.log('\n[4/7] Gera JWT real pras 2 cooperadas (assinatura local — pula Supabase)...');
  const usuarioPagadorId = await obterOuCriarUsuarioPraCooperado({
    cooperadoId: pagador.id,
    cooperativaId: tenant.id,
    email: pagador.email,
  });
  const usuarioTitularId = await obterOuCriarUsuarioPraCooperado({
    cooperadoId: titular.id,
    cooperativaId: tenant.id,
    email: titular.email,
  });
  const jwtPagadora = assinarToken({
    usuarioId: usuarioPagadorId,
    email: pagador.email,
    cooperadoId: pagador.id,
    cooperativaId: tenant.id,
  });
  const jwtTitular = assinarToken({
    usuarioId: usuarioTitularId,
    email: titular.email,
    cooperadoId: titular.id,
    cooperativaId: tenant.id,
  });

  console.log('\n[5/7] POST /autorizacao-token-familiar (pagadora cria com PIN)...');
  const respCriar = await fetch(`${API}/autorizacao-token-familiar`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      authorization: `Bearer ${jwtPagadora}`,
    },
    body: JSON.stringify({
      cooperadoTitularId: titular.id,
      pinPagador: PIN_PAGADORA,
    }),
  });
  if (!respCriar.ok) {
    throw new Error(`criar falhou ${respCriar.status}: ${await respCriar.text()}`);
  }
  const autorizacao: any = await respCriar.json();
  console.log(`  autorização criada id=${autorizacao.id} ativo=${autorizacao.ativo}`);

  console.log(`\n[6/7] POST /autorizacao-token-familiar/${autorizacao.id}/confirmar (titular)...`);
  const respConfirmar = await fetch(
    `${API}/autorizacao-token-familiar/${autorizacao.id}/confirmar`,
    {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        authorization: `Bearer ${jwtTitular}`,
      },
      body: JSON.stringify({ pinTitular: PIN_TITULAR }),
    },
  );
  if (!respConfirmar.ok) {
    throw new Error(`confirmar falhou ${respConfirmar.status}: ${await respConfirmar.text()}`);
  }
  const ativada: any = await respConfirmar.json();
  console.log(`  autorização CONFIRMADA: ativo=${ativada.ativo}`);

  console.log('\n[7/7] POST /cooper-token/usar-na-fatura (FAMILIAR — 10 tokens)...');
  const respAbate = await fetch(`${API}/cooper-token/usar-na-fatura`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      authorization: `Bearer ${jwtPagadora}`,
    },
    body: JSON.stringify({
      cobrancaId: titular.cobrancaId,
      quantidadeTokens: 10,
      pin: PIN_PAGADORA,
      titularCooperadoId: titular.id,
    }),
  });
  if (!respAbate.ok) {
    throw new Error(`usarNaFatura familiar falhou ${respAbate.status}: ${await respAbate.text()}`);
  }
  const abate: any = await respAbate.json();
  console.log(`  abate OK: tokensUsados=${abate.tokensUsados} desconto=R$${abate.desconto} novoValor=R$${abate.novoValor}`);

  console.log('\n=== ASSERTS ===');

  const saldoPos = await prisma.cooperTokenSaldo.findUnique({
    where: { cooperadoId: pagador.id },
    select: { saldoDisponivel: true },
  });
  const debitado = Number(saldoPre?.saldoDisponivel ?? 0) - Number(saldoPos?.saldoDisponivel ?? 0);
  console.log(`  [A] Saldo PAGADORA: ${saldoPre?.saldoDisponivel} → ${saldoPos?.saldoDisponivel} (debitou ${debitado})`);
  if (debitado <= 0) throw new Error('FAIL: saldo da pagadora não foi debitado');

  const cobrancaPos = await prisma.cobranca.findUnique({
    where: { id: titular.cobrancaId },
    select: {
      tokenDescontoQt: true,
      tokenDescontoReais: true,
      valorLiquido: true,
      contrato: { select: { cooperadoId: true } },
    },
  });
  console.log(
    `  [B] Cobrança TITULAR: tokenDescontoQt=${cobrancaPos?.tokenDescontoQt} tokenDescontoReais=R$${cobrancaPos?.tokenDescontoReais}`,
  );
  if (cobrancaPos?.contrato.cooperadoId !== titular.id) {
    throw new Error('FAIL: cobrança usada NÃO é do titular');
  }
  if (Number(cobrancaPos?.tokenDescontoQt ?? 0) < 1) {
    throw new Error('FAIL: tokenDescontoQt não refletiu o abate');
  }

  const log = await prisma.auditLog.findFirst({
    where: {
      cooperativaId: tenant.id,
      acao: 'token.usar-na-fatura.familiar',
      recursoId: titular.cobrancaId,
    },
    orderBy: { createdAt: 'desc' },
  });
  console.log(`  [C] AuditLog forense: ${log?.id ? `OK id=${log.id}` : 'MISSING'}`);
  if (!log) throw new Error('FAIL: AuditLog token.usar-na-fatura.familiar não criado');

  await new Promise((r) => setTimeout(r, 2000));
  const waPagador = await prisma.mensagemWhatsapp.findFirst({
    where: {
      cooperativaId: tenant.id,
      tipoDisparo: 'TOKEN_ABATE_FATURA_PAGADOR_FAMILIAR',
    },
    orderBy: { createdAt: 'desc' },
    select: { id: true, status: true, telefone: true },
  });
  const waTitular = await prisma.mensagemWhatsapp.findFirst({
    where: {
      cooperativaId: tenant.id,
      tipoDisparo: 'TOKEN_ABATE_FATURA_TITULAR_FAMILIAR',
    },
    orderBy: { createdAt: 'desc' },
    select: { id: true, status: true, telefone: true },
  });
  console.log(
    `  [D] WA pagador: ${waPagador ? `${waPagador.status} → ${waPagador.telefone}` : 'MISSING'}`,
  );
  console.log(
    `  [D] WA titular: ${waTitular ? `${waTitular.status} → ${waTitular.telefone}` : 'MISSING'}`,
  );
  if (!waPagador || !waTitular) {
    throw new Error('FAIL: MensagemWhatsapp pagador/titular faltando');
  }

  const aut = await prisma.autorizacaoTokenFamiliar.findUnique({
    where: { id: autorizacao.id },
    select: {
      totalAbatesCount: true,
      totalTokensAbatidos: true,
      primeiraUtilizacaoEm: true,
      ultimoUsoEm: true,
    },
  });
  console.log(
    `  [E] Autorização: abates=${aut?.totalAbatesCount} tokens=${aut?.totalTokensAbatidos} 1ºUso=${aut?.primeiraUtilizacaoEm?.toISOString()}`,
  );
  if (Number(aut?.totalAbatesCount ?? 0) < 1) {
    throw new Error('FAIL: totalAbatesCount não incrementado');
  }

  console.log('\n✅ SMOKE M49 PASSOU — Convênio FAMÍLIA E2E REAL OK\n');
}

main()
  .catch((err) => {
    console.error('\n❌ SMOKE M49 FALHOU:', err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
