/**
 * Sprint 5 T8 Parte B — Smoke test do pipeline OCR com fatura EDP real.
 *
 * Roda manualmente:
 *   npx ts-node backend/scripts/smoke-pipeline-fatura.ts           # modo híbrido (chama OCR real e compara)
 *   npx ts-node backend/scripts/smoke-pipeline-fatura.ts --cached  # modo economia (sem chamar OCR)
 *   npx ts-node backend/scripts/smoke-pipeline-fatura.ts --update  # regenera fixture expected (use quando OCR mudou intencionalmente)
 *
 * Fixture:
 *   backend/test/fixtures/faturas/edp-carol.pdf         — PDF real (input)
 *   backend/test/fixtures/faturas/edp-carol-expected.json — saída esperada do OCR (output)
 *
 * Se expected.json não existir e você rodar sem --update, script avisa e pede pra rodar --update primeiro.
 *
 * NÃO é teste Jest. É script de validação que você roda sob demanda, especialmente antes de destravar T9.
 */

import { NestFactory } from '@nestjs/core';
import { AppModule } from '../src/app.module';
import { FaturasService } from '../src/faturas/faturas.service';
import * as fs from 'fs';
import * as path from 'path';

const PDF_PATH = path.resolve(__dirname, '../test/fixtures/faturas/edp-carol.pdf');
const EXPECTED_JSON_PATH = path.resolve(__dirname, '../test/fixtures/faturas/edp-carol-expected.json');

// Campos considerados críticos — divergência aqui falha o smoke test.
// Outros campos são reportados mas não bloqueiam.
const CAMPOS_CRITICOS = [
  'numeroUC',
  'consumoAtualKwh',
  'totalAPagar',
  'creditosRecebidosKwh',
  'mesReferencia',
];

type Modo = 'HIBRIDO' | 'CACHED' | 'UPDATE';

function parseArgs(): Modo {
  const args = process.argv.slice(2);
  if (args.includes('--cached')) return 'CACHED';
  if (args.includes('--update')) return 'UPDATE';
  return 'HIBRIDO';
}

function bold(s: string) { return `\x1b[1m${s}\x1b[0m`; }
function red(s: string) { return `\x1b[31m${s}\x1b[0m`; }
function green(s: string) { return `\x1b[32m${s}\x1b[0m`; }
function yellow(s: string) { return `\x1b[33m${s}\x1b[0m`; }
function gray(s: string) { return `\x1b[90m${s}\x1b[0m`; }

function truncate(s: string, n: number): string {
  if (s.length <= n) return s;
  return s.slice(0, n - 3) + '...';
}

function printTable(esperado: any, extraido: any): { falhouCritico: boolean; divergencias: number } {
  const todasChaves = Array.from(new Set([
    ...Object.keys(esperado ?? {}),
    ...Object.keys(extraido ?? {}),
  ])).sort();

  console.log('');
  console.log(bold(`  ${'CAMPO'.padEnd(28)} ${'ESPERADO'.padEnd(26)} ${'EXTRAÍDO'.padEnd(26)} STATUS`));
  console.log(gray('  ' + '─'.repeat(90)));

  let falhouCritico = false;
  let divergencias = 0;

  for (const chave of todasChaves) {
    const eVal = esperado?.[chave];
    const xVal = extraido?.[chave];
    const critico = CAMPOS_CRITICOS.includes(chave);
    const igual = JSON.stringify(eVal) === JSON.stringify(xVal);

    let status: string;
    if (igual) {
      status = green('✓ OK');
    } else {
      divergencias++;
      if (critico) {
        falhouCritico = true;
        status = red('✗ DIVERGE (CRÍTICO)');
      } else {
        status = yellow('≠ diverge');
      }
    }

    const marcador = critico ? bold(chave) : chave;
    console.log(
      `  ${marcador.padEnd(28 + (critico ? 8 : 0))} ` +
      `${truncate(String(eVal ?? '(vazio)'), 26).padEnd(26)} ` +
      `${truncate(String(xVal ?? '(vazio)'), 26).padEnd(26)} ` +
      `${status}`,
    );
  }
  console.log('');
  return { falhouCritico, divergencias };
}

async function main() {
  const modo = parseArgs();
  console.log(bold(`\n=== Smoke test pipeline OCR — modo: ${modo} ===\n`));

  // Validar fixture
  if (!fs.existsSync(PDF_PATH)) {
    console.error(red(`❌ PDF não encontrado: ${PDF_PATH}`));
    process.exit(1);
  }
  console.log(gray(`  PDF: ${PDF_PATH}`));

  const expectedExists = fs.existsSync(EXPECTED_JSON_PATH);

  // CACHED: só verifica que arquivos existem, não chama OCR
  if (modo === 'CACHED') {
    if (!expectedExists) {
      console.error(red(`❌ Fixture esperada não existe: ${EXPECTED_JSON_PATH}`));
      console.error(red(`   Rode primeiro: npx ts-node backend/scripts/smoke-pipeline-fatura.ts --update`));
      process.exit(1);
    }
    const esperado = JSON.parse(fs.readFileSync(EXPECTED_JSON_PATH, 'utf-8'));
    console.log(green(`  ✓ PDF existe (${fs.statSync(PDF_PATH).size} bytes)`));
    console.log(green(`  ✓ Fixture esperada existe (${Object.keys(esperado).length} campos)`));
    console.log(gray(`\n  Modo CACHED: não chamou OCR. Integridade do setup OK.\n`));
    process.exit(0);
  }

  // Pra HIBRIDO e UPDATE: precisa chamar OCR
  if (modo === 'HIBRIDO' && !expectedExists) {
    console.error(red(`❌ Fixture esperada ainda não existe: ${EXPECTED_JSON_PATH}`));
    console.error(yellow(`   Primeira execução: rode --update pra gerar a fixture.`));
    console.error(gray(`   npx ts-node backend/scripts/smoke-pipeline-fatura.ts --update`));
    process.exit(1);
  }

  console.log(gray('  Subindo contexto Nest (pode demorar ~2s)...'));
  const app = await NestFactory.createApplicationContext(AppModule, {
    logger: ['error', 'warn'],
  });
  const faturasService = app.get(FaturasService);

  console.log(gray('  Lendo PDF...'));
  const pdfBase64 = fs.readFileSync(PDF_PATH).toString('base64');

  console.log(yellow(`  Chamando Anthropic API (consome tokens)...`));
  const inicioOcr = Date.now();
  let extraido: any;
  try {
    extraido = await faturasService.extrairOcr(pdfBase64, 'pdf');
  } catch (err: any) {
    console.error(red(`❌ OCR falhou: ${err.message}`));
    await app.close();
    process.exit(1);
  }
  const duracaoMs = Date.now() - inicioOcr;
  console.log(green(`  ✓ OCR completou em ${(duracaoMs / 1000).toFixed(1)}s`));

  await app.close();

  // UPDATE: salva como nova fixture
  if (modo === 'UPDATE') {
    fs.writeFileSync(EXPECTED_JSON_PATH, JSON.stringify(extraido, null, 2) + '\n', 'utf-8');
    console.log(green(`\n  ✓ Fixture salva: ${EXPECTED_JSON_PATH}`));
    console.log(bold('\n  Saída do OCR:'));
    console.log(JSON.stringify(extraido, null, 2));
    console.log(yellow(`\n  ⚠��  Revise manualmente se os campos extraídos fazem sentido.`));
    console.log(yellow(`     Se estiver tudo certo, commit o JSON:`));
    console.log(gray(`     git add backend/test/fixtures/faturas/edp-carol-expected.json`));
    process.exit(0);
  }

  // HIBRIDO: compara com fixture
  const esperado = JSON.parse(fs.readFileSync(EXPECTED_JSON_PATH, 'utf-8'));
  console.log(bold(`\n  Comparando com fixture (${EXPECTED_JSON_PATH}):`));

  const { falhouCritico, divergencias } = printTable(esperado, extraido);

  if (falhouCritico) {
    console.error(red(bold('  ❌ FALHOU — campos críticos divergiram')));
    console.error(yellow(`     Se a mudança for intencional (ex: schema do OCR mudou),`));
    console.error(yellow(`     rode --update pra regenerar a fixture.`));
    process.exit(2);
  }

  if (divergencias > 0) {
    console.warn(yellow(bold(`  ⚠️  PASSOU com ${divergencias} divergência(s) não-crítica(s)`)));
    console.log(gray(`     Campos críticos OK: ${CAMPOS_CRITICOS.join(', ')}`));
  } else {
    console.log(green(bold(`  ✓ PASSOU — 100% fiel à fixture`)));
  }

  process.exit(0);
}

main().catch((err) => {
  console.error(red(`\nErro fatal: ${err.message}`));
  console.error(err.stack);
  process.exit(1);
});
