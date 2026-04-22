/**
 * Sprint 7 — Criação em batch de AsaasCustomer para cooperados ATIVO.
 *
 * PRÉ-REQUISITOS para rodar --real:
 *   1. Conta Asaas aberta (sandbox ou produção)
 *   2. API key cadastrada em AsaasConfig via tela /dashboard/configuracoes/asaas
 *   3. Ambiente configurado (SANDBOX ou PRODUCAO) na mesma tela
 *   4. Testar primeiro com 1 cooperado isolado via POST /asaas/customer/criar
 *   5. ASAAS_ENCRYPT_KEY definida no .env (pra decrypt da API key)
 *
 * Modos:
 *   npx ts-node scripts/asaas-criar-customers-batch.ts --dry-run   (simula, não chama API)
 *   npx ts-node scripts/asaas-criar-customers-batch.ts --real       (executa de verdade)
 *
 * Sem flag = erro (obriga escolha explícita).
 *
 * Comportamento:
 *   - Busca cooperados ATIVO da CoopereBR com CPF/CNPJ + email válidos
 *   - Pula quem já tem AsaasCustomer (idempotente)
 *   - Processa em batches de 10 com pausa de 2s entre batches
 *   - Se qualquer erro no batch, PARA e reporta
 *   - Grava log em backend/logs/asaas-customers-<timestamp>.json
 */

import { NestFactory } from '@nestjs/core';
import { AppModule } from '../src/app.module';
import { AsaasService } from '../src/asaas/asaas.service';
import { PrismaService } from '../src/prisma.service';
import * as fs from 'fs';
import * as path from 'path';

const COOPEREBR_ID = 'cmn0ho8bx0000uox8wu96u6fd';
const BATCH_SIZE = 10;
const PAUSE_MS = 2000;

type Modo = 'DRY_RUN' | 'REAL';

interface LogEntry {
  cooperadoId: string;
  nome: string;
  cpf: string;
  resultado: 'CRIADO' | 'JA_EXISTE' | 'PULADO_DRYRUN' | 'ERRO';
  asaasId?: string;
  erro?: string;
  timestamp: string;
}

function bold(s: string) { return `\x1b[1m${s}\x1b[0m`; }
function red(s: string) { return `\x1b[31m${s}\x1b[0m`; }
function green(s: string) { return `\x1b[32m${s}\x1b[0m`; }
function yellow(s: string) { return `\x1b[33m${s}\x1b[0m`; }
function gray(s: string) { return `\x1b[90m${s}\x1b[0m`; }

function parseArgs(): Modo {
  const args = process.argv.slice(2);
  if (args.includes('--real')) return 'REAL';
  if (args.includes('--dry-run')) return 'DRY_RUN';
  console.error(red('Uso: npx ts-node scripts/asaas-criar-customers-batch.ts --dry-run | --real'));
  process.exit(1);
}

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function main() {
  const modo = parseArgs();
  console.log(bold(`\n=== Asaas Customer Batch — modo: ${modo} ===\n`));

  console.log(gray('Subindo contexto Nest...'));
  const app = await NestFactory.createApplicationContext(AppModule, {
    logger: ['error', 'warn'],
  });
  const prisma = app.get(PrismaService);
  const asaas = app.get(AsaasService);

  // Buscar cooperados aptos
  const cooperados = await prisma.cooperado.findMany({
    where: { cooperativaId: COOPEREBR_ID, status: 'ATIVO' },
    select: {
      id: true,
      nomeCompleto: true,
      cpf: true,
      email: true,
      telefone: true,
      tipoPessoa: true,
    },
    orderBy: { nomeCompleto: 'asc' },
  });

  // Filtrar aptos (CPF/CNPJ válido + email)
  const aptos = cooperados.filter(c => {
    const limpo = (c.cpf || '').replace(/\D/g, '');
    const ehPJ = c.tipoPessoa === 'PJ';
    const cpfOk = ehPJ ? limpo.length === 14 : limpo.length === 11;
    const emailOk = c.email && c.email.includes('@');
    return cpfOk && emailOk;
  });

  // Verificar quem já tem AsaasCustomer
  const existentes = await prisma.asaasCustomer.findMany({
    where: { cooperadoId: { in: aptos.map(c => c.id) } },
    select: { cooperadoId: true },
  });
  const jaTemAsaas = new Set(existentes.map(e => e.cooperadoId));

  const pendentes = aptos.filter(c => !jaTemAsaas.has(c.id));

  console.log(`Cooperados ATIVO: ${cooperados.length}`);
  console.log(`Aptos (CPF+email válidos): ${aptos.length}`);
  console.log(`Já tem AsaasCustomer: ${jaTemAsaas.size}`);
  console.log(bold(`Pendentes para criar: ${pendentes.length}`));

  const totalBatches = Math.ceil(pendentes.length / BATCH_SIZE);
  const tempoEstimado = totalBatches > 1 ? (totalBatches - 1) * PAUSE_MS / 1000 : 0;
  console.log(`Batches: ${totalBatches} (${BATCH_SIZE} por batch)`);
  console.log(`Tempo estimado: ~${tempoEstimado}s (pausas entre batches)\n`);

  if (pendentes.length === 0) {
    console.log(green('Nada a fazer — todos já têm AsaasCustomer ou não há pendentes.'));
    await app.close();
    process.exit(0);
  }

  // Exemplo de payload do primeiro cooperado
  const exemplo = pendentes[0];
  console.log(bold('Exemplo de payload (1o cooperado):'));
  console.log(JSON.stringify({
    name: exemplo.nomeCompleto,
    cpfCnpj: (exemplo.cpf || '').replace(/\D/g, ''),
    email: exemplo.email,
    phone: exemplo.telefone || null,
  }, null, 2));
  console.log('');

  // Log
  const logEntries: LogEntry[] = [];
  const logDir = path.resolve(__dirname, '../logs');
  if (!fs.existsSync(logDir)) fs.mkdirSync(logDir, { recursive: true });
  const logPath = path.join(logDir, `asaas-customers-${new Date().toISOString().replace(/[:.]/g, '-')}.json`);

  let criados = 0;
  let erros = 0;
  let pulados = 0;

  for (let b = 0; b < totalBatches; b++) {
    const batch = pendentes.slice(b * BATCH_SIZE, (b + 1) * BATCH_SIZE);
    console.log(bold(`Batch ${b + 1}/${totalBatches} (${batch.length} cooperados)`));

    for (const c of batch) {
      const entry: LogEntry = {
        cooperadoId: c.id,
        nome: c.nomeCompleto,
        cpf: (c.cpf || '').replace(/\D/g, ''),
        resultado: 'PULADO_DRYRUN',
        timestamp: new Date().toISOString(),
      };

      try {
        if (modo === 'DRY_RUN') {
          entry.resultado = 'PULADO_DRYRUN';
          pulados++;
          console.log(yellow(`  [DRY] ${c.nomeCompleto.substring(0, 40)}`));
        } else {
          const customer = await asaas.criarOuBuscarCustomer(c.id, COOPEREBR_ID);
          entry.resultado = 'CRIADO';
          entry.asaasId = customer.asaasId;
          criados++;
          console.log(green(`  [OK]  ${c.nomeCompleto.substring(0, 40)} → ${customer.asaasId}`));
        }
      } catch (err: any) {
        entry.resultado = 'ERRO';
        entry.erro = err.message || String(err);
        erros++;
        console.log(red(`  [ERR] ${c.nomeCompleto.substring(0, 40)}: ${entry.erro}`));

        // Se erro, PARA o batch inteiro
        logEntries.push(entry);
        fs.writeFileSync(logPath, JSON.stringify(logEntries, null, 2) + '\n');
        console.error(red(bold(`\nBatch ${b + 1} falhou. Parando execução.`)));
        console.log(gray(`Log salvo: ${logPath}`));
        await app.close();
        process.exit(2);
      }

      logEntries.push(entry);
    }

    // Pausa entre batches (exceto no último)
    if (b < totalBatches - 1) {
      console.log(gray(`  pausa ${PAUSE_MS / 1000}s...`));
      await sleep(PAUSE_MS);
    }
  }

  // Salvar log
  fs.writeFileSync(logPath, JSON.stringify(logEntries, null, 2) + '\n');

  console.log(bold('\n=== RESUMO ==='));
  console.log(`  ${green(String(criados))} criados`);
  console.log(`  ${yellow(String(pulados))} pulados (dry-run)`);
  console.log(`  ${red(String(erros))} erros`);
  console.log(gray(`  Log: ${logPath}`));

  await app.close();
  process.exit(erros > 0 ? 2 : 0);
}

main().catch(err => {
  console.error(red(`Erro fatal: ${err.message}`));
  process.exit(1);
});
