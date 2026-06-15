/**
 * Re-OCR detalhado da fatura pra alimentar pipeline Concierge.
 *
 * Diferente do OCR dashboard (faturas.service.ts) que extrai dados AGREGADOS,
 * este OCR extrai RUBRICAS LINHA-A-LINHA com tributários por rubrica — input
 * necessário pro adapter (edp-es / elfsm) → FaturaCanonica → DetectoresRegistry.
 *
 * Pipeline:
 *   1. Baixa PDF do Supabase storage (arquivoUrl)
 *   2. OCR Anthropic Claude Sonnet 4 com prompt rich (rubricas + totais tributários)
 *   3. Resolve adapter por distribuidora (EDP_ES disponível; CEMIG fallback estimativa)
 *   4. Adapter.parsear → FaturaCanonica
 *   5. DetectoresRegistry.detectarTodos → 4 teses tributárias
 *   6. Persiste em FaturaProcessada.dadosExtraidos.concierge (novo namespace)
 *   7. Acumula pra XLSX consolidado
 *
 * REGRA INEGOCIÁVEL (D14/06-2):
 *   Concierge precisa adapter próprio de OCR/parse separado do dashboard.
 *   Este script é a VALIDAÇÃO. Migrar pra ConciergeOcrService NestJS depois.
 *
 * Argumentos:
 *   --cooperado-id=X  → re-OCR de uma fatura específica
 *   --nome="parte"    → busca por nome do cooperado
 *   --todos           → re-OCR de todas FaturaProcessada da CoopereBR (custa ~R$ 14)
 *
 * Saída:
 *   - Banco: FaturaProcessada.dadosExtraidos.concierge atualizado
 *   - Arquivo: C:\Users\Luciano\OneDrive\Documentos\Claude\Projects\CoopereBR\
 *              concierge-indebitos-YYYY-MM-DD.xlsx
 *   - Checkpoint: docs/concierge/wip/reocerizar-checkpoint.json
 *
 * Executar:
 *   cd C:\Users\Luciano\cooperebr\backend
 *   npx ts-node scripts/reocerizar-fatura-concierge.ts --nome="luciano costa"
 *   npx ts-node scripts/reocerizar-fatura-concierge.ts --todos
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
import type { PadraoDetectado } from '../src/concierge/detectores/detectores.types';
import * as fs from 'fs';
import * as path from 'path';
import * as ExcelJS from 'exceljs';

const ANTHROPIC_API_URL = 'https://api.anthropic.com/v1/messages';
const CLAUDE_MODEL = 'claude-sonnet-4-20250514';
const OCR_TIMEOUT_MS = 120_000; // 2 min — OCR rico pode demorar mais
const MAX_TOKENS = 8192;

const CHECKPOINT_PATH = path.join(
  __dirname,
  '..',
  '..',
  'docs',
  'concierge',
  'wip',
  'reocerizar-checkpoint.json',
);

/**
 * Resultado do OCR Concierge — alimenta FaturaRawInput do adapter.
 */
interface OcrConciergeResultado {
  metadados: {
    distribuidora: string;
    uf: string;
    mesReferencia: string; // YYYY-MM
    dataVencimento?: string; // YYYY-MM-DD
    titularNome: string;
    titularDocumento?: string;
    numeroUC: string;
    classificacao: string; // "B - B1-RESIDENCIAL"
    modalidadeTarifaria?: string;
    valorTotalFatura: number;
    basePisCofinsDeclarada?: number;
    aliquotaPisDeclarada?: number;
    aliquotaCofinsDeclarada?: number;
  };
  rubricas: Array<{
    descricao: string;
    unidade?: string;
    quantidade?: number;
    precoUnitarioComTributos?: number;
    tarifaUnitariaBase?: number;
    valorTotalReais?: number;
    baseCalculoIcms?: number;
    aliquotaIcms?: number;
    valorIcms?: number;
    valorPisCofins?: number;
  }>;
  observacoesParser?: string;
}

interface ResultadoFaturaConcierge {
  cooperadoId: string;
  cooperadoNome: string;
  faturaId: string;
  mesReferencia: string;
  distribuidora: string;
  classificacao: string;
  valorTotalFatura: number;
  padroesDetectados: PadraoDetectado[];
  indebitoMensalTotal: number;
  indebito60mSelicTotal: number;
  status: 'ok' | 'sem-adapter' | 'parse-falhou' | 'ocr-falhou' | 'download-falhou';
  erro?: string;
}

interface Checkpoint {
  iniciadoEm: string;
  faturasProcessadas: string[];
  ultimaAtualizacao: string;
}

function lerCheckpoint(): Checkpoint {
  try {
    return JSON.parse(fs.readFileSync(CHECKPOINT_PATH, 'utf-8')) as Checkpoint;
  } catch {
    return {
      iniciadoEm: new Date().toISOString(),
      faturasProcessadas: [],
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
 * Prompt rico — extrai rubricas LINHA-A-LINHA da tabela "Detalhes do faturamento".
 * Crítico pro adapter consumir e detectores rodarem.
 */
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
    "numeroUC": "número da UC como aparece (preserva pontuação)",
    "classificacao": "B - B1-RESIDENCIAL | A - A4-INDUSTRIAL | etc — formato 'GRUPO - SUBGRUPO-CLASSE'",
    "modalidadeTarifaria": "CONVENCIONAL|BRANCA|VERDE|AZUL",
    "valorTotalFatura": 0.00,
    "basePisCofinsDeclarada": 0.00,
    "aliquotaPisDeclarada": 0.0125,
    "aliquotaCofinsDeclarada": 0.0575
  },
  "rubricas": [
    {
      "descricao": "EXATAMENTE como aparece na fatura (TUSD, TE, En. At. Inj., Demanda, Adicional Bandeira, CIP, etc)",
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
  ],
  "observacoesParser": "qualquer ambiguidade ou dado faltante relevante"
}

INSTRUÇÕES CRÍTICAS:

1. RUBRICAS — extraia TODAS as linhas da tabela "Detalhes do faturamento" / "Valores Faturados" / "Itens da Fatura". Cada linha vira UM objeto no array. Pode ter 5-20 linhas. NÃO consolide.

2. ENERGIA INJETADA SCEE — se linha tiver "Inj.", "Injetada", "Compensada", "GD I/II/III", o valorTotalReais é NEGATIVO (compensação). Preserve o sinal.

3. TARIFAS — duas colunas distintas:
   - "precoUnitarioComTributos" → coluna "Preço Unit. R$" / "Preço c/ Tributos" (já inclui ICMS/PIS/COFINS por dentro)
   - "tarifaUnitariaBase" → coluna "Tarifa Unit." / "Tarifa Aplicada s/ Tributos" / "Tarifa ANEEL" (sem tributos)

4. TRIBUTOS POR RUBRICA — extraia da própria tabela quando houver colunas dedicadas (PIS/COFINS, Base Calc ICMS, Alíq ICMS, ICMS). Se a fatura só tiver tributos consolidados (seção "Reservado ao Fisco"), distribua proporcionalmente pelas rubricas tributáveis (TUSD/TE/Demanda).

5. CLASSIFICAÇÃO — formato "GRUPO - SUBGRUPO-CLASSE":
   - Grupo B: B1 (residencial), B2 (rural), B3 (demais)
   - Grupo A: A1, A2, A3, A3a, A4, AS
   - Classe: RESIDENCIAL, COMERCIAL, INDUSTRIAL, RURAL, PODER_PUBLICO, ILUMINACAO_PUBLICA
   - Exemplo válido: "B - B1-RESIDENCIAL" ou "A - A4-INDUSTRIAL"

6. DESCRIÇÃO DAS RUBRICAS — preserve EXATAMENTE. Não traduza nem normalize.
   Exemplos EDP_ES: "TUSD ENERGIA cativ B3", "TE ENERGIA cativ B3", "Demanda Geracao", "En. At. Inj. oUC pT", "Adicional Bandeira"
   Exemplos CEMIG: "Energia Elétrica", "Energia SCEE Isenta", "Energia compensada GD I", "Contrib Ilum Publica Municipal"

7. mesReferencia — converta MM/AAAA → AAAA-MM (ex: "02/2026" → "2026-02").

8. dataVencimento — converta DD/MM/AAAA → AAAA-MM-DD (ex: "11/03/2026" → "2026-03-11").

9. aliquotaIcms — formato decimal (0.17 = 17%). NÃO percentual.

10. Se algo não estiver claro, retorne 0 ou string vazia, NUNCA invente.

Retorne APENAS o JSON, sem texto adicional.`;

interface AnthropicResponse {
  content: Array<{ type: string; text?: string }>;
  usage?: { input_tokens: number; output_tokens: number };
}

async function chamarOcrConcierge(
  pdfBase64: string,
): Promise<OcrConciergeResultado> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    throw new Error('ANTHROPIC_API_KEY não configurada no .env');
  }

  const body = {
    model: CLAUDE_MODEL,
    max_tokens: MAX_TOKENS,
    messages: [
      {
        role: 'user',
        content: [
          {
            type: 'document',
            source: {
              type: 'base64',
              media_type: 'application/pdf',
              data: pdfBase64,
            },
          },
          { type: 'text', text: PROMPT_CONCIERGE },
        ],
      },
    ],
  };

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), OCR_TIMEOUT_MS);

  try {
    const response = await fetch(ANTHROPIC_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
        'anthropic-beta': 'pdfs-2024-09-25',
      },
      body: JSON.stringify(body),
      signal: controller.signal,
    });
    clearTimeout(timeoutId);

    if (!response.ok) {
      const errBody = await response.text();
      throw new Error(`Anthropic HTTP ${response.status}: ${errBody.slice(0, 300)}`);
    }

    const json = (await response.json()) as AnthropicResponse;
    const text = json.content?.[0]?.text ?? '';

    // Extrai JSON (pode vir entre ```json...``` ou puro)
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error(`OCR não retornou JSON parseável. Resposta: ${text.slice(0, 200)}`);
    }
    return JSON.parse(jsonMatch[0]) as OcrConciergeResultado;
  } catch (err) {
    clearTimeout(timeoutId);
    throw err;
  }
}

/**
 * Baixa PDF do Supabase Storage.
 *
 * Bucket `documentos-cooperados` é PRIVADO (apesar do `/public/` no path
 * histórico salvo no banco). Estratégia:
 *   1. Tenta fetch direto da URL pública (rápido se ainda funciona)
 *   2. Se falhar, parse bucket+path da URL e gera signed URL via SDK (TTL 60s)
 *
 * Débito técnico catalogado: arquivoUrl salvo em FaturaProcessada é estática
 * com `/public/`, mas o bucket virou privado. Toda URL no banco precisa ser
 * convertida pra signed URL pra ser acessível. P2 — afeta também download
 * pelo frontend admin/portal.
 */
async function baixarPdfBase64(
  arquivoUrl: string,
  supabase: SupabaseClient,
): Promise<string> {
  // 1. Tenta fetch direto (caso o bucket volte a ser público)
  try {
    const r = await fetch(arquivoUrl);
    if (r.ok) {
      const buffer = Buffer.from(await r.arrayBuffer());
      return buffer.toString('base64');
    }
  } catch {
    // Cai pro fallback de signed URL
  }

  // 2. Parse `/storage/v1/object/public/<bucket>/<path>` → signed URL
  const match = arquivoUrl.match(/\/storage\/v1\/object\/(?:public|sign)\/([^/]+)\/(.+?)(?:\?|$)/);
  if (!match) {
    throw new Error(`URL não reconhecida como Supabase Storage: ${arquivoUrl.slice(0, 80)}`);
  }
  const [, bucket, pathRaw] = match;
  const pathDecoded = decodeURIComponent(pathRaw);

  const { data, error } = await supabase.storage.from(bucket).createSignedUrl(pathDecoded, 60);
  if (error || !data) {
    throw new Error(`Signed URL falhou: ${error?.message ?? 'sem data'} | bucket=${bucket} path=${pathDecoded}`);
  }
  const r = await fetch(data.signedUrl);
  if (!r.ok) {
    throw new Error(`Download signed URL HTTP ${r.status}`);
  }
  const buffer = Buffer.from(await r.arrayBuffer());
  return buffer.toString('base64');
}

/**
 * Converte resultado OCR pra FaturaRawInput.
 */
function ocrParaFaturaRawInput(ocr: OcrConciergeResultado): FaturaRawInput {
  const metadados: MetadadosRawInput = {
    distribuidora: ocr.metadados.distribuidora as MetadadosRawInput['distribuidora'],
    uf: ocr.metadados.uf,
    mesReferencia: ocr.metadados.mesReferencia,
    dataVencimento: ocr.metadados.dataVencimento,
    titularNome: ocr.metadados.titularNome,
    titularDocumento: ocr.metadados.titularDocumento,
    numeroUC: ocr.metadados.numeroUC,
    classificacao: ocr.metadados.classificacao,
    modalidadeTarifaria: ocr.metadados.modalidadeTarifaria,
    valorTotalFatura: ocr.metadados.valorTotalFatura,
    basePisCofinsDeclarada: ocr.metadados.basePisCofinsDeclarada,
    aliquotaPisDeclarada: ocr.metadados.aliquotaPisDeclarada,
    aliquotaCofinsDeclarada: ocr.metadados.aliquotaCofinsDeclarada,
  };
  const rubricas: RubricaRawInput[] = ocr.rubricas.map((r) => ({
    descricao: r.descricao,
    unidade: r.unidade,
    quantidade: r.quantidade,
    precoUnitarioComTributos: r.precoUnitarioComTributos,
    tarifaUnitariaBase: r.tarifaUnitariaBase,
    valorTotalReais: r.valorTotalReais,
    baseCalculoIcms: r.baseCalculoIcms,
    aliquotaIcms: r.aliquotaIcms,
    valorIcms: r.valorIcms,
    valorPisCofins: r.valorPisCofins,
  }));
  return { metadados, rubricas };
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const todos = args.includes('--todos');
  const cooperadoIdArg = args.find((a) => a.startsWith('--cooperado-id='))?.slice(15);
  const nomeArg = args
    .find((a) => a.startsWith('--nome='))
    ?.slice(7)
    .replace(/^"|"$/g, '');

  if (!todos && !cooperadoIdArg && !nomeArg) {
    console.log('Uso:');
    console.log('  --nome="parte do nome"      Re-OCR de cooperado específico');
    console.log('  --cooperado-id=<id>         Re-OCR por id Prisma');
    console.log('  --todos                     Re-OCR de TODAS as faturas CoopereBR');
    process.exit(1);
  }

  console.log('\n=== RE-OCR CONCIERGE — Extração rich + 4 detectores ===\n');
  const app = await NestFactory.createApplicationContext(AppModule, {
    logger: ['error', 'warn'],
  });
  const prisma = app.get(PrismaService);
  const detectores = app.get(DetectoresRegistry);
  const edpEsAdapter = new EdpEsFaturaAdapter();

  // Cliente Supabase com SERVICE_KEY pra gerar signed URLs (bucket privado)
  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY;
  if (!supabaseUrl || !supabaseServiceKey) {
    console.error('SUPABASE_URL e SUPABASE_SERVICE_KEY obrigatórios no .env');
    await app.close();
    process.exit(1);
  }
  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  const candidatas = await prisma.cooperativa.findMany({
    where: { nome: { contains: 'CoopereBR', mode: 'insensitive' } },
    select: { id: true, nome: true, _count: { select: { cooperados: true } } },
  });
  const coop = candidatas.reduce((max, atual) =>
    atual._count.cooperados > max._count.cooperados ? atual : max,
  );
  console.log(`Cooperativa: ${coop.nome} (id=${coop.id})\n`);

  // Resolve cooperados-alvo
  const whereFatura: Record<string, unknown> = { cooperado: { cooperativaId: coop.id } };
  if (cooperadoIdArg) whereFatura.cooperadoId = cooperadoIdArg;
  if (nomeArg) {
    whereFatura.cooperado = {
      cooperativaId: coop.id,
      nomeCompleto: { contains: nomeArg, mode: 'insensitive' },
    };
  }

  const faturas = await prisma.faturaProcessada.findMany({
    where: whereFatura,
    select: {
      id: true,
      arquivoUrl: true,
      mesReferencia: true,
      cooperadoId: true,
      cooperado: { select: { nomeCompleto: true } },
      dadosExtraidos: true,
    },
    orderBy: { createdAt: 'desc' },
  });

  console.log(`Faturas alvo: ${faturas.length}\n`);
  if (faturas.length === 0) {
    console.log('Nada a re-OCR.');
    await app.close();
    return;
  }

  const checkpoint = lerCheckpoint();
  const jaFeitos = new Set(checkpoint.faturasProcessadas);

  const resultados: ResultadoFaturaConcierge[] = [];
  let okCount = 0;
  let semAdapter = 0;
  let parseFalhou = 0;
  let ocrFalhou = 0;
  let downloadFalhou = 0;
  let puladas = 0;

  const inicio = Date.now();

  for (let i = 0; i < faturas.length; i++) {
    const f = faturas[i];
    const progresso = `[${i + 1}/${faturas.length}]`;
    const nome = f.cooperado?.nomeCompleto ?? '?';

    // Checkpoint: pula se já feita (a menos que use --force, não implementado)
    if (jaFeitos.has(f.id) && !cooperadoIdArg && !nomeArg) {
      puladas++;
      continue;
    }

    process.stdout.write(`${progresso} ${nome.slice(0, 35).padEnd(35)} ... `);

    if (!f.arquivoUrl) {
      console.log('SEM arquivoUrl — pula');
      downloadFalhou++;
      continue;
    }

    let pdfBase64: string;
    try {
      pdfBase64 = await baixarPdfBase64(f.arquivoUrl, supabase);
    } catch (err) {
      const msg = (err as Error).message.slice(0, 50);
      console.log(`✗ download falhou: ${msg}`);
      downloadFalhou++;
      resultados.push({
        cooperadoId: f.cooperadoId ?? '',
        cooperadoNome: nome,
        faturaId: f.id,
        mesReferencia: f.mesReferencia ?? '',
        distribuidora: '?',
        classificacao: '?',
        valorTotalFatura: 0,
        padroesDetectados: [],
        indebitoMensalTotal: 0,
        indebito60mSelicTotal: 0,
        status: 'download-falhou',
        erro: msg,
      });
      continue;
    }

    let ocr: OcrConciergeResultado;
    try {
      ocr = await chamarOcrConcierge(pdfBase64);
    } catch (err) {
      const msg = (err as Error).message.slice(0, 50);
      console.log(`✗ OCR falhou: ${msg}`);
      ocrFalhou++;
      resultados.push({
        cooperadoId: f.cooperadoId ?? '',
        cooperadoNome: nome,
        faturaId: f.id,
        mesReferencia: f.mesReferencia ?? '',
        distribuidora: '?',
        classificacao: '?',
        valorTotalFatura: 0,
        padroesDetectados: [],
        indebitoMensalTotal: 0,
        indebito60mSelicTotal: 0,
        status: 'ocr-falhou',
        erro: msg,
      });
      continue;
    }

    const dist = ocr.metadados.distribuidora;
    if (dist !== 'EDP_ES') {
      console.log(`⚠ adapter ${dist} não implementado — salva OCR mas pula detectores`);
      semAdapter++;
      // Persiste OCR rich mesmo sem adapter (vale ter pra análise futura)
      const merged = { ...(f.dadosExtraidos as object), concierge: { ocr, padroes: [], indebitoMensal: 0, indebito60m: 0 } };
      await prisma.faturaProcessada.update({
        where: { id: f.id },
        data: { dadosExtraidos: JSON.parse(JSON.stringify(merged)) as Prisma.InputJsonValue },
      });
      resultados.push({
        cooperadoId: f.cooperadoId ?? '',
        cooperadoNome: nome,
        faturaId: f.id,
        mesReferencia: ocr.metadados.mesReferencia,
        distribuidora: dist,
        classificacao: ocr.metadados.classificacao,
        valorTotalFatura: ocr.metadados.valorTotalFatura,
        padroesDetectados: [],
        indebitoMensalTotal: 0,
        indebito60mSelicTotal: 0,
        status: 'sem-adapter',
      });
      checkpoint.faturasProcessadas.push(f.id);
      salvarCheckpoint(checkpoint);
      continue;
    }

    const rawInput = ocrParaFaturaRawInput(ocr);
    const parseResult = edpEsAdapter.parsear(rawInput);
    if (!parseResult.sucesso) {
      console.log(`✗ adapter EDP_ES falhou: ${parseResult.motivo} — ${parseResult.detalhe.slice(0, 50)}`);
      parseFalhou++;
      resultados.push({
        cooperadoId: f.cooperadoId ?? '',
        cooperadoNome: nome,
        faturaId: f.id,
        mesReferencia: ocr.metadados.mesReferencia,
        distribuidora: dist,
        classificacao: ocr.metadados.classificacao,
        valorTotalFatura: ocr.metadados.valorTotalFatura,
        padroesDetectados: [],
        indebitoMensalTotal: 0,
        indebito60mSelicTotal: 0,
        status: 'parse-falhou',
        erro: `${parseResult.motivo}: ${parseResult.detalhe}`,
      });
      // Ainda persiste OCR pra análise
      const merged = { ...(f.dadosExtraidos as object), concierge: { ocr, parseErro: parseResult } };
      await prisma.faturaProcessada.update({
        where: { id: f.id },
        data: { dadosExtraidos: JSON.parse(JSON.stringify(merged)) as Prisma.InputJsonValue },
      });
      checkpoint.faturasProcessadas.push(f.id);
      salvarCheckpoint(checkpoint);
      continue;
    }

    const consolidado = detectores.detectarTodos(parseResult.fatura);
    console.log(
      `✓ ${consolidado.padroes.length} padrão(ões), R$ ${consolidado.indebitoMensalTotal.toFixed(2)}/mês`,
    );
    okCount++;

    // Persiste no banco
    const merged = {
      ...(f.dadosExtraidos as object),
      concierge: {
        ocr,
        faturaCanonica: parseResult.fatura,
        padroes: consolidado.padroes,
        indebitoMensalTotal: consolidado.indebitoMensalTotal,
        indebito60mSelicTotal: consolidado.indebito60mSelicTotal,
        processadoEm: new Date().toISOString(),
      },
    };
    await prisma.faturaProcessada.update({
      where: { id: f.id },
      data: { dadosExtraidos: JSON.parse(JSON.stringify(merged)) as Prisma.InputJsonValue },
    });

    resultados.push({
      cooperadoId: f.cooperadoId ?? '',
      cooperadoNome: nome,
      faturaId: f.id,
      mesReferencia: ocr.metadados.mesReferencia,
      distribuidora: dist,
      classificacao: ocr.metadados.classificacao,
      valorTotalFatura: ocr.metadados.valorTotalFatura,
      padroesDetectados: consolidado.padroes,
      indebitoMensalTotal: consolidado.indebitoMensalTotal,
      indebito60mSelicTotal: consolidado.indebito60mSelicTotal,
      status: 'ok',
    });

    checkpoint.faturasProcessadas.push(f.id);
    salvarCheckpoint(checkpoint);
  }

  const duracao = ((Date.now() - inicio) / 60_000).toFixed(1);
  console.log(`\n=== RESUMO ===`);
  console.log(`Duração:           ${duracao} min`);
  console.log(`Puladas (checkp):  ${puladas}`);
  console.log(`OK:                ${okCount}`);
  console.log(`Sem adapter:       ${semAdapter}`);
  console.log(`Parse falhou:      ${parseFalhou}`);
  console.log(`OCR falhou:        ${ocrFalhou}`);
  console.log(`Download falhou:   ${downloadFalhou}`);

  // ── XLSX consolidado ──
  if (resultados.length > 0) {
    const wb = new ExcelJS.Workbook();
    wb.creator = 'Concierge OCR + Detectores';
    wb.created = new Date();

    // Aba 1: Indébito por cooperado
    const ws1 = wb.addWorksheet('Indébito por cooperado', {
      properties: { tabColor: { argb: 'FFDC2626' } },
    });
    ws1.columns = [
      { header: 'Cooperado', key: 'nome', width: 34 },
      { header: 'Mês ref', key: 'mes', width: 10 },
      { header: 'Dist', key: 'dist', width: 10 },
      { header: 'Classif', key: 'cls', width: 22 },
      { header: 'Total fatura R$', key: 'total', width: 14 },
      { header: 'Status', key: 'status', width: 14 },
      { header: 'Padrões', key: 'qtdPadroes', width: 9 },
      { header: 'Indébito mês R$', key: 'indeMes', width: 15 },
      { header: 'Indébito 60m+SELIC', key: 'inde60', width: 18 },
      { header: 'Detalhe', key: 'det', width: 80 },
    ];
    ws1.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };
    ws1.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF991B1B' } };

    let totalGeralMes = 0;
    let totalGeral60m = 0;
    for (const r of resultados) {
      const det = r.padroesDetectados.map((p) => `${p.codigo}: R$${p.valorIndebitoMensal.toFixed(2)}`).join(' | ');
      ws1.addRow({
        nome: r.cooperadoNome,
        mes: r.mesReferencia,
        dist: r.distribuidora,
        cls: r.classificacao,
        total: r.valorTotalFatura,
        status: r.status,
        qtdPadroes: r.padroesDetectados.length,
        indeMes: r.indebitoMensalTotal,
        inde60: r.indebito60mSelicTotal,
        det: det || (r.erro ?? '-'),
      });
      totalGeralMes += r.indebitoMensalTotal;
      totalGeral60m += r.indebito60mSelicTotal;
    }

    // Aba 2: Resumo por tese
    const ws2 = wb.addWorksheet('Resumo por tese', {
      properties: { tabColor: { argb: 'FF7E22CE' } },
    });
    ws2.columns = [
      { header: 'Tese', key: 'tese', width: 32 },
      { header: 'Faturas afetadas', key: 'qtd', width: 16 },
      { header: 'Indébito mensal total', key: 'mensal', width: 22 },
      { header: 'Indébito 60m+SELIC total', key: 'sextenta', width: 24 },
      { header: 'Risco', key: 'risco', width: 10 },
    ];
    ws2.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };
    ws2.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF581C87' } };
    const porTese = new Map<string, { qtd: number; mensal: number; sextenta: number; risco: string }>();
    for (const r of resultados) {
      for (const p of r.padroesDetectados) {
        const stat = porTese.get(p.codigo) ?? { qtd: 0, mensal: 0, sextenta: 0, risco: p.fundamento.risco };
        stat.qtd++;
        stat.mensal += p.valorIndebitoMensal;
        stat.sextenta += p.valorIndebito60mSelic;
        porTese.set(p.codigo, stat);
      }
    }
    for (const [tese, s] of porTese) {
      ws2.addRow({ tese, qtd: s.qtd, mensal: s.mensal, sextenta: s.sextenta, risco: s.risco });
    }

    // Aba 3: Resumo executivo
    const ws3 = wb.addWorksheet('Resumo executivo', {
      properties: { tabColor: { argb: 'FF16A34A' } },
    });
    ws3.columns = [
      { header: 'Métrica', key: 'm', width: 40 },
      { header: 'Valor', key: 'v', width: 22 },
    ];
    ws3.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };
    ws3.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF15803D' } };
    const linhas = [
      ['Total faturas auditadas', faturas.length],
      ['OK (detectores rodaram)', okCount],
      ['Sem adapter (CEMIG/outras)', semAdapter],
      ['Parse falhou', parseFalhou],
      ['OCR falhou', ocrFalhou],
      ['', ''],
      ['Indébito MENSAL total estimado', `R$ ${totalGeralMes.toFixed(2)}`],
      ['Indébito 60m+SELIC total estimado', `R$ ${totalGeral60m.toFixed(2)}`],
      ['', ''],
      ['Médio mensal por cooperado OK', okCount > 0 ? `R$ ${(totalGeralMes / okCount).toFixed(2)}` : '-'],
      ['Médio 60m+SELIC por cooperado OK', okCount > 0 ? `R$ ${(totalGeral60m / okCount).toFixed(2)}` : '-'],
    ];
    for (const [m, v] of linhas) {
      ws3.addRow({ m, v });
    }

    const outDir = path.resolve('C:/Users/Luciano/OneDrive/Documentos/Claude/Projects/CoopereBR');
    fs.mkdirSync(outDir, { recursive: true });
    const stamp = new Date().toISOString().slice(0, 10);
    const outFile = path.join(outDir, `concierge-indebitos-${stamp}.xlsx`);
    await wb.xlsx.writeFile(outFile);
    console.log(`\n✓ XLSX consolidado: ${outFile}`);
    console.log(`  Aba 1 (vermelho): Indébito por cooperado`);
    console.log(`  Aba 2 (roxo):     Resumo por tese`);
    console.log(`  Aba 3 (verde):    Resumo executivo`);
    console.log(`\n💰 INDÉBITO TOTAL ESTIMADO:`);
    console.log(`   Mensal:      R$ ${totalGeralMes.toFixed(2)}`);
    console.log(`   60m+SELIC:   R$ ${totalGeral60m.toFixed(2)}`);
  }

  console.log(`\nCheckpoint: ${CHECKPOINT_PATH}`);
  console.log(`Pra reprocessar: delete o checkpoint.\n`);

  await app.close();
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
