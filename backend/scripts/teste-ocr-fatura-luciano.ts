/**
 * Teste OCR com fatura real do Luciano (UID 2032, ago/2025).
 * Não processa, não cria FaturaProcessada, não move email.
 * Baixa PDF via IMAP, chama extrairOcr direto, simula os 3 modelos.
 */
import { NestFactory } from '@nestjs/core';
import { ImapFlow } from 'imapflow';
import { simpleParser } from 'mailparser';
import * as fs from 'fs';
import * as path from 'path';
import { AppModule } from '../src/app.module';
import { FaturasService } from '../src/faturas/faturas.service';

const UID_ALVO = 2032;

async function baixarFatura(): Promise<{ filename: string; base64: string; bytes: number }> {
  const client = new ImapFlow({
    host: process.env.EMAIL_IMAP_HOST || 'imap.gmail.com',
    port: Number(process.env.EMAIL_IMAP_PORT || 993),
    secure: true,
    auth: { user: process.env.EMAIL_IMAP_USER!, pass: process.env.EMAIL_IMAP_PASS! },
    tls: { rejectUnauthorized: false },
    logger: false,
  });
  await client.connect();
  const lock = await client.getMailboxLock('INBOX', { readonly: true });
  let resultado: any = null;
  try {
    const msgs = client.fetch(UID_ALVO, { source: true, uid: true }, { uid: true });
    for await (const msg of msgs) {
      const parsed = await simpleParser(msg.source);
      const pdf = (parsed.attachments || []).find(a => (a.filename || '').toLowerCase().endsWith('.pdf'));
      if (!pdf) throw new Error('Sem anexo PDF na UID ' + UID_ALVO);
      resultado = {
        filename: pdf.filename!,
        base64: pdf.content.toString('base64'),
        bytes: pdf.content.length,
      };
    }
  } finally {
    lock.release();
  }
  await client.logout();
  if (!resultado) throw new Error('Fatura não encontrada');
  return resultado;
}

function simularModelos(dados: any) {
  const kwhConsumido = Number(dados.consumoAtualKwh ?? 0);
  const creditosKwh = Number(dados.creditosRecebidosKwh ?? 0);
  const valorSemDesconto = Number(dados.valorSemDesconto ?? dados.valorTotal ?? 0);
  const valorFaturado = Number(dados.valorTotal ?? 0);
  const tarifaTUSD = Number(dados.tarifaTUSD ?? 0);
  const tarifaTE = Number(dados.tarifaTE ?? 0);
  const tarifaCheia = tarifaTUSD + tarifaTE;

  // FIXO_MENSAL — valor arbitrário
  const fixo = { valor: 500, parametro: 'R$ 500 fixo', economia: Math.round((valorSemDesconto - 500) * 100) / 100 };

  // CREDITOS_COMPENSADOS — travado em R$ 0,80/kWh
  const tarifaCompensados = 0.80;
  const compensadosValor = Math.round(creditosKwh * tarifaCompensados * 100) / 100;
  const compensados = {
    valor: compensadosValor,
    parametro: 'R$ 0,80/kWh × créditos compensados',
    temCreditos: creditosKwh > 0,
    economia: Math.round((valorSemDesconto - compensadosValor) * 100) / 100,
  };

  // CREDITOS_DINAMICO — desconto 20% sobre tarifa cheia
  const descontoPct = 0.20;
  const tarifaAplicada = Math.round(tarifaCheia * (1 - descontoPct) * 10000) / 10000;
  const dinamicoValor = Math.round(creditosKwh * tarifaAplicada * 100) / 100;
  const dinamico = {
    valor: dinamicoValor,
    parametro: `20% off × ${creditosKwh} kWh × R$ ${tarifaAplicada}/kWh`,
    temCreditos: creditosKwh > 0,
    tarifaCheia: Math.round(tarifaCheia * 10000) / 10000,
    tarifaAplicada,
    economia: Math.round((valorSemDesconto - dinamicoValor) * 100) / 100,
  };

  return { kwhConsumido, creditosKwh, valorSemDesconto, valorFaturado, tarifaCheia, fixo, compensados, dinamico };
}

async function main() {
  console.log(`[1/4] Baixando UID ${UID_ALVO} via IMAP...`);
  const fatura = await baixarFatura();
  console.log(`  OK: ${fatura.filename} (${Math.round(fatura.bytes / 1024)}KB)`);

  // Salvar PDF temporariamente
  const tmpDir = path.join(__dirname, '..', 'tmp-diagnostico');
  fs.mkdirSync(tmpDir, { recursive: true });
  const pdfPath = path.join(tmpDir, 'fatura-luciano-ago25.pdf');
  fs.writeFileSync(pdfPath, Buffer.from(fatura.base64, 'base64'));
  console.log(`  Salvo: ${pdfPath}`);

  console.log(`[2/4] Chamando Claude OCR (extrairOcr)...`);
  const app = await NestFactory.createApplicationContext(AppModule, { logger: ['error'] });
  const faturasService = app.get(FaturasService);
  const dados: any = await faturasService.extrairOcr(fatura.base64, 'pdf');
  console.log(`  OCR retornou ${Object.keys(dados).length} campos`);

  console.log(`[3/4] Simulando 3 modelos...`);
  const simul = simularModelos(dados);

  console.log(`[4/4] Gerando relatório...`);
  const relPath = path.join(process.cwd(), '..', 'docs', 'sessoes', '2026-04-25-teste-ocr-fatura-luciano.md');

  const mdRelatorio = `# Teste OCR com fatura real do Luciano (UID 2032)

**Fatura de referência:**
- Email UID: ${UID_ALVO}
- Filename: ${fatura.filename}
- Tamanho: ${Math.round(fatura.bytes / 1024)}KB
- Data email: 2025-08-31

## Dados extraídos pelo OCR

| Campo | Valor |
|---|---|
| Titular | ${dados.titular ?? '-'} |
| Documento | ${dados.documento ?? '-'} (${dados.tipoDocumento ?? '-'}) |
| Endereço | ${dados.enderecoInstalacao ?? '-'} |
| Cidade/Estado | ${dados.cidade ?? '-'} / ${dados.estado ?? '-'} |
| UC (canônica) | ${dados.numeroUC ?? '-'} |
| Distribuidora | ${dados.distribuidora ?? '-'} |
| Classificação | ${dados.classificacao ?? '-'} |
| Modalidade | ${dados.modalidadeTarifaria ?? '-'} |
| Mês referência | ${dados.mesReferencia ?? '-'} |
| Vencimento | ${dados.vencimento ?? '-'} |
| Valor total EDP | R$ ${dados.valorTotal ?? '-'} |
| Consumo atual | ${dados.consumoAtualKwh ?? '-'} kWh |
| Leitura ant/atual | ${dados.leituraAnterior ?? '-'} / ${dados.leituraAtual ?? '-'} |
| Tarifa TUSD | R$ ${dados.tarifaTUSD ?? '-'} |
| Tarifa TE | R$ ${dados.tarifaTE ?? '-'} |
| Bandeira | ${dados.bandeiraTarifaria ?? '-'} |
| ICMS (%) | ${dados.icmsPercentual ?? '-'} |
| ICMS (R$) | ${dados.icmsValor ?? '-'} |
| Possui compensação | ${dados.possuiCompensacao ?? '-'} |
| Créditos recebidos | ${dados.creditosRecebidosKwh ?? 0} kWh |
| Saldo total | ${dados.saldoTotalKwh ?? 0} kWh |
| Valor sem desconto | R$ ${dados.valorSemDesconto ?? '-'} |
| Valor compensado | R$ ${dados.valorCompensadoReais ?? '-'} |

## Simulação dos 3 modelos de cobrança

| Modelo | Parâmetro | Valor cooperado | Economia vs EDP sem GD |
|---|---|---|---|
| FIXO_MENSAL | ${simul.fixo.parametro} | R$ ${simul.fixo.valor.toFixed(2)} | R$ ${simul.fixo.economia.toFixed(2)} |
| CREDITOS_COMPENSADOS | ${simul.compensados.parametro} | R$ ${simul.compensados.valor.toFixed(2)} | R$ ${simul.compensados.economia.toFixed(2)} |
| CREDITOS_DINAMICO | ${simul.dinamico.parametro} | R$ ${simul.dinamico.valor.toFixed(2)} | R$ ${simul.dinamico.economia.toFixed(2)} |

**Referência de cálculos:**
- kWh consumido: ${simul.kwhConsumido}
- kWh compensado (créditos): ${simul.creditosKwh}
- Valor sem desconto (EDP sem GD): R$ ${simul.valorSemDesconto}
- Valor faturado real pelo EDP: R$ ${simul.valorFaturado}
- Tarifa cheia (TUSD+TE): R$ ${simul.tarifaCheia}

## Conclusões

- **OCR funcional:** ${Object.keys(dados).length >= 15 ? 'SIM' : 'PARCIAL'} — ${Object.keys(dados).length} campos extraídos
- **Estrutura de dados compatível:** ${dados.numeroUC && dados.valorTotal ? 'SIM' : 'PARCIAL'}
- **Tem créditos compensados:** ${simul.creditosKwh > 0 ? `SIM (${simul.creditosKwh} kWh)` : 'NÃO — cenário B1 (cooperado sem homologação ativa)'}
- **Pronto pra Sprint 14 (engines COMPENSADOS/DINAMICO):** ${simul.creditosKwh > 0 && simul.tarifaCheia > 0 ? 'SIM' : 'precisa fatura COM créditos pra teste completo'}

## JSON bruto retornado pelo OCR

\`\`\`json
${JSON.stringify(dados, null, 2)}
\`\`\`
`;

  fs.writeFileSync(relPath, mdRelatorio);
  console.log(`  Relatório: ${relPath}`);

  // Cleanup
  fs.unlinkSync(pdfPath);
  console.log(`[CLEANUP] PDF temp removido`);

  await app.close();
}

main().catch(e => { console.error(e); process.exit(1); });
