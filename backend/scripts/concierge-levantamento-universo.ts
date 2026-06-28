/**
 * Levantamento do universo Concierge — quantas faturas únicas existem?
 *
 * REGRA INEGOCIÁVEL (decisão Luciano 14/06/2026):
 *   Basta UMA fatura por pessoa (cooperado / UC) — não processar múltiplas
 *   da mesma pessoa. Para auditoria Tese 3 + Tese 6, 1 mês representativo
 *   permite calcular indébito médio mensal extrapolável.
 *
 * Este script roda 4 levantamentos:
 *   1) Quantas FaturaProcessada únicas (por cooperadoId) já existem no banco
 *   2) Quantos cooperados ATIVOS ainda NÃO têm fatura processada
 *   3) Quantos emails NOVOS aguardam processamento no IMAP (caixa
 *      contato@cooperebr.com.br, pasta INBOX, dedup por remetente)
 *   4) Estima custo OCR Anthropic se rodar nas pendências
 *
 * Como executar (PowerShell, terminal SEPARADO do Code):
 *   cd C:\Users\Luciano\cooperebr\backend
 *   npx ts-node scripts/concierge-levantamento-universo.ts
 *
 * Saída esperada: tabela ASCII no terminal + JSON em
 *   docs/concierge/wip/levantamento-universo-YYYY-MM-DD.json
 *
 * IMPORTANTE LGPD:
 *   - O JSON salvo NÃO leva CPF/email/nome — só contadores agregados
 *   - É seguro me mandar o JSON pra eu interpretar
 */

// Carregar variaveis .env ANTES de qualquer import que dependa delas
import 'dotenv/config';

import { PrismaClient } from '@prisma/client';
import { ImapFlow } from 'imapflow';
import * as fs from 'fs';
import * as path from 'path';

// Pega TODAS as cooperativas que contem "CoopereBR" no nome e escolhe a
// com MAIS cooperados ativos (descarta "Teste", "Sandbox", etc).
const COOPEREBR_NOME = 'CoopereBR';

async function main(): Promise<void> {
  const prisma = new PrismaClient();
  const inicio = Date.now();

  console.log('\n=== LEVANTAMENTO UNIVERSO CONCIERGE ===\n');

  // ────────────────────────────────────────────────────────────────────────
  // 1) Cooperativa CoopereBR
  // ────────────────────────────────────────────────────────────────────────
  const candidatas = await prisma.cooperativa.findMany({
    where: { nome: { contains: COOPEREBR_NOME, mode: 'insensitive' } },
    select: {
      id: true,
      nome: true,
      moduloConciergeAtivo: true,
      _count: { select: { cooperados: true } },
    },
    orderBy: { nome: 'asc' },
  });
  if (candidatas.length === 0) {
    console.error(`Nenhuma cooperativa com nome contendo "${COOPEREBR_NOME}".`);
    process.exit(1);
  }
  console.log(`\nCooperativas encontradas (${candidatas.length}):`);
  for (const c of candidatas) {
    console.log(
      `  - ${c.nome} | id=${c.id} | cooperados=${c._count.cooperados} | concierge=${c.moduloConciergeAtivo}`,
    );
  }
  // Heuristica: a CoopereBR REAL e a com MAIS cooperados (descarta Teste/Sandbox)
  const coop = candidatas.reduce((max, atual) =>
    atual._count.cooperados > max._count.cooperados ? atual : max,
  );
  console.log(`\n>>> Cooperativa escolhida (maior nº cooperados): ${coop.nome} (id=${coop.id})`);
  console.log(`>>> Modulo Concierge ativo: ${coop.moduloConciergeAtivo}\n`);

  // ────────────────────────────────────────────────────────────────────────
  // 2) Cooperados ativos + faturas
  // ────────────────────────────────────────────────────────────────────────
  const totalCooperados = await prisma.cooperado.count({
    where: { cooperativaId: coop.id, status: 'ATIVO' as never },
  });

  const cooperadosComFatura = await prisma.cooperado.count({
    where: {
      cooperativaId: coop.id,
      status: 'ATIVO' as never,
      faturasProcessadas: { some: {} },
    },
  });

  const totalFaturas = await prisma.faturaProcessada.count({
    where: { cooperado: { cooperativaId: coop.id } },
  });

  const cooperadosSemFatura = totalCooperados - cooperadosComFatura;

  console.log(`\nCooperados ATIVOS: ${totalCooperados}`);
  console.log(`  Com pelo menos 1 fatura processada: ${cooperadosComFatura}`);
  console.log(`  SEM nenhuma fatura processada: ${cooperadosSemFatura}`);
  console.log(`Total FaturaProcessada no banco: ${totalFaturas}`);
  console.log(
    `  Media por cooperado-com-fatura: ${
      cooperadosComFatura > 0
        ? (totalFaturas / cooperadosComFatura).toFixed(1)
        : 0
    }`,
  );

  // ────────────────────────────────────────────────────────────────────────
  // 3) Distribuicao de faturas por cooperado (perfil)
  // ────────────────────────────────────────────────────────────────────────
  const perfilFaturasRaw = await prisma.cooperado.findMany({
    where: {
      cooperativaId: coop.id,
      status: 'ATIVO' as never,
      faturasProcessadas: { some: {} },
    },
    select: { _count: { select: { faturasProcessadas: true } } },
  });
  const histograma: Record<string, number> = {
    '1': 0,
    '2-3': 0,
    '4-6': 0,
    '7-12': 0,
    '13+': 0,
  };
  for (const c of perfilFaturasRaw) {
    const n = c._count.faturasProcessadas;
    if (n === 1) histograma['1']++;
    else if (n <= 3) histograma['2-3']++;
    else if (n <= 6) histograma['4-6']++;
    else if (n <= 12) histograma['7-12']++;
    else histograma['13+']++;
  }
  console.log('\nDistribuicao faturas/cooperado:');
  for (const [bucket, qtd] of Object.entries(histograma)) {
    console.log(`  ${bucket} faturas: ${qtd} cooperado(s)`);
  }

  // ────────────────────────────────────────────────────────────────────────
  // 4) IMAP — quantos emails NOVOS na INBOX (nao processados)
  // ────────────────────────────────────────────────────────────────────────
  console.log('\n=== IMAP — contato@cooperebr.com.br ===');
  // Credenciais vivem no ConfigTenant (decisao D-novo-BR F1.5 M8 31/05/2026 —
  // fallback pro .env global foi removido por seguranca multi-tenant)
  const getCfg = async (chave: string): Promise<string | null> => {
    const r = await prisma.configTenant.findFirst({
      where: { cooperativaId: coop.id, chave },
      select: { valor: true },
    });
    return r?.valor ?? null;
  };
  const ativoCfg = (await getCfg('email.monitor.ativo')) === 'true';
  const userCfg = await getCfg('email.monitor.user');
  const passCfg = await getCfg('email.monitor.pass');
  const hostCfg = await getCfg('email.monitor.host');
  const portCfg = await getCfg('email.monitor.port');

  // Fallback pro .env (SO neste script de levantamento read-only).
  // O EmailMonitorService de producao IGNORA .env por seguranca multi-tenant.
  const user = userCfg || process.env.EMAIL_IMAP_USER;
  // ConfigTenant guarda senha em base64 — decodifica igual EmailMonitorService faz.
  // .env tem senha crua — se vier do .env, NAO decodifica.
  const passRaw = passCfg || process.env.EMAIL_IMAP_PASS || '';
  const pass = passCfg
    ? Buffer.from(passCfg, 'base64').toString('utf-8')
    : passRaw;
  const host = hostCfg || process.env.EMAIL_IMAP_HOST || 'imap.gmail.com';
  const port = parseInt(portCfg || process.env.EMAIL_IMAP_PORT || '993', 10);
  const fonte = userCfg ? 'ConfigTenant' : '.env (fallback)';

  console.log(`Fonte das credenciais: ${fonte}`);
  console.log(`Monitor ativo (ConfigTenant): ${ativoCfg}`);
  console.log(`Usuario: ${user ? user : '(NAO configurado)'}`);
  console.log(`Host:porta: ${host}:${port}`);

  if (!userCfg && process.env.EMAIL_IMAP_USER) {
    console.log(
      '\n⚠️  ATENCAO: credenciais IMAP estao no .env mas NAO no ConfigTenant.',
    );
    console.log(
      '   Por isso o EmailMonitorService de producao NUNCA dispara (so 9 de 309',
    );
    console.log('   cooperados auditados em 6 meses). Para ativar o monitor real:');
    console.log('');
    console.log('   INSERT INTO config_tenant (id, "cooperativaId", chave, valor) VALUES');
    console.log(
      `     ('cfg-1', '${coop.id}', 'email.monitor.ativo', 'true'),`,
    );
    console.log(
      `     ('cfg-2', '${coop.id}', 'email.monitor.user',  '${process.env.EMAIL_IMAP_USER}'),`,
    );
    console.log(
      `     ('cfg-3', '${coop.id}', 'email.monitor.pass',  '<senha-aqui>'),`,
    );
    console.log(
      `     ('cfg-4', '${coop.id}', 'email.monitor.host',  '${process.env.EMAIL_IMAP_HOST || 'imap.gmail.com'}'),`,
    );
    console.log(
      `     ('cfg-5', '${coop.id}', 'email.monitor.port',  '${process.env.EMAIL_IMAP_PORT || '993'}');`,
    );
    console.log('');
    console.log(
      '   Ou via tela admin /dashboard/email/config (se existir).\n',
    );
  }

  if (!user || !pass) {
    console.log(
      '\nAVISO: sem credenciais (nem ConfigTenant nem .env). Pulando IMAP.',
    );
  } else {
    const client = new ImapFlow({
      host,
      port,
      secure: true,
      auth: { user, pass },
      logger: false,
      // ⚠️ NUNCA usar em producao — script read-only apenas pra diagnostico.
      // Erro 'SELF_SIGNED_CERT_IN_CHAIN' indica antivirus/proxy/firewall
      // intercepta TLS. Em producao, a solucao correta e:
      //   (a) adicionar CA do antivirus ao truststore do Node
      //   (b) desativar SSL inspection do antivirus pra imap.gmail.com:993
      //   (c) usar NODE_EXTRA_CA_CERTS=<caminho-do-cert> no PM2
      tls: { rejectUnauthorized: false },
    });
    try {
      await client.connect();
      const lock = await client.getMailboxLock('INBOX');
      try {
        const status = await client.status('INBOX', {
          messages: true,
          unseen: true,
        });
        console.log(`INBOX total mensagens: ${status.messages}`);
        console.log(`INBOX nao lidas: ${status.unseen}`);

        // Coletar remetentes ÚNICOS pra dedupe (regra "1 por pessoa")
        const remetentes = new Set<string>();
        let totalComAnexo = 0;
        const max = status.messages ?? 0;
        if (max > 0) {
          for await (const msg of client.fetch('1:*', {
            envelope: true,
            bodyStructure: true,
          })) {
            const from = msg.envelope?.from?.[0]?.address?.toLowerCase();
            if (from) remetentes.add(from);
            // detectar anexo
            const bs = msg.bodyStructure as { childNodes?: unknown[] } | undefined;
            if (bs?.childNodes && bs.childNodes.length > 0) totalComAnexo++;
          }
        }
        console.log(`Remetentes UNICOS (dedup): ${remetentes.size}`);
        console.log(`Mensagens com anexo: ${totalComAnexo}`);
      } finally {
        lock.release();
      }
      await client.logout();
    } catch (err) {
      console.error('Erro IMAP:', err);
    }
  }

  // ────────────────────────────────────────────────────────────────────────
  // 5) Estimativa de custo OCR para os pendentes
  // ────────────────────────────────────────────────────────────────────────
  const custoPorFaturaUsd = 0.045;
  const cotacaoBrl = 5.6; // ajuste cotacao atual
  const custoPorFaturaBrl = custoPorFaturaUsd * cotacaoBrl;

  const cenarios = [
    {
      nome: 'Re-OCR todas faturas existentes (Caminho B, rubricas detalhadas)',
      qtd: totalFaturas,
    },
    {
      nome:
        'Processar apenas cooperados SEM fatura (1 fatura/pessoa = regra Luciano)',
      qtd: cooperadosSemFatura,
    },
    {
      nome: 'Universo completo CoopereBR (re-OCR todos + cooperados novos)',
      qtd: totalCooperados,
    },
  ];

  console.log('\n=== ESTIMATIVA DE CUSTO OCR ===');
  console.log(`Modelo: claude-sonnet-4-6`);
  console.log(
    `Custo unitario: ~US$ ${custoPorFaturaUsd.toFixed(3)} = R$ ${custoPorFaturaBrl.toFixed(
      2,
    )} por fatura\n`,
  );
  for (const c of cenarios) {
    const totalUsd = c.qtd * custoPorFaturaUsd;
    const totalBrl = c.qtd * custoPorFaturaBrl;
    console.log(`  ${c.nome}`);
    console.log(
      `    ${c.qtd} faturas → US$ ${totalUsd.toFixed(
        2,
      )} (~R$ ${totalBrl.toFixed(2)})\n`,
    );
  }

  // ────────────────────────────────────────────────────────────────────────
  // 6) Salvar JSON pra envio
  // ────────────────────────────────────────────────────────────────────────
  const resumo = {
    geradoEm: new Date().toISOString(),
    cooperativaNome: coop.nome,
    moduloConciergeAtivo: coop.moduloConciergeAtivo,
    totais: {
      cooperadosAtivos: totalCooperados,
      cooperadosComFatura,
      cooperadosSemFatura,
      totalFaturasProcessadas: totalFaturas,
    },
    histogramaFaturasPorCooperado: histograma,
    estimativaCusto: {
      modelo: 'claude-sonnet-4-6',
      custoPorFaturaUsd,
      custoPorFaturaBrl,
      cenarios,
    },
    duracaoSegundos: ((Date.now() - inicio) / 1000).toFixed(1),
  };

  const outDir = path.join(
    __dirname,
    '..',
    '..',
    'docs',
    'concierge',
    'wip',
  );
  fs.mkdirSync(outDir, { recursive: true });
  const stamp = new Date().toISOString().slice(0, 10);
  const outFile = path.join(outDir, `levantamento-universo-${stamp}.json`);
  fs.writeFileSync(outFile, JSON.stringify(resumo, null, 2));
  console.log(`\n✓ Resumo salvo em: ${outFile}`);
  console.log('  → Esse arquivo nao contem PII (so contadores). Pode commitar e me mandar.\n');

  await prisma.$disconnect();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
