/**
 * Processa faturas POR COOPERADO — V2 (busca por UC, não por email do cooperado).
 *
 * CORREÇÃO V2 (Luciano 14/06/2026): a EDP envia faturas DE `*@edp.com.br`
 * PARA `contato@cooperebr.com.br`. A busca correta é pelo número da UC do
 * cooperado (que aparece no SUBJECT ou BODY do email), NÃO pelo email do
 * cooperado como remetente.
 *
 * Estratégia:
 *   1. Lista cooperados ATIVOS sem FaturaProcessada (regra "1 por pessoa")
 *   2. Pra cada cooperado, lista UCs dele (numero / numeroUC / numeroConcessionariaOriginal)
 *   3. Pra cada UC, SEARCH no IMAP por (SUBJECT OR BODY contains número-uc)
 *   4. Pega email mais recente, baixa 1º anexo PDF, chama uploadConcessionaria
 *   5. NUNCA messageMove (deixa CRON 6h normal cuidar disso)
 *   6. Checkpoint JSON pra retomar.
 *
 * Executar:
 *   cd C:\Users\Luciano\cooperebr\backend
 *   npx ts-node scripts/processar-faturas-por-cooperado.ts
 */

import 'dotenv/config';
import { NestFactory } from '@nestjs/core';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma.service';
import { FaturasService } from '../src/faturas/faturas.service';
import { ImapFlow } from 'imapflow';
import { simpleParser } from 'mailparser';
import * as fs from 'fs';
import * as path from 'path';

const CHECKPOINT_PATH = path.join(
  __dirname,
  '..',
  '..',
  'docs',
  'concierge',
  'wip',
  'processar-checkpoint.json',
);

interface Checkpoint {
  iniciadoEm: string;
  cooperadosProcessados: string[];
  ultimaAtualizacao: string;
}

function lerCheckpoint(): Checkpoint {
  try {
    return JSON.parse(fs.readFileSync(CHECKPOINT_PATH, 'utf-8')) as Checkpoint;
  } catch {
    return {
      iniciadoEm: new Date().toISOString(),
      cooperadosProcessados: [],
      ultimaAtualizacao: new Date().toISOString(),
    };
  }
}

function salvarCheckpoint(cp: Checkpoint): void {
  cp.ultimaAtualizacao = new Date().toISOString();
  fs.mkdirSync(path.dirname(CHECKPOINT_PATH), { recursive: true });
  fs.writeFileSync(CHECKPOINT_PATH, JSON.stringify(cp, null, 2));
}

/**
 * Lista os possiveis numeros de identificacao da UC pra buscar no IMAP.
 * Filtra nulls e duplicatas. Normaliza removendo pontos/hifens/espaços
 * pra match mais flexivel.
 */
function numerosBuscaveis(uc: {
  numero?: string | null;
  numeroUC?: string | null;
  numeroConcessionariaOriginal?: string | null;
}): string[] {
  const set = new Set<string>();
  const candidatos = [uc.numero, uc.numeroUC, uc.numeroConcessionariaOriginal];
  for (const c of candidatos) {
    if (!c) continue;
    const limpo = c.trim();
    if (limpo.length >= 6) set.add(limpo);
    // Sem pontuação
    const semPontos = limpo.replace(/[.\-\s]/g, '');
    if (semPontos.length >= 6) set.add(semPontos);
  }
  return Array.from(set);
}

async function main(): Promise<void> {
  console.log('\n=== PROCESSAR FATURAS POR COOPERADO V2 (busca por UC) ===\n');
  const app = await NestFactory.createApplicationContext(AppModule, {
    logger: ['error', 'warn'],
  });
  const prisma = app.get(PrismaService);
  const faturasService = app.get(FaturasService);

  const candidatas = await prisma.cooperativa.findMany({
    where: { nome: { contains: 'CoopereBR', mode: 'insensitive' } },
    select: { id: true, nome: true, _count: { select: { cooperados: true } } },
  });
  const coop = candidatas.reduce((max, atual) =>
    atual._count.cooperados > max._count.cooperados ? atual : max,
  );
  console.log(`Cooperativa: ${coop.nome} (id=${coop.id})`);

  // IMAP config (mesmo padrão do EmailMonitorService)
  const cfgs = await prisma.configTenant.findMany({
    where: {
      cooperativaId: coop.id,
      chave: { in: ['email.monitor.user', 'email.monitor.pass', 'email.monitor.host', 'email.monitor.port'] },
    },
    select: { chave: true, valor: true },
  });
  const cfgMap = new Map(cfgs.map((c) => [c.chave, c.valor]));
  const imapUser = cfgMap.get('email.monitor.user') ?? process.env.EMAIL_IMAP_USER;
  const imapPassRaw = cfgMap.get('email.monitor.pass') ?? process.env.EMAIL_IMAP_PASS ?? '';
  const imapPass = cfgMap.has('email.monitor.pass')
    ? Buffer.from(imapPassRaw, 'base64').toString('utf-8')
    : imapPassRaw;
  const imapHost = cfgMap.get('email.monitor.host') ?? process.env.EMAIL_IMAP_HOST ?? 'imap.gmail.com';
  const imapPort = parseInt(
    cfgMap.get('email.monitor.port') ?? process.env.EMAIL_IMAP_PORT ?? '993',
    10,
  );

  if (!imapUser || !imapPass) {
    console.error('Credenciais IMAP nao configuradas. Abortando.');
    await app.close();
    return;
  }

  console.log(`IMAP: ${imapUser}@${imapHost}:${imapPort}\n`);

  // Cooperados sem fatura, com UCs vinculadas
  const cooperados = await prisma.cooperado.findMany({
    where: {
      cooperativaId: coop.id,
      status: 'ATIVO' as never,
      faturasProcessadas: { none: {} },
      ucs: { some: {} },
    },
    select: {
      id: true,
      nomeCompleto: true,
      ucs: {
        select: {
          numero: true,
          numeroUC: true,
          numeroConcessionariaOriginal: true,
        },
      },
    },
    orderBy: { nomeCompleto: 'asc' },
  });

  console.log(`Cooperados ATIVOS sem fatura + com UC: ${cooperados.length}\n`);

  const checkpoint = lerCheckpoint();
  const jaProcessados = new Set(checkpoint.cooperadosProcessados);
  if (jaProcessados.size > 0) {
    console.log(`Checkpoint: ${jaProcessados.size} cooperados ja tratados em corridas anteriores\n`);
  }

  let processados = 0;
  let semFaturaInbox = 0;
  let semUcBuscavel = 0;
  let erros = 0;
  let pulados = 0;
  const inicio = Date.now();

  for (let i = 0; i < cooperados.length; i++) {
    const c = cooperados[i];
    if (jaProcessados.has(c.id)) {
      pulados++;
      continue;
    }
    const progresso = `[${i + 1}/${cooperados.length}]`;
    process.stdout.write(`${progresso} ${c.nomeCompleto.slice(0, 38).padEnd(38)} ... `);

    // Coletar todos os números de UC buscáveis do cooperado
    const ucsBusca: Array<{ numeros: string[] }> = [];
    for (const uc of c.ucs) {
      const nums = numerosBuscaveis(uc);
      if (nums.length > 0) ucsBusca.push({ numeros: nums });
    }
    if (ucsBusca.length === 0) {
      semUcBuscavel++;
      console.log(`(sem UC com numero buscavel)`);
      checkpoint.cooperadosProcessados.push(c.id);
      salvarCheckpoint(checkpoint);
      continue;
    }

    let client: ImapFlow | null = null;
    try {
      client = new ImapFlow({
        host: imapHost,
        port: imapPort,
        secure: true,
        auth: { user: imapUser, pass: imapPass },
        logger: false,
        tls: { rejectUnauthorized: false },
        socketTimeout: 60 * 1000,
        greetingTimeout: 30 * 1000,
      });

      const trabalho = (async (): Promise<{ ok: boolean; motivo: string }> => {
        await client!.connect();
        const lock = await client!.getMailboxLock('INBOX');
        try {
          // Busca por cada UC do cooperado. Para na primeira que achar fatura.
          for (const uc of ucsBusca) {
            for (const num of uc.numeros) {
              // OR: assunto ou corpo contém o número
              let uids: number[] = [];
              try {
                uids = (await client!.search({ or: [{ subject: num }, { body: num }] })) || [];
              } catch {
                // Alguns servidores não aceitam OR — fallback subject only
                uids = (await client!.search({ subject: num })) || [];
              }
              if (!uids || uids.length === 0) continue;

              const ultimoUid = uids[uids.length - 1];
              const msg = await client!.fetchOne(String(ultimoUid), { source: true }, { uid: true });
              if (!msg || !msg.source) continue;

              const parsed = await simpleParser(msg.source);
              const anexosPdf = (parsed.attachments || []).filter(
                (a) => a.contentType?.includes('pdf') || (a.filename ?? '').toLowerCase().endsWith('.pdf'),
              );
              if (anexosPdf.length === 0) continue;

              const anexo = anexosPdf[0];
              const base64 = (anexo.content as Buffer).toString('base64');
              try {
                await faturasService.uploadConcessionaria({
                  cooperadoId: c.id,
                  arquivoBase64: base64,
                  tipoArquivo: 'pdf',
                  mesReferencia: parsed.date
                    ? `${(parsed.date.getMonth() + 1).toString().padStart(2, '0')}/${parsed.date.getFullYear()}`
                    : '',
                });
                return { ok: true, motivo: `processada (UC ${num})` };
              } catch (err) {
                const m = (err as Error).message;
                if (m.includes('password protected') || m.includes('encrypted')) {
                  return { ok: false, motivo: 'pdf-protegido' };
                }
                throw err;
              }
            }
          }
          return { ok: false, motivo: 'nenhuma-fatura-encontrada' };
        } finally {
          lock.release();
        }
      })();

      const resultado = await Promise.race([
        trabalho,
        new Promise<{ ok: boolean; motivo: string }>((resolve) =>
          setTimeout(() => resolve({ ok: false, motivo: 'timeout-90s' }), 90 * 1000),
        ),
      ]);

      if (resultado.ok) {
        processados++;
        console.log(`✓ ${resultado.motivo}`);
      } else if (resultado.motivo === 'nenhuma-fatura-encontrada') {
        semFaturaInbox++;
        console.log(`(sem fatura na inbox p/ UCs)`);
      } else if (resultado.motivo === 'pdf-protegido') {
        semFaturaInbox++;
        console.log(`⚠ pdf-protegido`);
      } else {
        erros++;
        console.log(`✗ ${resultado.motivo}`);
      }
    } catch (err) {
      erros++;
      console.log(`✗ ${(err as Error).message.slice(0, 60)}`);
    } finally {
      try {
        if (client) await client.logout();
      } catch {
        // ignora
      }
    }

    checkpoint.cooperadosProcessados.push(c.id);
    salvarCheckpoint(checkpoint);
  }

  const duracao = ((Date.now() - inicio) / 60_000).toFixed(1);
  console.log(`\n=== RESUMO ===`);
  console.log(`Duracao:                       ${duracao} min`);
  console.log(`Pulados (corridas anteriores): ${pulados}`);
  console.log(`Processados c/ fatura:         ${processados}`);
  console.log(`Sem fatura na inbox:           ${semFaturaInbox}`);
  console.log(`Sem UC buscavel:               ${semUcBuscavel}`);
  console.log(`Erros:                         ${erros}`);
  console.log(`\nCheckpoint: ${CHECKPOINT_PATH}`);
  console.log(`Pra reprocessar tudo: delete o checkpoint.\n`);

  await app.close();
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
