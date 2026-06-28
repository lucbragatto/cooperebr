/**
 * Processa uma PASTA de PDFs locais com pipeline Concierge completo.
 *
 * Pra cada PDF:
 *   1. Lê do filesystem (base64)
 *   2. OCR Anthropic rich (rubricas + metadados)
 *   3. Adapter por distribuidora (atualmente só EDP_ES)
 *   4. DetectoresRegistry
 *   5. Salva JSON individual + acumula pra XLSX consolidado
 *
 * NÃO toca no banco — análise pura.
 *
 * Argumentos:
 *   --pasta="<caminho>"           Pasta com PDFs (recursivo se subpastas existem)
 *   --saida-xlsx="<caminho>"      Onde salvar XLSX final (opcional)
 *   --salvar-json                 Se passar, salva 1 JSON por PDF na mesma pasta
 *
 * Executar:
 *   cd C:\Users\Luciano\cooperebr\backend
 *   npx ts-node scripts/processar-pasta-pdfs-concierge.ts --pasta="C:\Users\Luciano\OneDrive\Documentos\Claude\Projects\CoopereBR\concierge-faturas-luciano-14-06"
 */

import 'dotenv/config';
import { NestFactory } from '@nestjs/core';
import { AppModule } from '../src/app.module';
import { DetectoresRegistry } from '../src/concierge/detectores/detectores.registry';
import { EdpEsFaturaAdapter } from '../src/concierge/fatura-canonica/edp-es.adapter';
import type {
  FaturaRawInput,
  MetadadosRawInput,
  RubricaRawInput,
} from '../src/concierge/fatura-canonica/fatura-canonica.types';
import type { PadraoDetectado } from '../src/concierge/detectores/detectores.types';
import * as fs from 'fs';
import * as path from 'path';
import * as ExcelJS from 'exceljs';

const ANTHROPIC_API_URL = 'https://api.anthropic.com/v1/messages';
const CLAUDE_MODEL = 'claude-sonnet-4-6';
const MAX_TOKENS = 8192;

const PROMPT_CONCIERGE = `Você está analisando uma fatura de energia elétrica brasileira pra auditoria tributária Concierge.
Extraia os dados em JSON puro (sem markdown, sem blocos de código).

FORMATO:
{
  "metadados": {
    "distribuidora": "EDP_ES|EDP_SP|CEMIG|ENEL_SP|LIGHT_RJ|CELESC|ELFSM|OUTRAS",
    "uf": "ES|SP|MG|RJ|SC|...",
    "mesReferencia": "YYYY-MM",
    "dataVencimento": "YYYY-MM-DD",
    "titularNome": "nome completo",
    "titularDocumento": "apenas dígitos (CPF=11 ou CNPJ=14)",
    "numeroUC": "número da UC como aparece",
    "classificacao": "B - B1-RESIDENCIAL | A - A4-INDUSTRIAL | etc",
    "modalidadeTarifaria": "CONVENCIONAL|BRANCA|VERDE|AZUL",
    "valorTotalFatura": 0.00,
    "basePisCofinsDeclarada": 0.00,
    "aliquotaPisDeclarada": 0.0094,
    "aliquotaCofinsDeclarada": 0.0432
  },
  "rubricas": [
    {
      "descricao": "EXATAMENTE como aparece (TUSD, TE, En.At.Inj., Demanda, Demanda Geração, DRE, ERE, Multa, Juros, DIC, etc)",
      "unidade": "kWh|kW|kVArh|uni",
      "quantidade": 0,
      "precoUnitarioComTributos": 0.00000,
      "tarifaUnitariaBase": 0.00000,
      "valorTotalReais": 0.00,
      "baseCalculoIcms": 0.00,
      "aliquotaIcms": 0.17,
      "valorIcms": 0.00,
      "valorPisCofins": 0.00
    }
  ]
}

REGRAS:
- TODAS as linhas da tabela. Não consolide.
- Energia injetada SCEE: valor NEGATIVO (preserve sinal); base ICMS e PIS/COFINS preservam sinal também.
- Tarifas: precoUnitarioComTributos (com ICMS por dentro) vs tarifaUnitariaBase (sem tributos).
- Tributos por rubrica quando a fatura mostra; se só consolidados, deixe 0 nas rubricas e popule basePisCofinsDeclarada + alíquotas.
- mesReferencia AAAA-MM. dataVencimento AAAA-MM-DD. aliquotaIcms decimal (0.17=17%).

Retorne APENAS o JSON.`;

interface OcrResult {
  metadados: MetadadosRawInput & {
    aliquotaPisDeclarada?: number;
    aliquotaCofinsDeclarada?: number;
    basePisCofinsDeclarada?: number;
  };
  rubricas: RubricaRawInput[];
}

interface ResultadoFatura {
  arquivo: string;
  pasta: string;
  status: 'ok' | 'sem-adapter' | 'parse-falhou' | 'ocr-falhou';
  titular?: string;
  distribuidora?: string;
  classificacao?: string;
  mesReferencia?: string;
  valorTotalFatura?: number;
  padroes: PadraoDetectado[];
  indebitoMensalTotal: number;
  indebito60mSelicTotal: number;
  erro?: string;
}

async function chamarOcr(pdfBase64: string): Promise<OcrResult> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error('ANTHROPIC_API_KEY não configurada');
  const body = {
    model: CLAUDE_MODEL,
    max_tokens: MAX_TOKENS,
    messages: [
      {
        role: 'user',
        content: [
          { type: 'document', source: { type: 'base64', media_type: 'application/pdf', data: pdfBase64 } },
          { type: 'text', text: PROMPT_CONCIERGE },
        ],
      },
    ],
  };
  const r = await fetch(ANTHROPIC_API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
      'anthropic-beta': 'pdfs-2024-09-25',
    },
    body: JSON.stringify(body),
  });
  if (!r.ok) {
    const text = await r.text();
    throw new Error(`Anthropic HTTP ${r.status}: ${text.slice(0, 200)}`);
  }
  const json = (await r.json()) as { content: Array<{ text?: string }> };
  const text = json.content?.[0]?.text ?? '';
  const m = text.match(/\{[\s\S]*\}/);
  if (!m) throw new Error('Sem JSON parseável na resposta');
  return JSON.parse(m[0]) as OcrResult;
}

function listarPdfs(pasta: string): Array<{ caminho: string; subpasta: string }> {
  const lista: Array<{ caminho: string; subpasta: string }> = [];
  const itens = fs.readdirSync(pasta, { withFileTypes: true });
  for (const item of itens) {
    const full = path.join(pasta, item.name);
    if (item.isDirectory()) {
      for (const sub of listarPdfs(full)) {
        lista.push({
          caminho: sub.caminho,
          subpasta: item.name + (sub.subpasta ? '/' + sub.subpasta : ''),
        });
      }
    } else if (item.name.toLowerCase().endsWith('.pdf')) {
      lista.push({ caminho: full, subpasta: '' });
    }
  }
  return lista;
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const pastaArg = args.find((a) => a.startsWith('--pasta='))?.slice(8).replace(/^"|"$/g, '');
  const xlsxArg = args.find((a) => a.startsWith('--saida-xlsx='))?.slice(13).replace(/^"|"$/g, '');
  const salvarJson = args.includes('--salvar-json');

  if (!pastaArg) {
    console.log('Uso: npx ts-node scripts/processar-pasta-pdfs-concierge.ts --pasta="<caminho>"');
    process.exit(1);
  }
  if (!fs.existsSync(pastaArg)) {
    console.log(`Pasta não existe: ${pastaArg}`);
    process.exit(1);
  }

  console.log('\n=== PROCESSAR PASTA PDFs CONCIERGE ===\n');
  const app = await NestFactory.createApplicationContext(AppModule, { logger: ['error', 'warn'] });
  const detectores = app.get(DetectoresRegistry);
  const adapter = new EdpEsFaturaAdapter();

  const pdfs = listarPdfs(pastaArg);
  console.log(`Pasta: ${pastaArg}`);
  console.log(`PDFs encontrados: ${pdfs.length}\n`);

  const resultados: ResultadoFatura[] = [];
  let ok = 0, semAdapter = 0, parseFalhou = 0, ocrFalhou = 0;
  let totalMensal = 0, total60m = 0;
  const inicio = Date.now();

  for (let i = 0; i < pdfs.length; i++) {
    const { caminho, subpasta } = pdfs[i];
    const nome = path.basename(caminho);
    const progresso = `[${i + 1}/${pdfs.length}]`;
    const label = subpasta ? `${subpasta}/${nome}` : nome;
    process.stdout.write(`${progresso} ${label.slice(0, 50).padEnd(50)} ... `);

    let pdfBase64: string;
    try {
      pdfBase64 = fs.readFileSync(caminho).toString('base64');
    } catch (e) {
      console.log(`✗ leitura: ${(e as Error).message.slice(0, 40)}`);
      resultados.push({ arquivo: nome, pasta: subpasta, status: 'ocr-falhou', padroes: [], indebitoMensalTotal: 0, indebito60mSelicTotal: 0, erro: 'leitura' });
      continue;
    }

    let ocr: OcrResult;
    try {
      ocr = await chamarOcr(pdfBase64);
    } catch (e) {
      console.log(`✗ OCR: ${(e as Error).message.slice(0, 40)}`);
      ocrFalhou++;
      resultados.push({ arquivo: nome, pasta: subpasta, status: 'ocr-falhou', padroes: [], indebitoMensalTotal: 0, indebito60mSelicTotal: 0, erro: (e as Error).message.slice(0, 100) });
      continue;
    }

    if (salvarJson) {
      const jsonPath = caminho.replace(/\.pdf$/i, '.concierge.json');
      fs.writeFileSync(jsonPath, JSON.stringify(ocr, null, 2));
    }

    const meta = ocr.metadados;
    if (meta.distribuidora !== 'EDP_ES') {
      console.log(`⚠ ${meta.distribuidora} sem adapter`);
      semAdapter++;
      resultados.push({
        arquivo: nome, pasta: subpasta, status: 'sem-adapter',
        titular: meta.titularNome, distribuidora: meta.distribuidora as string,
        classificacao: meta.classificacao, mesReferencia: meta.mesReferencia,
        valorTotalFatura: meta.valorTotalFatura,
        padroes: [], indebitoMensalTotal: 0, indebito60mSelicTotal: 0,
      });
      continue;
    }

    const raw: FaturaRawInput = { metadados: meta, rubricas: ocr.rubricas };
    const parsed = adapter.parsear(raw);
    if (!parsed.sucesso) {
      console.log(`✗ parse: ${parsed.motivo}`);
      parseFalhou++;
      resultados.push({
        arquivo: nome, pasta: subpasta, status: 'parse-falhou',
        titular: meta.titularNome, distribuidora: meta.distribuidora as string,
        classificacao: meta.classificacao, mesReferencia: meta.mesReferencia,
        valorTotalFatura: meta.valorTotalFatura,
        padroes: [], indebitoMensalTotal: 0, indebito60mSelicTotal: 0,
        erro: `${parsed.motivo}: ${parsed.detalhe.slice(0, 100)}`,
      });
      continue;
    }

    const consol = detectores.detectarTodos(parsed.fatura);
    console.log(`✓ ${consol.padroes.length}p R$ ${consol.indebitoMensalTotal.toFixed(2)}/m`);
    ok++;
    totalMensal += consol.indebitoMensalTotal;
    total60m += consol.indebito60mSelicTotal;
    resultados.push({
      arquivo: nome, pasta: subpasta, status: 'ok',
      titular: meta.titularNome, distribuidora: meta.distribuidora as string,
      classificacao: meta.classificacao, mesReferencia: meta.mesReferencia,
      valorTotalFatura: meta.valorTotalFatura,
      padroes: consol.padroes,
      indebitoMensalTotal: consol.indebitoMensalTotal,
      indebito60mSelicTotal: consol.indebito60mSelicTotal,
    });
  }

  const duracao = ((Date.now() - inicio) / 60_000).toFixed(1);
  console.log(`\n=== RESUMO ===`);
  console.log(`Duração:           ${duracao} min`);
  console.log(`OK:                ${ok}`);
  console.log(`Sem adapter:       ${semAdapter}`);
  console.log(`Parse falhou:      ${parseFalhou}`);
  console.log(`OCR falhou:        ${ocrFalhou}`);
  console.log(`\n💰 Indébito mensal: R$ ${totalMensal.toFixed(2)} | 60m+SELIC: R$ ${total60m.toFixed(2)}\n`);

  // ── XLSX consolidado ──
  const wb = new ExcelJS.Workbook();
  wb.creator = 'Concierge Pasta Análise';
  wb.created = new Date();

  // Aba 1: Detalhe por fatura
  const ws1 = wb.addWorksheet('Indébito por fatura', { properties: { tabColor: { argb: 'FFDC2626' } } });
  ws1.columns = [
    { header: 'Pasta', key: 'pasta', width: 16 },
    { header: 'Arquivo', key: 'arq', width: 60 },
    { header: 'Titular', key: 'tit', width: 30 },
    { header: 'Dist', key: 'dist', width: 10 },
    { header: 'Classif', key: 'cls', width: 22 },
    { header: 'Mês', key: 'mes', width: 10 },
    { header: 'Total fatura R$', key: 'tot', width: 14 },
    { header: 'Status', key: 'st', width: 14 },
    { header: 'Padrões', key: 'qp', width: 9 },
    { header: 'Indébito mês R$', key: 'im', width: 15 },
    { header: 'Indébito 60m+SELIC', key: 'i60', width: 18 },
    { header: 'Teses', key: 'ts', width: 35 },
    { header: 'Detalhe / Erro', key: 'd', width: 80 },
  ];
  ws1.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };
  ws1.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF991B1B' } };

  for (const r of resultados) {
    const teses = r.padroes.map((p) => p.codigo).join(', ');
    const det = r.padroes.length
      ? r.padroes.map((p) => `${p.codigo}: R$${p.valorIndebitoMensal.toFixed(2)}`).join(' | ')
      : (r.erro ?? '-');
    ws1.addRow({
      pasta: r.pasta, arq: r.arquivo, tit: r.titular ?? '?',
      dist: r.distribuidora ?? '?', cls: r.classificacao ?? '?',
      mes: r.mesReferencia ?? '?', tot: r.valorTotalFatura ?? 0,
      st: r.status, qp: r.padroes.length,
      im: r.indebitoMensalTotal, i60: r.indebito60mSelicTotal,
      ts: teses, d: det,
    });
  }

  // Aba 2: Resumo por pasta
  const ws2 = wb.addWorksheet('Resumo por pasta', { properties: { tabColor: { argb: 'FF16A34A' } } });
  ws2.columns = [
    { header: 'Pasta', key: 'p', width: 20 },
    { header: 'Total faturas', key: 'q', width: 14 },
    { header: 'OK', key: 'ok', width: 8 },
    { header: 'Parse falhou', key: 'pf', width: 14 },
    { header: 'Sem adapter', key: 'sa', width: 14 },
    { header: 'Indébito mensal R$', key: 'im', width: 18 },
    { header: 'Indébito 60m+SELIC R$', key: 'i60', width: 22 },
  ];
  ws2.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };
  ws2.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF15803D' } };
  const porPasta = new Map<string, { q: number; ok: number; pf: number; sa: number; im: number; i60: number }>();
  for (const r of resultados) {
    const s = porPasta.get(r.pasta) ?? { q: 0, ok: 0, pf: 0, sa: 0, im: 0, i60: 0 };
    s.q++;
    if (r.status === 'ok') s.ok++;
    if (r.status === 'parse-falhou') s.pf++;
    if (r.status === 'sem-adapter') s.sa++;
    s.im += r.indebitoMensalTotal;
    s.i60 += r.indebito60mSelicTotal;
    porPasta.set(r.pasta, s);
  }
  for (const [p, s] of porPasta) {
    ws2.addRow({ p: p || '(raiz)', q: s.q, ok: s.ok, pf: s.pf, sa: s.sa, im: s.im, i60: s.i60 });
  }
  ws2.addRow({});
  ws2.addRow({ p: 'TOTAL GERAL', q: resultados.length, ok, pf: parseFalhou, sa: semAdapter, im: totalMensal, i60: total60m });

  // Aba 3: Resumo por tese
  const ws3 = wb.addWorksheet('Resumo por tese', { properties: { tabColor: { argb: 'FF7E22CE' } } });
  ws3.columns = [
    { header: 'Tese', key: 't', width: 35 },
    { header: 'Faturas afetadas', key: 'q', width: 16 },
    { header: 'Indébito mensal', key: 'im', width: 18 },
    { header: 'Indébito 60m+SELIC', key: 'i60', width: 22 },
  ];
  ws3.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };
  ws3.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF581C87' } };
  const porTese = new Map<string, { q: number; im: number; i60: number }>();
  for (const r of resultados) {
    for (const p of r.padroes) {
      const s = porTese.get(p.codigo) ?? { q: 0, im: 0, i60: 0 };
      s.q++; s.im += p.valorIndebitoMensal; s.i60 += p.valorIndebito60mSelic;
      porTese.set(p.codigo, s);
    }
  }
  for (const [t, s] of porTese) {
    ws3.addRow({ t, q: s.q, im: s.im, i60: s.i60 });
  }

  const outXlsx = xlsxArg ?? path.join('C:/Users/Luciano/OneDrive/Documentos/Claude/Projects/CoopereBR', `concierge-pasta-${new Date().toISOString().slice(0, 10)}.xlsx`);
  await wb.xlsx.writeFile(outXlsx);
  console.log(`✓ XLSX: ${outXlsx}`);
  console.log(`  Aba 1: Indébito por fatura`);
  console.log(`  Aba 2: Resumo por pasta (ex_clientes vs atuais)`);
  console.log(`  Aba 3: Resumo por tese\n`);

  await app.close();
}

main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });
