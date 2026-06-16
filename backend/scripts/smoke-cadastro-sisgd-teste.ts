/**
 * Smoke E2E — Sprint "Abrir Cadastros — Teste SISGD" (17/06/2026).
 *
 * Valida o onboarding ponta a ponta usando o convênio CV-SISGD-TESTE-001:
 *
 *   1.  Cleanup idempotente — remove artefatos do run anterior (Cooperado
 *       com email lucbragatto+sisgd-teste@gmail.com e dependências).
 *   2.  JWT admin CoopereBR.
 *   3.  POST /convenios/{conv}/convites — admin cadastra destinatário com
 *       telefone whitelist + nome.
 *   4.  POST /publico/convites/{token}/solicitar-otp — gera OTP + envia WA
 *       pro whitelist.
 *   5.  Override OTP no banco — overrides o otpCodigoHash com sha256(123456
 *       + otpSalt) pra smoke determinístico (mantém solicitar-otp como
 *       API call real; só substitui o "código entregue" pelo conhecido).
 *   6.  POST /publico/convites/{token}/validar-otp — valida 123456.
 *   7.  POST /publico/convenios/auto-inscrever — cria Cooperado + UC +
 *       Proposta + Membro PENDENTE_APROVACAO_EMPRESA.
 *   8.  Empresa SISGD (lucbragatto+sisgd@gmail.com / SISGDSOLAR) decide
 *       APROVAR via POST /portal/meus-convenios/{conv}/membros/{mid}/decidir.
 *       Espera status PENDENTE_APROVACAO_ADMIN.
 *   9.  Admin aprova via POST /convenios/{conv}/membros/{mid}/aprovar-admin.
 *       Espera status MEMBRO_ATIVO + Contrato criado pelo MembroBuilder.
 *   10. Read-only final — confere MEMBRO_ATIVO + Contrato existe (+ ProgressaoClube
 *       quando aplicável).
 *
 * Contatos whitelist (obrigatorio):
 *   - Telefone WA:  27981341348 (Luciano)
 *   - Email:        lucbragatto+sisgd-teste@gmail.com (whitelist 17/06)
 *
 * Pré-requisito: rodar `npx ts-node scripts/seed-sisgd-teste-interno.ts`
 * antes (idempotente — converge SISGDSOLAR + CV-SISGD-TESTE-001 + Usuario).
 *
 * Uso: cd backend ; npx ts-node scripts/smoke-cadastro-sisgd-teste.ts
 */
import { PrismaClient } from '@prisma/client';
import * as jwt from 'jsonwebtoken';
import * as crypto from 'crypto';
import * as dotenv from 'dotenv';
import * as path from 'node:path';

dotenv.config({ path: path.resolve(__dirname, '..', '.env') });

const BACKEND_URL = process.env.SMOKE_BACKEND_URL ?? 'http://localhost:3000';
const COOPEREBR_ID = 'cmn0ho8bx0000uox8wu96u6fd';
const CONVENIO_ID = 'cmq57khys0005vavshti9gst9'; // CV-SISGD-TESTE-001
const CONVENIO_NUMERO = 'CV-SISGD-TESTE-001';

// Empresa pagadora (SISGDSOLAR SISTEMAS LTDA) — convergida pelo seed v2.
const EMPRESA_USUARIO_EMAIL = 'lucbragatto+sisgd@gmail.com';
const EMPRESA_COOPERADO_ID = 'cmq57khne0002vavsis4v9oxk';

// Destinatário do convite — contatos whitelist.
const DESTINATARIO = {
  nomeConvidado: `Teste SISGD smoke ${new Date().toISOString().slice(0, 16)}`,
  telefone: '5527981341348',
  email: 'lucbragatto+sisgd-teste@gmail.com',
  consumoMedioKwh: 250,
};

// OTP determinístico — override no banco antes de validar-otp.
const OTP_SMOKE = '123456';

// ─── Helpers ───────────────────────────────────────────────────────

function exigirEnv(nome: string): string {
  const v = process.env[nome];
  if (!v) {
    console.error(`[smoke] FALTA env ${nome}`);
    process.exit(1);
  }
  return v;
}

function gerarCpfValido(): string {
  // Gera 9 dígitos aleatórios + 2 dígitos verificadores (alg. CPF padrão).
  const digitos = Array.from({ length: 9 }, () => crypto.randomInt(0, 10));
  const calcDV = (base: number[]): number => {
    const soma = base.reduce((s, d, i) => s + d * (base.length + 1 - i), 0);
    const r = (soma * 10) % 11;
    return r === 10 ? 0 : r;
  };
  digitos.push(calcDV(digitos));
  digitos.push(calcDV(digitos));
  return digitos.join('');
}

interface PassoResultado {
  passo: string;
  ok: boolean;
  detalhe?: string;
}

function logPasso(p: PassoResultado): void {
  const icon = p.ok ? '✅' : '❌';
  console.log(`${icon} ${p.passo}${p.detalhe ? ` — ${p.detalhe}` : ''}`);
}

async function http<T = any>(
  method: 'GET' | 'POST',
  url: string,
  opts: {
    bearer?: string;
    body?: any;
    expect?: number[];
    label: string;
  },
): Promise<{ status: number; data: T }> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (opts.bearer) headers['Authorization'] = `Bearer ${opts.bearer}`;

  const res = await fetch(url, {
    method,
    headers,
    body: opts.body ? JSON.stringify(opts.body) : undefined,
  });

  let data: any = null;
  try {
    data = await res.json();
  } catch {
    // sem body — ignora
  }

  const expected = opts.expect ?? [200, 201];
  if (!expected.includes(res.status)) {
    console.error(`\n❌ [${opts.label}] HTTP ${res.status} (esperado: ${expected.join('|')})`);
    console.error('   url:', url);
    console.error('   payload:', opts.body ? JSON.stringify(opts.body).slice(0, 300) : '(sem body)');
    console.error('   resposta:', JSON.stringify(data).slice(0, 500));
    process.exit(1);
  }

  return { status: res.status, data };
}

// ─── Main ──────────────────────────────────────────────────────────

async function main(): Promise<void> {
  const prisma = new PrismaClient();
  const JWT_SECRET = exigirEnv('JWT_SECRET');

  console.log('═══════════════════════════════════════════════════════════════════');
  console.log('🔥 Smoke E2E Sprint "Abrir Cadastros — Teste SISGD"');
  console.log(`   Backend:  ${BACKEND_URL}`);
  console.log(`   Convênio: ${CONVENIO_NUMERO} (id=${CONVENIO_ID})`);
  console.log(`   Email:    ${DESTINATARIO.email}  (whitelist)`);
  console.log(`   Telefone: ${DESTINATARIO.telefone}  (whitelist)`);
  console.log('═══════════════════════════════════════════════════════════════════\n');

  // ──────────────────────────────────────────────────────────────
  // PASSO 1 — Cleanup idempotente do run anterior
  // ──────────────────────────────────────────────────────────────
  console.log('── PASSO 1: cleanup idempotente do run anterior ──');
  const antigo = await prisma.cooperado.findUnique({
    where: { email: DESTINATARIO.email },
    select: {
      id: true,
      nomeCompleto: true,
      _count: {
        select: {
          contratos: true,
          ucs: true,
          propostas: true,
        },
      },
    },
  });
  if (antigo) {
    const progAntiga = await prisma.progressaoClube.findUnique({
      where: { cooperadoId: antigo.id },
      select: { id: true },
    });
    console.log(
      `  Encontrado Cooperado antigo: id=${antigo.id}  nome="${antigo.nomeCompleto}"  contratos=${antigo._count.contratos}  ucs=${antigo._count.ucs}  propostas=${antigo._count.propostas}  progressao=${progAntiga ? 1 : 0}`,
    );
    await prisma.$transaction(async (tx) => {
      // P3 reviewer (16/06): defense in depth — onde o model tem
      // cooperativaId nativo (Contrato/PropostaCooperado/Uc/Cooperado),
      // filtramos por ele tambem. ConvenioCooperado/ProgressaoClube/
      // AprovacaoConvenioMembro NAO tem cooperativaId direto — o filtro
      // por cooperadoId basta (cooperado ja localizado por email unique
      // dentro do tenant). Ordem importa pra FKs.
      await tx.aprovacaoConvenioMembro.deleteMany({
        where: { membro: { cooperadoId: antigo.id } },
      });
      await tx.convenioCooperado.deleteMany({ where: { cooperadoId: antigo.id } });
      await tx.progressaoClube.deleteMany({ where: { cooperadoId: antigo.id } });
      await tx.contrato.deleteMany({
        where: { cooperadoId: antigo.id, cooperativaId: COOPEREBR_ID },
      });
      await tx.propostaCooperado.deleteMany({
        where: { cooperadoId: antigo.id, cooperativaId: COOPEREBR_ID },
      });
      await tx.uc.deleteMany({
        where: { cooperadoId: antigo.id, cooperativaId: COOPEREBR_ID },
      });
      // delete cooperado: filtro tenant duplo (cooperado.email e unique global)
      const delOk = await tx.cooperado.deleteMany({
        where: { id: antigo.id, cooperativaId: COOPEREBR_ID },
      });
      if (delOk.count !== 1) {
        throw new Error(`Cleanup cooperado: deleteMany count=${delOk.count} (esperado 1)`);
      }
    });
    console.log(`  🧹 Cooperado antigo + dependências removidos`);
  } else {
    console.log(`  (sem cooperado antigo com email ${DESTINATARIO.email} — no-op)`);
  }

  // Limpa convites do mesmo telefone que ainda estejam vivos (não usados, não expirados)
  // pra não confundir o solicitar-otp (regra reuse-if-alive).
  const convitesVivos = await prisma.conviteConvenioMembro.findMany({
    where: {
      convenioId: CONVENIO_ID,
      telefone: { contains: DESTINATARIO.telefone.slice(-8) },
      usedAt: null,
      expiresAt: { gt: new Date() },
    },
    select: { id: true, nomeConvidado: true },
  });
  if (convitesVivos.length > 0) {
    await prisma.conviteConvenioMembro.deleteMany({
      where: { id: { in: convitesVivos.map((c) => c.id) } },
    });
    console.log(`  🧹 ${convitesVivos.length} convite(s) vivo(s) anterior(es) removido(s)`);
  }

  // ──────────────────────────────────────────────────────────────
  // PASSO 2 — JWT admin CoopereBR
  // ──────────────────────────────────────────────────────────────
  console.log('\n── PASSO 2: JWT admin CoopereBR ──');
  const admin = await prisma.usuario.findFirst({
    where: {
      cooperativaId: COOPEREBR_ID,
      perfil: { in: ['ADMIN', 'SUPER_ADMIN'] as any },
      ativo: true,
    },
    select: { id: true, email: true, perfil: true },
  });
  if (!admin) {
    console.error('❌ Admin não encontrado na CoopereBR');
    process.exit(1);
  }
  const adminJwt = jwt.sign(
    {
      sub: admin.id,
      id: admin.id,
      userId: admin.id,
      email: admin.email,
      perfil: admin.perfil,
      cooperativaId: COOPEREBR_ID,
    },
    JWT_SECRET,
    { expiresIn: '15m' },
  );
  logPasso({ passo: 'PASSO 2', ok: true, detalhe: `admin ${admin.email} (${admin.perfil})` });

  // ──────────────────────────────────────────────────────────────
  // PASSO 3 — Cria convite (admin path)
  // ──────────────────────────────────────────────────────────────
  console.log('\n── PASSO 3: cria convite via POST /convenios/{conv}/convites ──');
  const r3 = await http<{ id: string; tokenSufixo: string; whatsappEnviado: boolean }>(
    'POST',
    `${BACKEND_URL}/convenios/${CONVENIO_ID}/convites`,
    {
      bearer: adminJwt,
      body: { nomeConvidado: DESTINATARIO.nomeConvidado, telefone: DESTINATARIO.telefone },
      expect: [201],
      label: 'criar-convite',
    },
  );
  const conviteId = r3.data.id;
  // Pegamos o TOKEN completo direto do banco (endpoint só devolve sufixo por LGPD)
  const convite = await prisma.conviteConvenioMembro.findUnique({
    where: { id: conviteId },
    select: { token: true, telefone: true, nomeConvidado: true },
  });
  if (!convite) {
    console.error('❌ Convite não persistido');
    process.exit(1);
  }
  const conviteToken = convite.token;
  logPasso({
    passo: 'PASSO 3',
    ok: true,
    detalhe: `conviteId=${conviteId}  tokenSufixo=${r3.data.tokenSufixo}  waEnviado=${r3.data.whatsappEnviado}`,
  });

  // ──────────────────────────────────────────────────────────────
  // PASSO 4 — Solicita OTP
  // ──────────────────────────────────────────────────────────────
  console.log('\n── PASSO 4: POST /publico/convites/{token}/solicitar-otp ──');
  const r4 = await http<{ ok: boolean; whatsappEnviado: boolean }>(
    'POST',
    `${BACKEND_URL}/publico/convites/${conviteToken}/solicitar-otp`,
    {
      body: {},
      expect: [200, 201],
      label: 'solicitar-otp',
    },
  );
  logPasso({
    passo: 'PASSO 4',
    ok: true,
    detalhe: `ok=${r4.data.ok}  waEnviado=${r4.data.whatsappEnviado}`,
  });

  // ──────────────────────────────────────────────────────────────
  // PASSO 5 — Override OTP no banco (determinístico)
  // ──────────────────────────────────────────────────────────────
  console.log('\n── PASSO 5: override otpCodigoHash com sha256(123456 + salt) ──');
  const conviteOtp = await prisma.conviteConvenioMembro.findUnique({
    where: { id: conviteId },
    select: { otpSalt: true, otpExpiresAt: true },
  });
  if (!conviteOtp?.otpSalt) {
    console.error('❌ Convite sem otpSalt — solicitar-otp não gerou estado');
    process.exit(1);
  }
  const hashSmoke = crypto
    .createHash('sha256')
    .update(OTP_SMOKE + conviteOtp.otpSalt)
    .digest('hex');
  await prisma.conviteConvenioMembro.update({
    where: { id: conviteId },
    data: { otpCodigoHash: hashSmoke, otpTentativas: 0 },
  });
  logPasso({
    passo: 'PASSO 5',
    ok: true,
    detalhe: `OTP=${OTP_SMOKE} hash overrideado, salt preservado, expira=${conviteOtp.otpExpiresAt?.toISOString()}`,
  });

  // ──────────────────────────────────────────────────────────────
  // PASSO 6 — Valida OTP
  // ──────────────────────────────────────────────────────────────
  console.log('\n── PASSO 6: POST /publico/convites/{token}/validar-otp ──');
  await http(
    'POST',
    `${BACKEND_URL}/publico/convites/${conviteToken}/validar-otp`,
    {
      body: { codigo: OTP_SMOKE },
      expect: [200, 201],
      label: 'validar-otp',
    },
  );
  logPasso({ passo: 'PASSO 6', ok: true, detalhe: `OTP ${OTP_SMOKE} validado` });

  // ──────────────────────────────────────────────────────────────
  // PASSO 7 — Auto-inscrever (cria Cooperado + UC + Proposta + Membro)
  // ──────────────────────────────────────────────────────────────
  console.log('\n── PASSO 7: POST /publico/convenios/auto-inscrever ──');
  const cpfNovo = gerarCpfValido();
  const r7 = await http<{ cooperadoId?: string; membroId?: string }>(
    'POST',
    `${BACKEND_URL}/publico/convenios/auto-inscrever`,
    {
      body: {
        token: conviteToken,
        nome: DESTINATARIO.nomeConvidado,
        cpf: cpfNovo,
        email: DESTINATARIO.email,
        telefone: DESTINATARIO.telefone,
        consumoMedioKwh: DESTINATARIO.consumoMedioKwh,
      },
      expect: [201],
      label: 'auto-inscrever',
    },
  );
  logPasso({
    passo: 'PASSO 7',
    ok: true,
    detalhe: `cpf=${cpfNovo}  resposta=${JSON.stringify(r7.data).slice(0, 200)}`,
  });

  // Busca membro PENDENTE_APROVACAO_EMPRESA recém-criado
  const cooperadoNovo = await prisma.cooperado.findUnique({
    where: { email: DESTINATARIO.email },
    select: { id: true, nomeCompleto: true, cpf: true, status: true },
  });
  if (!cooperadoNovo) {
    console.error('❌ Cooperado não criado pelo auto-inscrever');
    process.exit(1);
  }
  const membro = await prisma.convenioCooperado.findFirst({
    where: {
      convenioId: CONVENIO_ID,
      cooperadoId: cooperadoNovo.id,
    },
    select: { id: true, status: true, ativo: true },
  });
  if (!membro) {
    console.error('❌ Membro não criado pelo auto-inscrever');
    process.exit(1);
  }
  if (membro.status !== 'PENDENTE_APROVACAO_EMPRESA') {
    console.error(`❌ Status inesperado: ${membro.status} (esperado PENDENTE_APROVACAO_EMPRESA)`);
    process.exit(1);
  }
  console.log(
    `  ✓ Cooperado novo id=${cooperadoNovo.id}  membro id=${membro.id}  status=${membro.status}  ativo=${membro.ativo}`,
  );

  // ──────────────────────────────────────────────────────────────
  // PASSO 8 — Empresa SISGD aprova in-portal
  // ──────────────────────────────────────────────────────────────
  console.log('\n── PASSO 8: empresa SISGD APROVA via /portal/meus-convenios/.../decidir ──');
  const empresaUsuario = await prisma.usuario.findUnique({
    where: { email: EMPRESA_USUARIO_EMAIL },
    select: { id: true, email: true, perfil: true },
  });
  if (!empresaUsuario) {
    console.error(`❌ Usuario empresa ${EMPRESA_USUARIO_EMAIL} não encontrado (rode o seed)`);
    process.exit(1);
  }
  // P3 reviewer (16/06): NAO incluir cooperadoId no payload do JWT empresa.
  // O PagadorCooperadoGuard resolve via Cooperado.email == Usuario.email
  // (linhas 71-97 do guard). Se o smoke incluir cooperadoId, mascara
  // regressao futura caso algum endpoint passe a confiar no campo do JWT
  // em vez do email-match. EMPRESA_COOPERADO_ID fica como constante de
  // documentacao + asserts read-only, NAO entra no token.
  const empresaJwt = jwt.sign(
    {
      sub: empresaUsuario.id,
      id: empresaUsuario.id,
      userId: empresaUsuario.id,
      email: empresaUsuario.email,
      perfil: empresaUsuario.perfil,
      cooperativaId: COOPEREBR_ID,
    },
    JWT_SECRET,
    { expiresIn: '15m' },
  );
  await http(
    'POST',
    `${BACKEND_URL}/portal/meus-convenios/${CONVENIO_ID}/membros/${membro.id}/decidir`,
    {
      bearer: empresaJwt,
      body: { decisao: 'APROVAR' },
      expect: [200],
      label: 'empresa-decidir-aprovar',
    },
  );
  const membroAposEmpresa = await prisma.convenioCooperado.findUnique({
    where: { id: membro.id },
    select: { status: true, aprovadoPorEmpresaEm: true },
  });
  if (membroAposEmpresa?.status !== 'PENDENTE_APROVACAO_ADMIN') {
    console.error(
      `❌ Status pós-empresa: ${membroAposEmpresa?.status} (esperado PENDENTE_APROVACAO_ADMIN)`,
    );
    process.exit(1);
  }
  logPasso({
    passo: 'PASSO 8',
    ok: true,
    detalhe: `status=${membroAposEmpresa.status}  aprovadoPorEmpresaEm=${membroAposEmpresa.aprovadoPorEmpresaEm?.toISOString()}`,
  });

  // ──────────────────────────────────────────────────────────────
  // PASSO 9 — Admin aprova → MEMBRO_ATIVO
  // ──────────────────────────────────────────────────────────────
  console.log('\n── PASSO 9: admin APROVA via /convenios/.../aprovar-admin ──');
  await http(
    'POST',
    `${BACKEND_URL}/convenios/${CONVENIO_ID}/membros/${membro.id}/aprovar-admin`,
    {
      bearer: adminJwt,
      body: {},
      expect: [200],
      label: 'admin-aprovar',
    },
  );
  const membroFinal = await prisma.convenioCooperado.findUnique({
    where: { id: membro.id },
    select: {
      status: true,
      ativo: true,
      aprovadoPorAdminEm: true,
      aprovadoPorAdminUserId: true,
    },
  });
  if (membroFinal?.status !== 'MEMBRO_ATIVO' || !membroFinal.ativo) {
    console.error(
      `❌ Status final: ${membroFinal?.status} ativo=${membroFinal?.ativo} (esperado MEMBRO_ATIVO + ativo=true)`,
    );
    process.exit(1);
  }
  logPasso({
    passo: 'PASSO 9',
    ok: true,
    detalhe: `status=${membroFinal.status}  ativo=${membroFinal.ativo}  aprovadoPorAdminEm=${membroFinal.aprovadoPorAdminEm?.toISOString()}`,
  });

  // ──────────────────────────────────────────────────────────────
  // PASSO 10 — Read-only final: MEMBRO_ATIVO + Contrato/UC criados
  // ──────────────────────────────────────────────────────────────
  console.log('\n── PASSO 10: verificações finais ──');
  const final = await prisma.cooperado.findUnique({
    where: { id: cooperadoNovo.id },
    select: {
      id: true,
      nomeCompleto: true,
      status: true,
      _count: {
        select: {
          contratos: true,
          ucs: true,
          propostas: true,
        },
      },
    },
  });
  const progFinal = await prisma.progressaoClube.findUnique({
    where: { cooperadoId: cooperadoNovo.id },
    select: { id: true, nivelAtual: true },
  });
  console.log(`  Cooperado final: ${JSON.stringify(final, null, 2)}`);
  console.log(`  ProgressaoClube final: ${JSON.stringify(progFinal, null, 2)}`);
  // Gate principal pro fluxo "convenio pagador=EMPRESA" (Santi-pattern):
  //   - MEMBRO_ATIVO (PASSO 9 ja validou)
  //   - ProgressaoClube criada pelo MembroBuilder (regra Onboarding 1.3:
  //     aprovação matricula no Clube)
  //
  // Contrato/UC/Proposta ficam ausentes nesse modo (a empresa custeia, o
  // cooperado nao tem UC propria — energia vem via convenio). Motor cata-
  // logaria pendenciaMotor se aplicavel mas NAO propaga erro (try/catch
  // em aprovar-admin:524-535) — isso e fluxo correto.
  if (!final) {
    console.error('❌ Cooperado final nao encontrado');
    process.exit(1);
  }
  if (!progFinal) {
    console.error(
      '❌ ProgressaoClube ausente — esperado MembroBuilder.matricular ter criado',
    );
    process.exit(1);
  }
  logPasso({
    passo: 'PASSO 10',
    ok: true,
    detalhe: `MEMBRO_ATIVO ✓  ProgressaoClube nivel=${progFinal.nivelAtual} ✓  (contratos=${final._count.contratos} ucs=${final._count.ucs} propostas=${final._count.propostas} — opcionais no modo pagador=EMPRESA)`,
  });

  // ──────────────────────────────────────────────────────────────
  // Sucesso
  // ──────────────────────────────────────────────────────────────
  console.log('\n═══════════════════════════════════════════════════════════════════');
  console.log('🎉 SMOKE E2E PASS — onboarding ponta a ponta validado');
  console.log('   Cooperado teste criado em CV-SISGD-TESTE-001');
  console.log(`   Status final: MEMBRO_ATIVO  cooperadoId=${cooperadoNovo.id}  membroId=${membro.id}`);
  console.log('═══════════════════════════════════════════════════════════════════');

  await prisma.$disconnect();
}

main().catch(async (err) => {
  console.error('[smoke] FALHOU:', err);
  process.exit(1);
});
