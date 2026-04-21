/**
 * Sprint 5 T8 Parte B — Smoke test multi-fixture do pipeline OCR.
 *
 * Roda manualmente:
 *   npx ts-node backend/scripts/smoke-pipeline-fatura.ts           # hibrido: chama OCR e compara com expected
 *   npx ts-node backend/scripts/smoke-pipeline-fatura.ts --cached  # economia: so valida setup
 *   npx ts-node backend/scripts/smoke-pipeline-fatura.ts --update  # regenera todas expected.json
 *
 * Fixtures: toda pasta backend/test/fixtures/faturas/*.pdf e.
 * Cada PDF gera/compara com <nome>-expected.json na mesma pasta.
 *
 * Campos criticos: divergencia falha o teste. Outros campos geram warning.
 */

import { NestFactory } from '@nestjs/core';
import { AppModule } from '../src/app.module';
import { FaturasService } from '../src/faturas/faturas.service';
import * as fs from 'fs';
import * as path from 'path';

const FIXTURES_DIR = path.resolve(__dirname, '../test/fixtures/faturas');

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

function listarFixturesPdf(): string[] {
  if (!fs.existsSync(FIXTURES_DIR)) {
    console.error(red(`Pasta nao encontrada: ${FIXTURES_DIR}`));
    process.exit(1);
  }
  return fs.readdirSync(FIXTURES_DIR)
    .filter((f) => f.endsWith('.pdf'))
    .sort();
}

function pathExpected(pdfName: string): string {
  const base = pdfName.replace(/\.pdf$/, '');
  return path.join(FIXTURES_DIR, `${base}-expected.json`);
}

function printTable(esperado: any, extraido: any): { falhouCritico: boolean; divergencias: number } {
  const todasChaves = Array.from(new Set([
    ...Object.keys(esperado ?? {}),
    ...Object.keys(extraido ?? {}),
  ])).sort();

  console.log('');
  console.log(bold(`    ${'CAMPO'.padEnd(28)} ${'ESPERADO'.padEnd(26)} ${'EXTRAIDO'.padEnd(26)} STATUS`));
  console.log(gray('    ' + '-'.repeat(90)));

  let falhouCritico = false;
  let divergencias = 0;

  for (const chave of todasChaves) {
    const eVal = esperado?.[chave];
    const xVal = extraido?.[chave];
    const critico = CAMPOS_CRITICOS.includes(chave);
    const igual = JSON.stringify(eVal) === JSON.stringify(xVal);

    let status: string;
    if (igual) {
      status = green('OK');
    } else {
      divergencias++;
      if (critico) {
        falhouCritico = true;
        status = red('DIVERGE (CRITICO)');
      } else {
        status = yellow('diverge');
      }
    }

    const marcador = critico ? bold(chave) : chave;
    console.log(
      `    ${marcador.padEnd(28 + (critico ? 8 : 0))} ` +
      `${truncate(String(eVal ?? '(vazio)'), 26).padEnd(26)} ` +
      `${truncate(String(xVal ?? '(vazio)'), 26).padEnd(26)} ` +
      `${status}`,
    );
  }
  console.log('');
  return { falhouCritico, divergencias };
}

async function processarFixture(
  faturasService: FaturasService,
  pdfName: string,
  modo: Modo,
): Promise<{ nome: string; status: 'OK' | 'WARN' | 'FAIL'; detalhes: string }> {
  const pdfPath = path.join(FIXTURES_DIR, pdfName);
  const expectedPath = pathExpected(pdfName);
  const expectedExists = fs.existsSync(expectedPath);

  console.log(bold(`\n=== ${pdfName} ===`));
  console.log(gray(`    PDF: ${pdfPath} (${fs.statSync(pdfPath).size} bytes)`));

  if (modo === 'CACHED') {
    if (!expectedExists) {
      console.log(red(`    Fixture esperada ausente: ${path.basename(expectedPath)}`));
      return { nome: pdfName, status: 'FAIL', detalhes: 'expected.json ausente' };
    }
    const esperado = JSON.parse(fs.readFileSync(expectedPath, 'utf-8'));
    console.log(green(`    OK — expected.json existe (${Object.keys(esperado).length} campos)`));
    return { nome: pdfName, status: 'OK', detalhes: `${Object.keys(esperado).length} campos cached` };
  }

  if (modo === 'HIBRIDO' && !expectedExists) {
    console.log(red(`    Fixture esperada ausente. Rode --update primeiro.`));
    return { nome: pdfName, status: 'FAIL', detalhes: 'expected.json ausente (rode --update)' };
  }

  console.log(yellow(`    Chamando Anthropic API...`));
  const pdfBase64 = fs.readFileSync(pdfPath).toString('base64');
  const inicio = Date.now();
  let extraido: any;
  try {
    extraido = await faturasService.extrairOcr(pdfBase64, 'pdf');
  } catch (err: any) {
    console.log(red(`    OCR falhou: ${err.message}`));
    return { nome: pdfName, status: 'FAIL', detalhes: `OCR: ${err.message}` };
  }
  const duracao = ((Date.now() - inicio) / 1000).toFixed(1);
  console.log(green(`    OCR ok em ${duracao}s (${Object.keys(extraido).length} campos)`));

  if (modo === 'UPDATE') {
    fs.writeFileSync(expectedPath, JSON.stringify(extraido, null, 2) + '\n', 'utf-8');
    console.log(green(`    Fixture salva: ${path.basename(expectedPath)}`));
    return { nome: pdfName, status: 'OK', detalhes: `${Object.keys(extraido).length} campos salvos` };
  }

  // HIBRIDO: compara
  const esperado = JSON.parse(fs.readFileSync(expectedPath, 'utf-8'));
  const { falhouCritico, divergencias } = printTable(esperado, extraido);

  if (falhouCritico) {
    return { nome: pdfName, status: 'FAIL', detalhes: `${divergencias} divergencias, campos criticos afetados` };
  }
  if (divergencias > 0) {
    return { nome: pdfName, status: 'WARN', detalhes: `${divergencias} divergencias nao-criticas` };
  }
  return { nome: pdfName, status: 'OK', detalhes: '100% fiel a fixture' };
}

async function main() {
  const modo = parseArgs();
  const fixtures = listarFixturesPdf();

  console.log(bold(`\n=== Smoke test multi-fixture — modo: ${modo} ===`));
  console.log(gray(`Fixtures encontradas: ${fixtures.length}`));
  fixtures.forEach((f) => console.log(gray(`  - ${f}`)));

  if (fixtures.length === 0) {
    console.error(red('Nenhum PDF na pasta de fixtures.'));
    process.exit(1);
  }

  let app: any = null;
  let faturasService: FaturasService | null = null;

  if (modo !== 'CACHED') {
    console.log(gray('\nSubindo contexto Nest...'));
    app = await NestFactory.createApplicationContext(AppModule, {
      logger: ['error', 'warn'],
    });
    faturasService = app.get(FaturasService);
  }

  const resultados: Array<{ nome: string; status: 'OK' | 'WARN' | 'FAIL'; detalhes: string }> = [];
  for (const pdf of fixtures) {
    const r = await processarFixture(faturasService as any, pdf, modo);
    resultados.push(r);
  }

  if (app) await app.close();

  // Resumo
  console.log(bold('\n=== RESUMO ==='));
  const okCount = resultados.filter((r) => r.status === 'OK').length;
  const warnCount = resultados.filter((r) => r.status === 'WARN').length;
  const failCount = resultados.filter((r) => r.status === 'FAIL').length;

  for (const r of resultados) {
    const cor = r.status === 'OK' ? green : r.status === 'WARN' ? yellow : red;
    console.log(`  ${cor(r.status.padEnd(5))} ${r.nome.padEnd(30)} ${gray(r.detalhes)}`);
  }
  console.log('');
  console.log(`Total: ${green(`${okCount} OK`)}, ${yellow(`${warnCount} WARN`)}, ${red(`${failCount} FAIL`)}`);

  if (failCount > 0) process.exit(2);
  if (warnCount > 0) process.exit(0); // WARN não bloqueia
  process.exit(0);
}

main().catch((err) => {
  console.error(red(`\nErro fatal: ${err.message}`));
  console.error(err.stack);
  process.exit(1);
});
