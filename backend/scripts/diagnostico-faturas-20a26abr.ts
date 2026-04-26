/**
 * Diagnóstico read-only — pipeline IMAP CoopereBR (20-26/04/2026).
 *
 * Pega emails do IMAP da CoopereBR na janela, filtra faturas, roda OCR,
 * casa com UCs/cooperados, projeta valores contra os planos cadastrados,
 * gera relatório markdown.
 *
 * NÃO escreve no banco. NÃO marca emails como lidos. NÃO move pastas.
 * Limita a 20 faturas processadas (custo OCR ~$0.10/PDF).
 *
 * Rodar: npx ts-node backend/scripts/diagnostico-faturas-20a26abr.ts
 */
import { NestFactory } from '@nestjs/core';
import { ImapFlow } from 'imapflow';
import { simpleParser, AddressObject } from 'mailparser';
import * as fs from 'fs';
import * as path from 'path';
import { AppModule } from '../src/app.module';
import { FaturasService, resolverUcPorNumero } from '../src/faturas/faturas.service';
import { MotorPropostaService } from '../src/motor-proposta/motor-proposta.service';
import { EmailConfigService } from '../src/email/email-config.service';
import { PrismaService } from '../src/prisma.service';
import { coerceDistribuidora } from '../src/ucs/ucs.service';

const COOPEREBR_ID = 'cmn0ho8bx0000uox8wu96u6fd';
const JANELA_INICIO = new Date('2026-04-20T00:00:00-03:00');
const JANELA_FIM = new Date('2026-04-26T23:59:59-03:00');
const LIMITE_FATURAS = 20;
const RELATORIO = path.join(__dirname, '..', '..', 'docs', 'sessoes', '2026-04-26-diagnostico-faturas-20a26abr.md');

// Filtro de fatura — replica `email-monitor.service.ts:446` (lista trivial,
// não é lógica de cálculo. Manter sincronizado se mudar lá).
const TERMOS_FATURA = [
  'fatura', 'conta de energia', 'conta de luz', 'energia elétrica',
  'edp', 'cemig', 'copel', 'celpe', 'coelba', 'energisa', 'cpfl',
  'enel', 'light', 'equatorial', 'neoenergia', 'celesc',
  'demonstrativo', 'consumo', 'kwh', 'unidade consumidora',
];

interface EmailItem {
  uid: number;
  data: Date;
  remetente: string;
  assunto: string;
  pdfs: { filename: string; content: Buffer; tamanhoKB: number }[];
  textoCorpo: string;
}

interface ResultadoFatura {
  emailUid: number;
  data: string;
  remetente: string;
  assunto: string;
  pdfFilename: string;
  pdfTamanhoKB: number;
  ocrLatenciaMs: number;
  ocrFalha?: string;
  dadosExtraidos?: any;
  matchCampo?: string;
  ucEncontrada?: { id: string; numero: string; cooperadoId: string | null; cooperado?: { nomeCompleto: string; cpf: string; status: string } };
  contratoAtivo?: { planoId: string | null; planoNome: string | null; descontoContratado: number | null };
  ultimas3Cobrancas?: number[];
  projecoes?: Array<{
    planoId: string;
    planoNome: string;
    modelo: string;
    descontoBase: number;
    valorCooperado: number | null;
    economiaReais: number | null;
    economiaPercent: number | null;
    bloqueado: boolean;
    erro?: string;
  }>;
}

function pareceSerFatura(item: EmailItem): boolean {
  const haystack = `${item.remetente} ${item.assunto} ${item.textoCorpo}`.toLowerCase();
  return TERMOS_FATURA.some(t => haystack.includes(t));
}

async function main() {
  console.log(`=== DIAGNÓSTICO FATURAS IMAP COOPEREBR (${JANELA_INICIO.toISOString().slice(0, 10)} → ${JANELA_FIM.toISOString().slice(0, 10)}) ===`);

  const app = await NestFactory.createApplicationContext(AppModule, { logger: ['error', 'warn'] });
  const prisma = app.get(PrismaService);
  const emailConfig = app.get(EmailConfigService);
  const faturas = app.get(FaturasService);
  const motor = app.get(MotorPropostaService);

  // 1. Config IMAP CoopereBR
  console.log('[1/5] Carregando config IMAP CoopereBR...');
  const imapCfg = await emailConfig.getImapConfig(COOPEREBR_ID);
  if (!imapCfg.user || !imapCfg.pass) {
    throw new Error('IMAP não configurado pra CoopereBR');
  }
  console.log(`     ${imapCfg.host}:${imapCfg.port} user=${imapCfg.user} fonte=${imapCfg.fonte}`);

  // 2. Conectar e baixar
  console.log('[2/5] Conectando IMAP e baixando emails...');
  const client = new ImapFlow({
    host: imapCfg.host,
    port: imapCfg.port,
    secure: true,
    auth: { user: imapCfg.user, pass: imapCfg.pass },
    tls: { rejectUnauthorized: false },
    logger: false,
  });
  await client.connect();

  const itens: EmailItem[] = [];
  const lock = await client.getMailboxLock('INBOX', { readOnly: true });
  let totalNaJanela = 0;
  let totalComPdf = 0;
  try {
    const uidsRaw: any = await client.search({ since: JANELA_INICIO, before: new Date(JANELA_FIM.getTime() + 86400000) });
    const uids: number[] = Array.isArray(uidsRaw) ? uidsRaw : [];
    totalNaJanela = uids.length;
    console.log(`     ${totalNaJanela} emails na janela`);

    // Fase A — fetch leve (envelope + bodyStructure) pra detectar quem tem PDF
    const candidatos: Array<{ uid: number; data: Date; remetente: string; assunto: string; pdfFilenames: string[] }> = [];
    for await (const msg of client.fetch(uids, { envelope: true, uid: true, bodyStructure: true })) {
      if (!msg.envelope) continue;
      const data = msg.envelope.date || new Date();
      if (data < JANELA_INICIO || data > JANELA_FIM) continue;
      const pdfs: string[] = [];
      const walk = (node: any) => {
        if (!node) return;
        const fn = node.dispositionParameters?.filename || node.parameters?.name || '';
        if (typeof fn === 'string' && fn.toLowerCase().endsWith('.pdf')) pdfs.push(fn);
        if (node.childNodes) for (const c of node.childNodes) walk(c);
      };
      walk(msg.bodyStructure);
      if (pdfs.length === 0) continue;
      const fromAddr = msg.envelope.from?.[0];
      const remetente = fromAddr ? `${fromAddr.name ?? ''} <${fromAddr.address ?? ''}>`.trim() : '';
      candidatos.push({ uid: msg.uid, data, remetente, assunto: msg.envelope.subject || '', pdfFilenames: pdfs });
    }
    totalComPdf = candidatos.length;
    console.log(`     ${totalComPdf} emails com PDF anexo (filtrados antes do download pesado)`);

    // Fase B — baixar source só dos candidatos, um por vez (rate-limit Gmail)
    for (let i = 0; i < candidatos.length; i++) {
      const c = candidatos[i];
      try {
        const msgs = client.fetch(c.uid, { source: true, uid: true }, { uid: true });
        for await (const msg of msgs) {
          const parsed = await simpleParser(msg.source);
          const pdfs = (parsed.attachments || [])
            .filter((a: any) => (a.filename || '').toLowerCase().endsWith('.pdf'))
            .map((a: any) => ({ filename: a.filename || 'sem-nome.pdf', content: a.content as Buffer, tamanhoKB: Math.round((a.content as Buffer).length / 1024) }));
          if (pdfs.length === 0) continue;
          itens.push({
            uid: c.uid,
            data: c.data,
            remetente: c.remetente,
            assunto: c.assunto,
            pdfs,
            textoCorpo: (parsed.text || (parsed.html || '').replace(/<[^>]+>/g, ' ')).slice(0, 5000),
          });
        }
      } catch (err: any) {
        console.log(`     ⚠ uid=${c.uid} falhou no fetch: ${err.message}`);
      }
      // Pausa pra não estourar rate-limit Gmail
      if (i < candidatos.length - 1) await new Promise(r => setTimeout(r, 300));
    }
  } finally {
    lock.release();
  }
  await client.logout();

  console.log(`     ${totalComPdf} emails com PDF anexo`);

  // 3. Filtrar faturas
  const filtradas = itens.filter(pareceSerFatura);
  console.log(`     ${filtradas.length} passaram no filtro de fatura`);

  // Ordenar mais recentes primeiro, limitar a 20
  filtradas.sort((a, b) => b.data.getTime() - a.data.getTime());
  const aprocessar = filtradas.slice(0, LIMITE_FATURAS);
  if (filtradas.length > LIMITE_FATURAS) {
    console.log(`     ⚠ Limitando a ${LIMITE_FATURAS} mais recentes (das ${filtradas.length} totais)`);
  }

  // 4. Planos CoopereBR
  console.log(`[3/5] Carregando planos da CoopereBR...`);
  const planos = await prisma.plano.findMany({
    where: { cooperativaId: COOPEREBR_ID, ativo: true },
    select: { id: true, nome: true, modeloCobranca: true, descontoBase: true, baseCalculo: true, referenciaValor: true, fatorIncremento: true, tipoDesconto: true },
  });
  console.log(`     ${planos.length} planos ativos: ${planos.map(p => p.nome).join(', ')}`);

  const bloqueioNaoFixo = process.env.BLOQUEIO_MODELOS_NAO_FIXO === 'true';

  // 5. OCR + match + projeção pra cada
  console.log(`[4/5] Processando ${aprocessar.length} faturas (OCR + match + projeção)...`);
  const resultados: ResultadoFatura[] = [];

  for (let i = 0; i < aprocessar.length; i++) {
    const item = aprocessar[i];
    const pdf = item.pdfs[0];
    console.log(`  [${i + 1}/${aprocessar.length}] uid=${item.uid} ${item.data.toISOString().slice(0, 10)} ${pdf.filename}`);

    const r: ResultadoFatura = {
      emailUid: item.uid,
      data: item.data.toISOString(),
      remetente: item.remetente,
      assunto: item.assunto,
      pdfFilename: pdf.filename,
      pdfTamanhoKB: pdf.tamanhoKB,
      ocrLatenciaMs: 0,
    };

    // OCR
    try {
      const t0 = Date.now();
      const dados = await faturas.extrairOcr(pdf.content.toString('base64'), 'pdf');
      r.ocrLatenciaMs = Date.now() - t0;
      r.dadosExtraidos = dados;
      console.log(`        OCR ${r.ocrLatenciaMs}ms — UC orig=${(dados as any).numeroConcessionariaOriginal ?? '-'} | distrib=${(dados as any).distribuidora ?? '-'}`);
    } catch (err: any) {
      r.ocrFalha = err.message;
      console.log(`        ❌ OCR falhou: ${err.message}`);
      resultados.push(r);
      continue;
    }

    const dados: any = r.dadosExtraidos;
    const distOCR = coerceDistribuidora(String(dados.distribuidora ?? ''));
    const candidatos = [dados.numero, dados.numeroUC, dados.numeroConcessionariaOriginal].filter(Boolean);

    // Match UC
    for (const cand of candidatos) {
      const uc = await resolverUcPorNumero(prisma, COOPEREBR_ID, cand, undefined, distOCR);
      if (uc) {
        // Determinar campo que deu match (replicando lógica)
        const ucBanco = await prisma.uc.findUnique({
          where: { id: uc.id },
          select: { numero: true, numeroUC: true, numeroConcessionariaOriginal: true, cooperadoId: true, cooperado: { select: { nomeCompleto: true, cpf: true, status: true } } },
        });
        const norm = (s: string | null | undefined) => (s || '').replace(/\D/g, '').replace(/^0+/, '');
        const candNorm = norm(cand);
        let campo = '?';
        if (norm(ucBanco?.numero) === candNorm) campo = 'numero';
        else if (norm(ucBanco?.numeroUC) === candNorm) campo = 'numeroUC';
        else if (norm(ucBanco?.numeroConcessionariaOriginal) === candNorm) campo = 'numeroConcessionariaOriginal';
        r.matchCampo = campo;
        r.ucEncontrada = {
          id: uc.id,
          numero: uc.numero,
          cooperadoId: ucBanco?.cooperadoId ?? null,
          cooperado: ucBanco?.cooperado ?? undefined,
        };
        console.log(`        ✓ Match em "${campo}" → UC ${uc.id.slice(-8)} (${ucBanco?.cooperado?.nomeCompleto ?? '?'})`);
        break;
      }
    }

    if (!r.ucEncontrada) {
      console.log(`        ⚠ UC não encontrada (lead potencial)`);
      resultados.push(r);
      continue;
    }

    // Contrato ativo + últimas 3 cobranças
    const contratoAtivo = await prisma.contrato.findFirst({
      where: { ucId: r.ucEncontrada.id, status: 'ATIVO' },
      include: { plano: { select: { id: true, nome: true } } },
    });
    if (contratoAtivo) {
      r.contratoAtivo = {
        planoId: contratoAtivo.planoId,
        planoNome: contratoAtivo.plano?.nome ?? null,
        descontoContratado: Number(contratoAtivo.percentualDesconto ?? 0),
      };
      const cobs = await prisma.cobranca.findMany({
        where: { contratoId: contratoAtivo.id, status: { in: ['PAGO', 'A_VENCER', 'PENDENTE'] } },
        orderBy: { dataVencimento: 'desc' },
        take: 3,
        select: { valorLiquido: true },
      });
      r.ultimas3Cobrancas = cobs.map(c => Number(c.valorLiquido));
    }

    // Projeção contra cada plano
    r.projecoes = [];
    const consumo = Number(dados.consumoAtualKwh ?? 0);
    const totalSemGD = Number(dados.valorSemDesconto ?? dados.totalAPagar ?? 0);
    const historicoOCR = Array.isArray(dados.historicoConsumo)
      ? dados.historicoConsumo.map((h: any) => ({ mes: String(h.mesAno ?? ''), kwh: Number(h.consumoKwh ?? 0), valor: Number(h.valorRS ?? 0) }))
      : [];

    for (const plano of planos) {
      const proj: any = {
        planoId: plano.id,
        planoNome: plano.nome,
        modelo: String(plano.modeloCobranca),
        descontoBase: Number(plano.descontoBase),
        valorCooperado: null,
        economiaReais: null,
        economiaPercent: null,
        bloqueado: false,
      };
      if (bloqueioNaoFixo && String(plano.modeloCobranca) !== 'FIXO_MENSAL') {
        proj.bloqueado = true;
        proj.erro = 'BLOQUEIO_MODELOS_NAO_FIXO=true';
        r.projecoes.push(proj);
        continue;
      }
      try {
        const calc: any = await motor.calcularComPlano({
          planoId: plano.id,
          consumoKwh: consumo,
          totalSemGD,
          tusd: Number(dados.tarifaTUSD ?? 0) * consumo,
          te: Number(dados.tarifaTE ?? 0) * consumo,
          pisCofins: Number(dados.pisCofinsValor ?? 0),
          cip: Number(dados.contribIluminacaoPublica ?? 0),
          icms: Number(dados.icmsValor ?? 0),
          historico: historicoOCR,
        });
        proj.valorCooperado = calc.valorMensalCooperebr ?? calc.valorTotalMensal ?? null;
        proj.economiaReais = calc.economiaReais ?? null;
        proj.economiaPercent = calc.economiaPercent ?? null;
      } catch (err: any) {
        proj.erro = err.message;
      }
      r.projecoes.push(proj);
    }

    resultados.push(r);
  }

  // 6. Relatório
  console.log(`[5/5] Gerando relatório...`);
  const md = montarRelatorio({
    janela: { inicio: JANELA_INICIO, fim: JANELA_FIM },
    totalNaJanela,
    totalComPdf,
    totalFatura: filtradas.length,
    aprocessar: aprocessar.length,
    resultados,
    planos,
    bloqueioNaoFixo,
  });
  fs.mkdirSync(path.dirname(RELATORIO), { recursive: true });
  fs.writeFileSync(RELATORIO, md);
  console.log(`     Relatório: ${RELATORIO}`);

  // Estatísticas finais
  const ocrOk = resultados.filter(r => !r.ocrFalha).length;
  const matched = resultados.filter(r => r.ucEncontrada).length;
  const custoEstimado = (ocrOk * 0.12).toFixed(2); // ~$0.12 por OCR Claude PDF
  console.log(`\n=== SUMÁRIO ===`);
  console.log(`Emails na janela: ${totalNaJanela}`);
  console.log(`Com PDF: ${totalComPdf}`);
  console.log(`Filtro fatura: ${filtradas.length}`);
  console.log(`Processadas (OCR): ${resultados.length}`);
  console.log(`OCR sucesso: ${ocrOk} | falha: ${resultados.length - ocrOk}`);
  console.log(`UC resolvida: ${matched} | não resolvida: ${resultados.length - matched}`);
  console.log(`Custo OCR estimado: $${custoEstimado}`);

  await app.close();
}

function montarRelatorio(d: {
  janela: { inicio: Date; fim: Date };
  totalNaJanela: number;
  totalComPdf: number;
  totalFatura: number;
  aprocessar: number;
  resultados: ResultadoFatura[];
  planos: any[];
  bloqueioNaoFixo: boolean;
}): string {
  const ocrOk = d.resultados.filter(r => !r.ocrFalha).length;
  const ocrFalha = d.resultados.filter(r => r.ocrFalha).length;
  const ucOk = d.resultados.filter(r => r.ucEncontrada).length;
  const semUc = d.resultados.filter(r => !r.ocrFalha && !r.ucEncontrada);
  const custoEstimado = (ocrOk * 0.12).toFixed(2);

  let md = `# Diagnóstico — Faturas IMAP CoopereBR (20/04 → 26/04/2026)

**Gerado em:** ${new Date().toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' })}
**Janela:** ${d.janela.inicio.toISOString()} → ${d.janela.fim.toISOString()} (TZ servidor: ${Intl.DateTimeFormat().resolvedOptions().timeZone})

## Sumário executivo

| Métrica | Valor |
|---|---|
| Emails na janela | ${d.totalNaJanela} |
| Com PDF anexo | ${d.totalComPdf} |
| Passaram filtro de fatura | ${d.totalFatura} |
| Processadas (OCR) | ${d.resultados.length}${d.totalFatura > d.aprocessar ? ` (limitado a ${d.aprocessar})` : ''} |
| OCR sucesso | ${ocrOk} |
| OCR falha | ${ocrFalha} |
| UC resolvida (cooperado encontrado) | ${ucOk} |
| UC não resolvida (lead potencial) | ${ocrOk - ucOk} |
| Custo OCR estimado | $${custoEstimado} |
| Planos CoopereBR ativos | ${d.planos.length} |
| BLOQUEIO_MODELOS_NAO_FIXO | ${d.bloqueioNaoFixo ? 'true' : 'false'} |

## Planos da CoopereBR (cadastrados)

| ID | Nome | Modelo | Desconto base | Base cálculo | Referência |
|---|---|---|---|---|---|
${d.planos.map(p => `| ${p.id.slice(-8)} | ${p.nome} | ${p.modeloCobranca} | ${p.descontoBase}% | ${p.baseCalculo ?? 'KWH_CHEIO'} | ${p.referenciaValor ?? 'MEDIA_3M'} |`).join('\n')}

`;

  // Faturas com UC
  const comUc = d.resultados.filter(r => r.ucEncontrada);
  if (comUc.length > 0) {
    md += `## Faturas processadas\n\n`;
    for (let i = 0; i < comUc.length; i++) {
      const r = comUc[i];
      const dados = r.dadosExtraidos as any;
      md += `### Fatura ${i + 1} — ${r.ucEncontrada!.cooperado?.nomeCompleto ?? '(sem nome)'}\n\n`;
      md += `- **Email:** uid=${r.emailUid} | ${r.data.slice(0, 10)} | ${r.remetente}\n`;
      md += `- **Assunto:** ${r.assunto}\n`;
      md += `- **PDF:** \`${r.pdfFilename}\` (${r.pdfTamanhoKB} KB)\n`;
      md += `- **OCR:** ${r.ocrLatenciaMs}ms\n`;
      md += `- **Match UC:** campo \`${r.matchCampo}\` → uc.id \`${r.ucEncontrada!.id}\`\n`;
      md += `- **Cooperado:** ${r.ucEncontrada!.cooperado?.nomeCompleto ?? '?'} (CPF ${r.ucEncontrada!.cooperado?.cpf ?? '?'}, status ${r.ucEncontrada!.cooperado?.status ?? '?'})\n`;
      md += `- **Contrato ATIVO:** ${r.contratoAtivo ? `SIM (${r.contratoAtivo.planoNome ?? '?'}, ${r.contratoAtivo.descontoContratado}%)` : 'NÃO'}\n`;
      md += `- **Mês ref:** ${dados.mesReferencia ?? '-'} | **Consumo:** ${dados.consumoAtualKwh ?? '-'} kWh\n`;
      md += `- **Valor fatura concessionária (sem CoopereBR):** R$ ${(dados.valorSemDesconto ?? dados.totalAPagar ?? 0).toFixed(2)}\n`;
      md += `- **Total a pagar real:** R$ ${(dados.totalAPagar ?? 0).toFixed(2)}\n`;
      md += `- **Distribuidora (OCR):** ${dados.distribuidora ?? '-'}\n\n`;

      if (r.projecoes && r.projecoes.length > 0) {
        md += `**Projeção contra os ${d.planos.length} planos:**\n\n`;
        md += `| Plano | Modelo | Desc | Valor cooperado | Economia R$ | Economia % | Status |\n`;
        md += `|---|---|---|---|---|---|---|\n`;
        for (const p of r.projecoes) {
          const valor = p.valorCooperado != null ? `R$ ${p.valorCooperado.toFixed(2)}` : '—';
          const econR = p.economiaReais != null ? `R$ ${p.economiaReais.toFixed(2)}` : '—';
          const econP = p.economiaPercent != null ? `${p.economiaPercent.toFixed(2)}%` : '—';
          const status = p.bloqueado ? '🚫 BLOQUEADO' : p.erro ? `⚠ ${p.erro}` : '✅ OK';
          md += `| ${p.planoNome} | ${p.modelo} | ${p.descontoBase}% | ${valor} | ${econR} | ${econP} | ${status} |\n`;
        }
        md += `\n`;
      }

      if (r.contratoAtivo && r.ultimas3Cobrancas && r.ultimas3Cobrancas.length > 0) {
        md += `**Comparação com cobrança real:**\n\n`;
        md += `- Plano atual: ${r.contratoAtivo.planoNome ?? '?'}\n`;
        md += `- Últimas cobranças: ${r.ultimas3Cobrancas.map(v => 'R$ ' + v.toFixed(2)).join(' / ')}\n`;
        const projAtual = r.projecoes?.find(p => p.planoId === r.contratoAtivo!.planoId);
        if (projAtual && projAtual.valorCooperado != null) {
          const mediaCobranca = r.ultimas3Cobrancas.reduce((a, b) => a + b, 0) / r.ultimas3Cobrancas.length;
          const div = projAtual.valorCooperado - mediaCobranca;
          const divPerc = mediaCobranca > 0 ? Math.abs(div / mediaCobranca) * 100 : 0;
          md += `- Valor projetado pelo cálculo: R$ ${projAtual.valorCooperado.toFixed(2)}\n`;
          md += `- Média das últimas cobranças: R$ ${mediaCobranca.toFixed(2)}\n`;
          md += `- Divergência: R$ ${div.toFixed(2)} (${divPerc.toFixed(1)}%) — ${divPerc < 5 ? '✅ bate' : divPerc < 15 ? '⚠ pequena diferença' : '🔴 divergência grande, investigar'}\n`;
        }
        md += `\n`;
      }
    }
  }

  // Sem UC (leads)
  if (semUc.length > 0) {
    md += `## Faturas sem UC cadastrada (leads potenciais)\n\n`;
    md += `| Remetente | Assunto | UC orig (OCR) | Distribuidora | Valor |\n`;
    md += `|---|---|---|---|---|\n`;
    for (const r of semUc) {
      const dados = r.dadosExtraidos as any;
      md += `| ${r.remetente} | ${r.assunto.slice(0, 50)} | ${dados.numeroConcessionariaOriginal ?? dados.numeroUC ?? '-'} | ${dados.distribuidora ?? '-'} | R$ ${(dados.totalAPagar ?? 0).toFixed(2)} |\n`;
    }
    md += `\n`;
  }

  // Falhas OCR
  const falhas = d.resultados.filter(r => r.ocrFalha);
  if (falhas.length > 0) {
    md += `## OCR falhas\n\n`;
    md += `| Email uid | PDF | Erro |\n|---|---|---|\n`;
    for (const r of falhas) md += `| ${r.emailUid} | ${r.pdfFilename} | ${r.ocrFalha} |\n`;
    md += `\n`;
  }

  md += `## Observações finais\n\n`;
  md += `- Pipeline read-only confirmou: pegou ${d.totalFatura} faturas via IMAP, OCR ${ocrOk} sucessos, ${ucOk} matches em UC.\n`;
  md += `- ${d.planos.length === 2 ? '⚠ Apenas 2 planos cadastrados na CoopereBR (prompt assumiu 9 — ajustar expectativa).' : ''}\n`;
  md += `- ${d.bloqueioNaoFixo ? '🚫 Modelos não-FIXO bloqueados em produção (BLOQUEIO_MODELOS_NAO_FIXO=true).' : '✅ Modelos não-FIXO permitidos.'}\n`;
  md += `\n## Próximos passos sugeridos\n\n`;
  md += `1. Luciano valida visualmente cada projeção: bate com o esperado?\n`;
  md += `2. Se houver divergência grande entre projetado e cobrança real: investigar fórmula no Motor de Proposta.\n`;
  md += `3. Leads potenciais (sem UC): definir fluxo (admin contacta? auto-email "venha se cadastrar"?).\n`;
  md += `4. Cadastrar mais planos se for o caso (hoje só ${d.planos.length}).\n`;

  return md;
}

main().catch(e => {
  console.error('FALHA:', e);
  process.exit(1);
});
