/**
 * Re-roda Fase 2 Concierge APENAS nas faturas que falharam no parse do adapter.
 *
 * Identifica via FaturaProcessada.dadosExtraidos.concierge.parseErro e re-roda
 * o pipeline OCR+Adapter+Detectores. Útil após patch no edp-es.adapter pra
 * recuperar rubricas que antes não eram classificadas.
 *
 * NÃO toca em faturas OK (não gasta OCR à toa).
 *
 * Executar:
 *   cd C:\Users\Luciano\cooperebr\backend
 *   npx ts-node scripts/retry-falhas-concierge.ts
 */

import 'dotenv/config';
import { NestFactory } from '@nestjs/core';
import { Prisma } from '@prisma/client';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma.service';
import { DetectoresRegistry } from '../src/concierge/detectores/detectores.registry';
import { EdpEsFaturaAdapter } from '../src/concierge/fatura-canonica/edp-es.adapter';
import type {
  FaturaRawInput,
  MetadadosRawInput,
  RubricaRawInput,
} from '../src/concierge/fatura-canonica/fatura-canonica.types';

const ANTHROPIC_API_URL = 'https://api.anthropic.com/v1/messages';
const CLAUDE_MODEL = 'claude-sonnet-4-6';
const MAX_TOKENS = 8192;

// O prompt está duplicado do reocerizar-fatura-concierge.ts pra evitar import circular.
// Próxima iteração: extrair pra src/concierge/concierge-ocr.service.ts compartilhado.
const PROMPT_CONCIERGE = `Você está analisando uma fatura de energia elétrica brasileira pra auditoria tributária Concierge.
Extraia os dados em JSON puro (sem markdown, sem blocos de código).

FORMATO DE SAÍDA:
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
    "aliquotaPisDeclarada": 0.0125,
    "aliquotaCofinsDeclarada": 0.0575
  },
  "rubricas": [
    {
      "descricao": "EXATAMENTE como aparece (TUSD, TE, En.At.Inj., Demanda, Multa, Juros, DIC, etc)",
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

INSTRUÇÕES: extraia TODAS as linhas da tabela "Detalhes do faturamento" / "Valores Faturados" / "Itens da Fatura". Energia injetada SCEE tem valor NEGATIVO (preserve sinal). Tarifas em 2 colunas: precoUnitarioComTributos (com ICMS por dentro) e tarifaUnitariaBase (sem tributos). Tributos por rubrica quando disponíveis; se só consolidados, distribua. mesReferencia em AAAA-MM. dataVencimento em AAAA-MM-DD. aliquotaIcms decimal (0.17=17%). Inclua Multa, Juros, DIC mesmo que não-energéticos.

Retorne APENAS o JSON.`;

interface OcrResult {
  metadados: MetadadosRawInput;
  rubricas: RubricaRawInput[];
}

async function baixarPdfBase64(url: string, supabase: SupabaseClient): Promise<string> {
  const match = url.match(/\/storage\/v1\/object\/(?:public|sign)\/([^/]+)\/(.+?)(?:\?|$)/);
  if (!match) throw new Error(`URL não reconhecida: ${url.slice(0, 80)}`);
  const [, bucket, pathRaw] = match;
  const path = decodeURIComponent(pathRaw);
  const { data, error } = await supabase.storage.from(bucket).createSignedUrl(path, 60);
  if (error || !data) throw new Error(`Signed URL falhou: ${error?.message}`);
  const r = await fetch(data.signedUrl);
  if (!r.ok) throw new Error(`Download HTTP ${r.status}`);
  return Buffer.from(await r.arrayBuffer()).toString('base64');
}

async function ocrConcierge(pdfBase64: string): Promise<OcrResult> {
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
  if (!r.ok) throw new Error(`Anthropic HTTP ${r.status}`);
  const json = (await r.json()) as { content: Array<{ text?: string }> };
  const text = json.content?.[0]?.text ?? '';
  const m = text.match(/\{[\s\S]*\}/);
  if (!m) throw new Error('Sem JSON na resposta');
  return JSON.parse(m[0]) as OcrResult;
}

async function main(): Promise<void> {
  console.log('\n=== RETRY FALHAS CONCIERGE ===\n');
  const app = await NestFactory.createApplicationContext(AppModule, { logger: ['error', 'warn'] });
  const prisma = app.get(PrismaService);
  const detectores = app.get(DetectoresRegistry);
  const adapter = new EdpEsFaturaAdapter();
  const supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_KEY!);

  const coopCand = await prisma.cooperativa.findMany({
    where: { nome: { contains: 'CoopereBR', mode: 'insensitive' } },
    select: { id: true, _count: { select: { cooperados: true } } },
  });
  const coop = coopCand.reduce((m, a) => (a._count.cooperados > m._count.cooperados ? a : m));

  // Pega faturas com `parseErro` no namespace concierge
  const todas = await prisma.faturaProcessada.findMany({
    where: { cooperado: { cooperativaId: coop.id } },
    select: { id: true, arquivoUrl: true, dadosExtraidos: true, cooperado: { select: { nomeCompleto: true } } },
  });
  const comFalha = todas.filter((f) => {
    const c = (f.dadosExtraidos as { concierge?: { parseErro?: unknown } }).concierge;
    return c?.parseErro !== undefined;
  });

  console.log(`Faturas com parseErro: ${comFalha.length}\n`);
  let ok = 0, parseFalhouDeNovo = 0, ocrFalhou = 0, downloadFalhou = 0;
  let indebitoNovo = 0;

  for (let i = 0; i < comFalha.length; i++) {
    const f = comFalha[i];
    const nome = f.cooperado?.nomeCompleto ?? '?';
    process.stdout.write(`[${i + 1}/${comFalha.length}] ${nome.slice(0, 35).padEnd(35)} ... `);

    if (!f.arquivoUrl) { console.log('SEM url'); downloadFalhou++; continue; }

    let pdfBase64: string;
    try { pdfBase64 = await baixarPdfBase64(f.arquivoUrl, supabase); }
    catch (e) { console.log(`✗ download: ${(e as Error).message.slice(0, 40)}`); downloadFalhou++; continue; }

    let ocrRes: OcrResult;
    try { ocrRes = await ocrConcierge(pdfBase64); }
    catch (e) { console.log(`✗ OCR: ${(e as Error).message.slice(0, 40)}`); ocrFalhou++; continue; }

    const raw: FaturaRawInput = { metadados: ocrRes.metadados, rubricas: ocrRes.rubricas };
    const dist = ocrRes.metadados.distribuidora;
    if (dist !== 'EDP_ES') {
      console.log(`⚠ não-EDP_ES (${dist}) — pula`);
      continue;
    }

    const parsed = adapter.parsear(raw);
    if (!parsed.sucesso) {
      console.log(`✗ parse: ${parsed.motivo}: ${parsed.detalhe.slice(0, 50)}`);
      parseFalhouDeNovo++;
      continue;
    }
    const consol = detectores.detectarTodos(parsed.fatura);
    console.log(`✓ ${consol.padroes.length} padr, R$ ${consol.indebitoMensalTotal.toFixed(2)}/m`);
    ok++;
    indebitoNovo += consol.indebitoMensalTotal;

    const merged = {
      ...(f.dadosExtraidos as object),
      concierge: {
        ocr: ocrRes,
        faturaCanonica: parsed.fatura,
        padroes: consol.padroes,
        indebitoMensalTotal: consol.indebitoMensalTotal,
        indebito60mSelicTotal: consol.indebito60mSelicTotal,
        retryEm: new Date().toISOString(),
      },
    };
    await prisma.faturaProcessada.update({
      where: { id: f.id },
      data: { dadosExtraidos: JSON.parse(JSON.stringify(merged)) as Prisma.InputJsonValue },
    });
  }

  console.log(`\n=== RESUMO RETRY ===`);
  console.log(`Total tentados:     ${comFalha.length}`);
  console.log(`OK (destravados):   ${ok}`);
  console.log(`Parse falhou ainda: ${parseFalhouDeNovo}`);
  console.log(`OCR falhou:         ${ocrFalhou}`);
  console.log(`Download falhou:    ${downloadFalhou}`);
  console.log(`\n💰 INDÉBITO NOVO destravado: R$ ${indebitoNovo.toFixed(2)}/mês = R$ ${(indebitoNovo * 60 * 1.25).toFixed(2)} em 60m+SELIC\n`);

  console.log(`Pra atualizar o XLSX consolidado, rode de novo: scripts/reocerizar-fatura-concierge.ts --todos`);
  console.log('(vai pular checkpoint, recalcular agregado)\n');

  await app.close();
}

main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });
