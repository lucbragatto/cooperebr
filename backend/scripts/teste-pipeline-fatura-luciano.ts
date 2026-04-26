/**
 * Sprint 11 Bloco 2 Fase D — E2E do pipeline OCR com fatura real do Luciano.
 *
 * Lê o PDF da fatura, chama Claude OCR via FaturasService, valida que os 3
 * campos de identificação + distribuidora vêm corretamente, e roda
 * resolverUcPorNumero pra confirmar que match na UC do Luciano funciona.
 *
 * Read-only por padrão. Não cria FaturaProcessada nem persiste nada.
 *
 * Rodar: npx ts-node backend/scripts/teste-pipeline-fatura-luciano.ts
 */
import { NestFactory } from '@nestjs/core';
import * as fs from 'fs';
import * as path from 'path';
import { AppModule } from '../src/app.module';
import { FaturasService, resolverUcPorNumero } from '../src/faturas/faturas.service';
import { PrismaService } from '../src/prisma.service';
import { coerceDistribuidora } from '../src/ucs/ucs.service';

const FIXTURE_PDF = path.join(__dirname, '..', 'test', 'fixtures', 'faturas', 'edp-luciano-gd.pdf');
const CPF_LUCIANO = '89089324704';
const RELATORIO_PATH = path.join(__dirname, '..', '..', 'docs', 'sessoes', '2026-04-26-sprint11-fase-d-e2e.md');

interface Findings {
  pdfBytes: number;
  ocrTempoMs: number;
  matchTempoMs: number;
  dadosExtraidos: any;
  ucEsperada: { id: string; numero: string; numeroUC: string | null; numeroConcessionariaOriginal: string | null; cooperativaId: string | null } | null;
  matchPorCampo: { campo: string; ucEncontrada: string | null }[];
  validacoes: { item: string; passou: boolean; detalhe: string }[];
  resultadoFinal: 'PASSOU' | 'FALHOU' | 'PARCIAL';
}

async function main() {
  const findings: Partial<Findings> = {
    matchPorCampo: [],
    validacoes: [],
  };

  console.log(`[1/5] Carregando PDF: ${FIXTURE_PDF}`);
  if (!fs.existsSync(FIXTURE_PDF)) throw new Error(`Fixture não encontrada: ${FIXTURE_PDF}`);
  const pdfBuffer = fs.readFileSync(FIXTURE_PDF);
  const pdfBase64 = pdfBuffer.toString('base64');
  findings.pdfBytes = pdfBuffer.length;
  console.log(`     OK — ${(pdfBuffer.length / 1024).toFixed(0)} KB`);

  const app = await NestFactory.createApplicationContext(AppModule, { logger: ['error', 'warn'] });
  const faturas = app.get(FaturasService);
  const prisma = app.get(PrismaService);

  console.log(`[2/5] Buscando UC esperada (Luciano cpf=${CPF_LUCIANO})...`);
  const luciano = await prisma.cooperado.findFirst({
    where: { cpf: CPF_LUCIANO },
    include: {
      ucs: {
        select: { id: true, numero: true, numeroUC: true, numeroConcessionariaOriginal: true, cooperativaId: true, distribuidora: true },
      },
    },
  });
  if (!luciano) throw new Error('Cooperado Luciano não encontrado no banco');
  console.log(`     Cooperado id=${luciano.id} cooperativaId=${luciano.cooperativaId}`);
  console.log(`     UCs cadastradas: ${luciano.ucs.length}`);
  for (const u of luciano.ucs) {
    console.log(`       - id=${u.id.slice(-8)} numero=${u.numero} numeroUC=${u.numeroUC ?? '-'} numeroConcOrig=${u.numeroConcessionariaOriginal ?? '-'} dist=${u.distribuidora}`);
  }
  // Pegar UC mais provável (Vitória, com numeroUC preenchido se possível)
  findings.ucEsperada = luciano.ucs.find(u => u.numeroUC) ?? luciano.ucs[0] ?? null;
  if (findings.ucEsperada) {
    console.log(`     UC esperada: id=${findings.ucEsperada.id} numero=${findings.ucEsperada.numero}`);
  } else {
    console.log(`     ⚠ Cooperado Luciano sem UC cadastrada — match não pode ser validado`);
  }

  console.log(`[3/5] Chamando Claude OCR (custo estimado: $0.10-0.20)...`);
  const t0 = Date.now();
  const dados: any = await faturas.extrairOcr(pdfBase64, 'pdf');
  findings.ocrTempoMs = Date.now() - t0;
  findings.dadosExtraidos = dados;
  console.log(`     OK — ${findings.ocrTempoMs}ms — ${Object.keys(dados).length} campos extraídos`);

  // Imprimir só os 4 campos críticos pra log do console
  console.log(`     distribuidora: ${dados.distribuidora}`);
  console.log(`     numero: ${dados.numero ?? '(vazio)'}`);
  console.log(`     numeroUC: ${dados.numeroUC ?? '(vazio)'}`);
  console.log(`     numeroConcessionariaOriginal: ${dados.numeroConcessionariaOriginal ?? '(vazio)'}`);

  // Validações
  const dist = coerceDistribuidora(String(dados.distribuidora ?? ''));
  findings.validacoes!.push({
    item: 'distribuidora normalizada via coerceDistribuidora',
    passou: dist === 'EDP_ES',
    detalhe: `OCR=${dados.distribuidora} → enum=${dist}`,
  });

  const tem3Campos = !!(dados.numero || dados.numeroUC || dados.numeroConcessionariaOriginal);
  findings.validacoes!.push({
    item: 'Pelo menos 1 dos 3 campos de número preenchido',
    passou: tem3Campos,
    detalhe: `numero=${!!dados.numero} numeroUC=${!!dados.numeroUC} numeroConcOrig=${!!dados.numeroConcessionariaOriginal}`,
  });

  if (dados.numeroConcessionariaOriginal && /[.\-/]/.test(String(dados.numeroConcessionariaOriginal))) {
    findings.validacoes!.push({
      item: 'numeroConcessionariaOriginal preserva pontuação',
      passou: true,
      detalhe: `valor="${dados.numeroConcessionariaOriginal}"`,
    });
  }

  console.log(`[4/5] Testando resolverUcPorNumero com cada candidato...`);
  if (!luciano.cooperativaId) {
    console.log(`     ⚠ Luciano sem cooperativaId — não posso testar match`);
  } else {
    const tenantId = luciano.cooperativaId;
    const t1 = Date.now();
    const candidatos: Array<[string, string | undefined]> = [
      ['numero', dados.numero],
      ['numeroUC', dados.numeroUC],
      ['numeroConcessionariaOriginal', dados.numeroConcessionariaOriginal],
    ];
    for (const [origem, valor] of candidatos) {
      if (!valor) {
        findings.matchPorCampo!.push({ campo: origem, ucEncontrada: null });
        console.log(`     ${origem}: (vazio, pulando)`);
        continue;
      }
      const uc = await resolverUcPorNumero(prisma, tenantId, valor, console as any, dist);
      findings.matchPorCampo!.push({ campo: origem, ucEncontrada: uc?.id ?? null });
      console.log(`     ${origem}=${valor} → ${uc ? `UC ${uc.id} (numero=${uc.numero})` : 'sem match'}`);
    }
    findings.matchTempoMs = Date.now() - t1;

    const algumMatch = findings.matchPorCampo!.some(m => m.ucEncontrada);
    findings.validacoes!.push({
      item: 'resolverUcPorNumero encontra UC com pelo menos um candidato',
      passou: algumMatch,
      detalhe: algumMatch
        ? `match em: ${findings.matchPorCampo!.filter(m => m.ucEncontrada).map(m => m.campo).join(', ')}`
        : 'nenhum dos 3 candidatos deu match',
    });

    const ucEsperadaId = findings.ucEsperada?.id;
    if (ucEsperadaId) {
      const matchCorreto = findings.matchPorCampo!.some(m => m.ucEncontrada === ucEsperadaId);
      findings.validacoes!.push({
        item: 'Match aponta pra UC correta do Luciano',
        passou: matchCorreto,
        detalhe: matchCorreto ? `UC ${ucEsperadaId} confirmada` : `Esperado ${ucEsperadaId}, encontrado ${findings.matchPorCampo!.find(m => m.ucEncontrada)?.ucEncontrada ?? 'nada'}`,
      });
    }
  }

  console.log(`[5/5] Gerando relatório...`);
  const passaram = findings.validacoes!.filter(v => v.passou).length;
  const total = findings.validacoes!.length;
  findings.resultadoFinal = passaram === total ? 'PASSOU' : passaram === 0 ? 'FALHOU' : 'PARCIAL';

  const md = montarRelatorio(findings as Findings);
  fs.writeFileSync(RELATORIO_PATH, md);
  console.log(`     Relatório: ${RELATORIO_PATH}`);
  console.log(`\n=== RESULTADO FINAL: ${findings.resultadoFinal} (${passaram}/${total}) ===`);

  await app.close();
}

function montarRelatorio(f: Findings): string {
  const dataHora = new Date().toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' });
  const sinal = (passou: boolean) => (passou ? '✅' : '❌');

  return `# Sprint 11 Fase D — E2E pipeline OCR com fatura real do Luciano

**Data:** ${dataHora}
**Resultado:** ${f.resultadoFinal === 'PASSOU' ? '✅ PASSOU' : f.resultadoFinal === 'FALHOU' ? '❌ FALHOU' : '⚠️ PARCIAL'}

## Resumo executivo

- PDF: ${(f.pdfBytes / 1024).toFixed(0)} KB (\`backend/test/fixtures/faturas/edp-luciano-gd.pdf\`)
- OCR Claude: ${f.ocrTempoMs}ms — ${Object.keys(f.dadosExtraidos).length} campos extraídos
- Match resolverUcPorNumero: ${f.matchTempoMs ?? '-'}ms

## Validações

| # | Item | Status | Detalhe |
|---|---|---|---|
${f.validacoes.map((v, i) => `| ${i + 1} | ${v.item} | ${sinal(v.passou)} | ${v.detalhe} |`).join('\n')}

## UC esperada (Luciano)

${f.ucEsperada ? `- id: \`${f.ucEsperada.id}\`
- numero: \`${f.ucEsperada.numero}\`
- numeroUC: \`${f.ucEsperada.numeroUC ?? '-'}\`
- numeroConcessionariaOriginal: \`${f.ucEsperada.numeroConcessionariaOriginal ?? '-'}\`
- cooperativaId: \`${f.ucEsperada.cooperativaId ?? '-'}\`` : '⚠️ Cooperado Luciano sem UC cadastrada — match não pôde ser validado'}

## Match em qual campo

| Origem | Encontrada |
|---|---|
${f.matchPorCampo.map(m => `| ${m.campo} | ${m.ucEncontrada ?? '(sem match)'} |`).join('\n')}

## Dados extraídos pelo OCR (4 campos críticos)

\`\`\`json
${JSON.stringify({
  distribuidora: f.dadosExtraidos.distribuidora,
  numero: f.dadosExtraidos.numero,
  numeroUC: f.dadosExtraidos.numeroUC,
  numeroConcessionariaOriginal: f.dadosExtraidos.numeroConcessionariaOriginal,
}, null, 2)}
\`\`\`

## JSON completo

<details><summary>Clique para ver os ${Object.keys(f.dadosExtraidos).length} campos</summary>

\`\`\`json
${JSON.stringify(f.dadosExtraidos, null, 2)}
\`\`\`

</details>

## Próximos passos

${f.resultadoFinal === 'PASSOU'
  ? '- Sprint 11 Bloco 2 Fase D entregue. Fechar Sprint 11.\n- Próximo: validação E2E real com fatura nova chegando via IMAP (cron diário) — produção/Sprint 12.'
  : f.resultadoFinal === 'PARCIAL'
    ? '- Investigar validações que falharam.\n- Possíveis causas: prompt OCR ainda volta `distribuidora` como texto livre em alguns formatos; UC do Luciano sem `numeroUC` preenchido; etc.'
    : '- Pipeline NÃO funcionou. Investigar antes de fechar Sprint 11.\n- Verificar `backend/scripts/teste-pipeline-fatura-luciano.ts` linha por linha.\n- Confirmar que CLAUDE_OCR_API_KEY está válido no .env.'}
`;
}

main().catch(e => {
  console.error('FALHA:', e);
  process.exit(1);
});
