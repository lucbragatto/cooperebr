/**
 * Smoke E2E — Sprint Convênio FUNDAÇÃO (21/06/2026) — E1 desligamento real.
 *
 * Caminho mínimo aceitável (re-review orquestrador 21/06):
 * - Pré-condição: contato whitelist 27981341348 + cooperativa CoopereBR.
 * - Setup: cria cooperado-teste com telefone whitelist + saldo pequeno + vínculo
 *   ATIVO em convênio existente da CoopereBR.
 * - Trigger: chama ConveniosMembrosService.removerMembro real (não mock).
 * - Validação: query MensagemWhatsapp por (tipoDisparo='CONVENIO_DESLIGAMENTO_E1',
 *   disparoId=`{convenioId}:{cooperadoId}`). Espera status='ENVIADA'.
 *   Reporta o texto persistido (que é exatamente o que foi enviado).
 *
 * D-novo-WA-DEV-FALSE-OK precedente: WA service via `fetch` /send-message já
 * teve falso-positivo silencioso. Este smoke chega LITERALMENTE ao WA service
 * (http://localhost:3002/send-message), e o MensagemWhatsapp.status='ENVIADA' só
 * é gravado se `res.ok === true` retornou do baileys real (linha 114-123 do
 * whatsapp-sender.service.ts).
 *
 * Cleanup ao final (idempotente): apaga vínculo + saldo + cooperado smoke se
 * criados nesta execução.
 */
import { PrismaClient } from '@prisma/client';
import { NestFactory } from '@nestjs/core';
import { AppModule } from '../src/app.module';
import { ConveniosMembrosService } from '../src/convenios/convenios-membros.service';
import * as dotenv from 'dotenv';
import * as path from 'node:path';

dotenv.config({ path: path.resolve(__dirname, '..', '.env') });

if (process.env.NODE_ENV === 'production' && process.env.SMOKE_FORCE_PROD !== 'true') {
  console.error('[ABORT] Smoke não roda em produção sem SMOKE_FORCE_PROD=true');
  process.exit(1);
}

const COOPEREBR_ID = 'cmn0ho8bx0000uox8wu96u6fd';
const TELEFONE_WHITELIST = '27981341348';
const CPF_SMOKE = '88877766611';
const EMAIL_SMOKE = 'lucbragatto+smoke-e1-desligamento@gmail.com';
const SMOKE_INICIO = new Date();

async function main() {
  const prisma = new PrismaClient();

  // ── Boot Nest app pra usar o service real (não Prisma raw) ──
  const app = await NestFactory.createApplicationContext(AppModule, { logger: false });
  const membrosService = app.get(ConveniosMembrosService);

  let passou = false;
  let cooperadoIdCriado: string | null = null;
  let vinculoIdCriado: string | null = null;

  try {
    // ── Pré-cleanup idempotente ──
    await prisma.convenioCooperado.deleteMany({
      where: {
        cooperado: { cpf: CPF_SMOKE },
      },
    });
    await prisma.cooperTokenSaldo.deleteMany({
      where: { cooperado: { cpf: CPF_SMOKE } },
    });
    await prisma.cooperado.deleteMany({
      where: { cpf: CPF_SMOKE, cooperativaId: COOPEREBR_ID },
    });

    // ── Buscar convênio ATIVO da CoopereBR ──
    const convenio = await prisma.contratoConvenio.findFirst({
      where: { cooperativaId: COOPEREBR_ID, status: 'ATIVO' },
      select: { id: true, empresaNome: true },
    });
    if (!convenio) {
      console.error('[ABORT] Nenhum convênio ATIVO encontrado em CoopereBR');
      process.exit(1);
    }
    console.log(`✓ Convênio encontrado: ${convenio.empresaNome} (${convenio.id})`);

    // ── Criar cooperado teste com telefone whitelist ──
    const cooperado = await prisma.cooperado.create({
      data: {
        nomeCompleto: 'SMOKE E1 Desligamento',
        cpf: CPF_SMOKE,
        email: EMAIL_SMOKE,
        telefone: TELEFONE_WHITELIST,
        cooperativaId: COOPEREBR_ID,
        status: 'ATIVO',
        ambienteTeste: true,
        tipoCooperado: 'SEM_UC',
      },
      select: { id: true, nomeCompleto: true },
    });
    cooperadoIdCriado = cooperado.id;
    console.log(`✓ Cooperado-teste criado: ${cooperado.nomeCompleto} (${cooperado.id})`);

    // ── Criar saldo pequeno (50 tokens ≈ R$ 22,50 com 0.45) ──
    await prisma.cooperTokenSaldo.create({
      data: {
        cooperadoId: cooperado.id,
        cooperativaId: COOPEREBR_ID,
        saldoDisponivel: 50,
        totalEmitido: 50,
      },
    });
    console.log(`✓ Saldo seed: 50 tokens`);

    // ── Criar vínculo ATIVO no convênio ──
    const vinculo = await prisma.convenioCooperado.create({
      data: {
        convenioId: convenio.id,
        cooperadoId: cooperado.id,
        ativo: true,
        status: 'MEMBRO_ATIVO',
      },
      select: { id: true },
    });
    vinculoIdCriado = vinculo.id;
    console.log(`✓ Vínculo MEMBRO_ATIVO criado em ${convenio.empresaNome}`);

    // ── TRIGGER: removerMembro real (caminho service + listener + WA) ──
    console.log(`\n→ Disparando removerMembro real...`);
    await membrosService.removerMembro(convenio.id, cooperado.id);
    console.log(`✓ removerMembro retornou`);

    // ── Validação: MensagemWhatsapp gravada com status ENVIADA? ──
    // Espera ~1s pra dar tempo do registro pós-envio.
    await new Promise((r) => setTimeout(r, 1500));

    const msg = await prisma.mensagemWhatsapp.findFirst({
      where: {
        tipoDisparo: 'CONVENIO_DESLIGAMENTO_E1',
        disparoId: `${convenio.id}:${cooperado.id}`,
        cooperativaId: COOPEREBR_ID,
      },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true, telefone: true, status: true, conteudo: true,
        tipoDisparo: true, disparoId: true, enviadaEm: true,
      },
    });

    if (!msg) {
      console.error(`✗ NENHUMA MensagemWhatsapp gravada — listener/envio falhou silencioso`);
      process.exit(1);
    }

    console.log(`\n═══ MENSAGEM GRAVADA ═══`);
    console.log(`id: ${msg.id}`);
    console.log(`telefone: ${msg.telefone}`);
    console.log(`status: ${msg.status}`);
    console.log(`tipoDisparo: ${msg.tipoDisparo}`);
    console.log(`disparoId: ${msg.disparoId}`);
    console.log(`enviadaEm: ${msg.enviadaEm?.toISOString()}`);
    console.log(`────── TEXTO ──────`);
    console.log(msg.conteudo);
    console.log(`────────────────────`);

    if (msg.status !== 'ENVIADA') {
      console.error(`\n✗ status='${msg.status}' (esperado 'ENVIADA') — WA service rejeitou`);
      process.exit(1);
    }
    if (msg.telefone !== TELEFONE_WHITELIST && !msg.telefone.endsWith(TELEFONE_WHITELIST)) {
      console.error(`\n✗ telefone='${msg.telefone}' (esperado conter '${TELEFONE_WHITELIST}')`);
      process.exit(1);
    }
    if (!msg.conteudo?.includes('Desligamento do convênio')) {
      console.error(`\n✗ conteúdo não bate com template E1`);
      process.exit(1);
    }

    console.log(`\n✓ SMOKE E1 PASSOU — WA real enviado pra ${TELEFONE_WHITELIST} (whitelist)`);
    passou = true;

  } catch (err) {
    console.error(`\n[ERRO]`, err);
  } finally {
    // ── Cleanup ──
    console.log(`\n[CLEANUP] Removendo dados smoke`);
    if (vinculoIdCriado) {
      await prisma.convenioCooperado.delete({ where: { id: vinculoIdCriado } }).catch(() => {});
    }
    if (cooperadoIdCriado) {
      await prisma.cooperTokenSaldo.delete({ where: { cooperadoId: cooperadoIdCriado } }).catch(() => {});
      await prisma.cooperado.delete({ where: { id: cooperadoIdCriado } }).catch(() => {});
    }
    await prisma.$disconnect();
    await app.close();
    process.exit(passou ? 0 : 1);
  }
}

main().catch(async (e) => {
  console.error('[FATAL]', e);
  process.exit(1);
});
