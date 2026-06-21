/**
 * Smoke E2E REAL — Sprint Convênio MIGRAÇÃO M47 (21/06/2026).
 *
 * Exigência re-review orquestrador (precedente D-novo-WA-DEV-FALSE-OK):
 * - Cooperado-teste whitelist 27981341348 + CoopereBR
 * - Chamar /migrar (iniciar) + /migrar/concluir REAIS via HTTP
 * - Confirmar status PENDENTE_MIGRACAO → ATIVO no banco
 * - Confirmar MigracaoUsina.statusMigracao PENDENTE → CONCLUIDA
 * - **VALIDAR que WA SAIU DE VERDADE** (MensagemWhatsapp.status='ENVIADA')
 *
 * Cleanup idempotente (deleta MigracaoUsina + cooperado smoke).
 */
import { PrismaClient } from '@prisma/client';
import * as jwt from 'jsonwebtoken';
import * as dotenv from 'dotenv';
import * as path from 'node:path';

dotenv.config({ path: path.resolve(__dirname, '..', '.env') });

if (process.env.NODE_ENV === 'production' && process.env.SMOKE_FORCE_PROD !== 'true') {
  console.error('[ABORT] Smoke não roda em produção sem SMOKE_FORCE_PROD=true');
  process.exit(1);
}

const API = process.env.API ?? 'http://localhost:3000';
const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET) {
  console.error('JWT_SECRET nao encontrado no .env');
  process.exit(1);
}

const COOPEREBR_ID = 'cmn0ho8bx0000uox8wu96u6fd';
const TELEFONE_WHITELIST = '27981341348';
const CPF_SMOKE = '88877766622';
const EMAIL_SMOKE = 'lucbragatto+smoke-m47-migracao@gmail.com';
const SMOKE_INICIO = new Date();

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

async function main() {
  const prisma = new PrismaClient();
  let passou = false;
  let cooperadoIdCriado: string | null = null;

  try {
    // ── Pré-cleanup ──
    await prisma.migracaoUsina.deleteMany({
      where: {
        cooperado: { cpf: CPF_SMOKE },
        tipo: 'DISTRIBUIDORA_EXTERNA',
      },
    });
    await prisma.cooperado.deleteMany({
      where: { cpf: CPF_SMOKE, cooperativaId: COOPEREBR_ID },
    });

    // ── Setup cooperado-teste whitelist ──
    const cooperado = await prisma.cooperado.create({
      data: {
        nomeCompleto: 'SMOKE M47 Migracao',
        cpf: CPF_SMOKE,
        email: EMAIL_SMOKE,
        telefone: TELEFONE_WHITELIST,
        cooperativaId: COOPEREBR_ID,
        status: 'ATIVO',
        ambienteTeste: true,
        tipoCooperado: 'SEM_UC',
      },
      select: { id: true, status: true },
    });
    cooperadoIdCriado = cooperado.id;
    console.log(`✓ Cooperado-teste criado: ${cooperado.id} (status=${cooperado.status})`);

    // ── Busca um Usuario ADMIN da CoopereBR pra JWT ──
    const usuarioAdmin = await prisma.usuario.findFirst({
      where: { cooperativaId: COOPEREBR_ID, perfil: 'ADMIN', ativo: true },
      select: { id: true },
    });
    if (!usuarioAdmin) {
      console.error('[ABORT] Nenhum usuário ADMIN ativo na CoopereBR');
      process.exit(1);
    }
    const token = jwt.sign({
      sub: usuarioAdmin.id,
      id: usuarioAdmin.id,
      email: 'admin-smoke@test.com',
      perfil: 'ADMIN',
      cooperativaId: COOPEREBR_ID,
    }, JWT_SECRET!, { expiresIn: '1h' });

    // ─── Etapa 1: POST /migrar (iniciar) ───
    console.log('\n[1] POST /cooperados/:id/migrar');
    const r1 = await call('POST', `/cooperados/${cooperado.id}/migrar`, {
      token,
      body: {
        distribuidoraOrigem: 'Cooperativa Concorrente XYZ (smoke)',
        motivo: 'Smoke E2E M47',
      },
    });
    if (r1.status !== 201 && r1.status !== 200) {
      console.error(`✗ /migrar retornou ${r1.status}: ${JSON.stringify(r1.json).slice(0, 200)}`);
      process.exit(1);
    }
    if (r1.json.status !== 'PENDENTE') {
      console.error(`✗ resp.status='${r1.json.status}' (esperado 'PENDENTE')`);
      process.exit(1);
    }
    console.log(`  ✓ migracaoId=${r1.json.migracaoId} status=PENDENTE`);

    // Confirma estado no banco
    const cooperadoApos = await prisma.cooperado.findUnique({
      where: { id: cooperado.id },
      select: { status: true },
    });
    if (cooperadoApos?.status !== 'PENDENTE_MIGRACAO') {
      console.error(`✗ cooperado.status='${cooperadoApos?.status}' (esperado 'PENDENTE_MIGRACAO')`);
      process.exit(1);
    }
    console.log(`  ✓ Cooperado.status='PENDENTE_MIGRACAO' no banco`);

    // ── Etapa 1.b: validar WA REAL (D-novo-WA-DEV-FALSE-OK) ──
    await new Promise((r) => setTimeout(r, 4000));
    const wa1 = await prisma.mensagemWhatsapp.findFirst({
      where: {
        telefone: TELEFONE_WHITELIST,
        tipoDisparo: 'MIGRACAO_EXTERNA_INICIADA',
        createdAt: { gte: SMOKE_INICIO },
      },
      orderBy: { createdAt: 'desc' },
      select: { id: true, status: true, conteudo: true },
    });
    if (!wa1) {
      console.error('✗ Nenhuma MensagemWhatsapp INICIADA gravada — WA SILENCIOSO');
      process.exit(1);
    }
    if (wa1.status !== 'ENVIADA') {
      console.error(`✗ WA INICIADA.status='${wa1.status}' (esperado 'ENVIADA')`);
      process.exit(1);
    }
    console.log(`  ✓ WA INICIADA enviada — status=${wa1.status}`);
    console.log(`    [texto] ${wa1.conteudo?.slice(0, 100)}...`);

    // ─── Etapa 2: POST /migrar/concluir ───
    console.log('\n[2] POST /cooperados/:id/migrar/concluir');
    const r2 = await call('POST', `/cooperados/${cooperado.id}/migrar/concluir`, { token });
    if (r2.status !== 201 && r2.status !== 200) {
      console.error(`✗ /migrar/concluir retornou ${r2.status}: ${JSON.stringify(r2.json).slice(0, 200)}`);
      process.exit(1);
    }
    if (r2.json.status !== 'CONCLUIDA') {
      console.error(`✗ resp.status='${r2.json.status}' (esperado 'CONCLUIDA')`);
      process.exit(1);
    }
    console.log(`  ✓ migracaoId=${r2.json.migracaoId} status=CONCLUIDA`);

    const cooperadoFinal = await prisma.cooperado.findUnique({
      where: { id: cooperado.id },
      select: { status: true },
    });
    if (cooperadoFinal?.status !== 'ATIVO') {
      console.error(`✗ cooperado.status='${cooperadoFinal?.status}' (esperado 'ATIVO' após concluir)`);
      process.exit(1);
    }
    console.log(`  ✓ Cooperado.status voltou pra 'ATIVO'`);

    const mig = await prisma.migracaoUsina.findUnique({
      where: { id: r1.json.migracaoId },
      select: { statusMigracao: true, dataDesligamentoEfetivo: true },
    });
    if (mig?.statusMigracao !== 'CONCLUIDA') {
      console.error(`✗ MigracaoUsina.statusMigracao='${mig?.statusMigracao}' (esperado CONCLUIDA)`);
      process.exit(1);
    }
    if (!mig?.dataDesligamentoEfetivo) {
      console.error('✗ dataDesligamentoEfetivo não setada');
      process.exit(1);
    }
    console.log(`  ✓ MigracaoUsina.statusMigracao='CONCLUIDA' + dataDesligamentoEfetivo setada`);

    // ── Etapa 2.b: validar WA CONCLUIDA REAL ──
    await new Promise((r) => setTimeout(r, 4000));
    const wa2 = await prisma.mensagemWhatsapp.findFirst({
      where: {
        telefone: TELEFONE_WHITELIST,
        tipoDisparo: 'MIGRACAO_EXTERNA_CONCLUIDA',
        createdAt: { gte: SMOKE_INICIO },
      },
      orderBy: { createdAt: 'desc' },
      select: { id: true, status: true, conteudo: true },
    });
    if (!wa2) {
      console.error('✗ Nenhuma MensagemWhatsapp CONCLUIDA gravada — WA SILENCIOSO');
      process.exit(1);
    }
    if (wa2.status !== 'ENVIADA') {
      console.error(`✗ WA CONCLUIDA.status='${wa2.status}' (esperado 'ENVIADA')`);
      process.exit(1);
    }
    console.log(`  ✓ WA CONCLUIDA enviada — status=${wa2.status}`);
    console.log(`    [texto] ${wa2.conteudo?.slice(0, 100)}...`);

    console.log('\n✓ SMOKE M47 PASSOU — ciclo completo iniciar → concluir + 2x WA reais (whitelist)');
    passou = true;

  } catch (err) {
    console.error('[FATAL]', err);
  } finally {
    console.log('\n[CLEANUP]');
    if (cooperadoIdCriado) {
      await prisma.migracaoUsina.deleteMany({
        where: { cooperadoId: cooperadoIdCriado, tipo: 'DISTRIBUIDORA_EXTERNA' },
      });
      await prisma.cooperado.delete({ where: { id: cooperadoIdCriado } }).catch(() => {});
    }
    await prisma.$disconnect();
    process.exit(passou ? 0 : 1);
  }
}

main();
