import puppeteer from 'puppeteer';
import fs from 'fs';
import path from 'path';
import os from 'os';

// === Dados do Márcio Maciel (mesmos de gerar-pdf-marcio.mjs) ===
const historico = [
  { mes: 'Jan/26', kwh: 2219 },
  { mes: 'Dez/25', kwh: 1807 },
  { mes: 'Nov/25', kwh: 1736 },
  { mes: 'Out/25', kwh: 1656 },
  { mes: 'Set/25', kwh: 1503 },
  { mes: 'Ago/25', kwh: 1508 },
  { mes: 'Jul/25', kwh: 1109 },
  { mes: 'Jun/25', kwh: 1102 },
  { mes: 'Mai/25', kwh: 1399 },
  { mes: 'Abr/25', kwh: 2268 },
  { mes: 'Mar/25', kwh: 2161 },
  { mes: 'Fev/25', kwh: 2615 },
];

const consumoAtual = 1848;
const totalFaturaAtual = 1920.61;
const minimoFaturavel = 100;
const desconto = 0.15;

const somaHistorico = historico.reduce((s, m) => s + m.kwh, 0);
const mediaConsumo = somaHistorico / historico.length;
const kwhUnitario = totalFaturaAtual / consumoAtual;
const consumoConsiderado = mediaConsumo - minimoFaturavel;
const faturaMedBase = consumoConsiderado * kwhUnitario;
const faturaCoopere = faturaMedBase * (1 - desconto);
const economiaMensal = faturaMedBase - faturaCoopere;
const economiaAnual = economiaMensal * 12;
const economia5anos = economiaMensal * 60;
const kwhCoopere = kwhUnitario * (1 - desconto);

const fmtBRL = v => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

const tabelaHistorico = historico.map(m => {
  const valOriginal = m.kwh * kwhUnitario;
  const valDesc = (Math.max(0, m.kwh - minimoFaturavel)) * kwhUnitario * (1 - desconto) + (minimoFaturavel * kwhUnitario);
  const econM = valOriginal - valDesc;
  const pct = ((econM / valOriginal) * 100).toFixed(1);
  return `
    <tr>
      <td>${m.mes}</td>
      <td style="text-align:right;">${m.kwh.toLocaleString('pt-BR')}</td>
      <td style="text-align:right;">${fmtBRL(valOriginal)}</td>
      <td style="text-align:right;">${fmtBRL(valDesc)}</td>
      <td style="text-align:right;color:#15803d;font-weight:600;">${fmtBRL(econM)}</td>
      <td style="text-align:right;">${pct}%</td>
    </tr>`;
}).join('');

const html = `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <title>Proposta CoopereBR — Márcio Maciel</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: 'Segoe UI', Arial, sans-serif; background: #f3f4f6; padding: 24px; color: #1f2937; }
    .container { max-width: 820px; margin: 0 auto; background: #fff; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 24px rgba(0,0,0,0.10); }
    .header { background: linear-gradient(135deg, #166534 0%, #15803d 100%); color: white; padding: 36px 40px; }
    .header h1 { font-size: 26px; font-weight: 700; margin-bottom: 4px; }
    .header p { font-size: 14px; opacity: 0.85; }
    .badge { display: inline-block; background: rgba(255,255,255,0.2); border-radius: 20px; padding: 4px 14px; font-size: 12px; margin-top: 10px; }
    .section { padding: 28px 40px; border-bottom: 1px solid #f0f0f0; }
    .section-title { font-size: 15px; font-weight: 700; color: #166534; text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 18px; padding-bottom: 8px; border-bottom: 2px solid #dcfce7; }
    .info-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 10px 24px; }
    .info-item label { font-size: 11px; color: #6b7280; text-transform: uppercase; letter-spacing: 0.05em; display: block; margin-bottom: 2px; }
    .info-item span { font-size: 15px; font-weight: 600; color: #111827; }
    .highlight-box { background: linear-gradient(135deg, #f0fdf4, #dcfce7); border: 1px solid #86efac; border-radius: 10px; padding: 24px; }
    .economy-cards { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 14px; margin-top: 16px; }
    .economy-card { background: #166534; color: white; border-radius: 8px; padding: 18px 14px; text-align: center; }
    .economy-card .value { font-size: 22px; font-weight: 800; margin-bottom: 4px; }
    .economy-card .label { font-size: 11px; opacity: 0.85; }
    .compare-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 14px; margin-top: 4px; }
    .compare-card { border-radius: 8px; padding: 16px 18px; }
    .compare-card.before { background: #fef2f2; border: 1px solid #fca5a5; }
    .compare-card.after { background: #f0fdf4; border: 1px solid #86efac; }
    .compare-card .title { font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 8px; }
    .compare-card.before .title { color: #dc2626; }
    .compare-card.after .title { color: #166534; }
    .compare-card .price { font-size: 26px; font-weight: 800; }
    .compare-card.before .price { color: #dc2626; }
    .compare-card.after .price { color: #166534; }
    .compare-card .sub { font-size: 12px; color: #6b7280; margin-top: 4px; }
    table { width: 100%; border-collapse: collapse; font-size: 13px; }
    th { background: #f9fafb; padding: 9px 10px; text-align: left; font-size: 11px; text-transform: uppercase; color: #6b7280; border-bottom: 2px solid #e5e7eb; }
    td { padding: 8px 10px; border-bottom: 1px solid #f3f4f6; }
    tr:last-child td { border-bottom: none; }
    tr:hover td { background: #f9fafb; }
    .footer { background: #f9fafb; padding: 20px 40px; text-align: center; font-size: 12px; color: #6b7280; }
    .footer .empresa { font-size: 14px; font-weight: 700; color: #166534; margin-bottom: 4px; }
    @media print { body { padding: 0; background: white; } .container { box-shadow: none; } }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>Proposta de Adesao</h1>
      <p>Cooperativa de Energia Solar — CoopereBR</p>
      <div class="badge">Aprovada para envio - FEV/2026</div>
    </div>

    <div class="section">
      <div class="section-title">Dados do Titular</div>
      <div class="info-grid">
        <div class="info-item"><label>Nome</label><span>Marcio Maciel</span></div>
        <div class="info-item"><label>UC</label><span>0.001.556.475.054-47</span></div>
        <div class="info-item"><label>Distribuidora</label><span>EDP Espirito Santo</span></div>
        <div class="info-item"><label>Tipo de Fornecimento</label><span>Trifasico</span></div>
        <div class="info-item"><label>Referencia da Fatura</label><span>Fevereiro/2026</span></div>
        <div class="info-item"><label>Bandeira Tarifaria</label><span>Verde</span></div>
      </div>
    </div>

    <div class="section">
      <div class="section-title">Analise de Consumo</div>
      <div class="info-grid">
        <div class="info-item"><label>Consumo medio (12 meses)</label><span>${mediaConsumo.toFixed(0)} kWh/mes</span></div>
        <div class="info-item"><label>Minimo faturavel (trifasico)</label><span>${minimoFaturavel} kWh</span></div>
        <div class="info-item"><label>Consumo considerado</label><span>${consumoConsiderado.toFixed(0)} kWh/mes</span></div>
        <div class="info-item"><label>kWh EDP (unitario)</label><span>R$ ${kwhUnitario.toFixed(4)}/kWh</span></div>
        <div class="info-item"><label>kWh CoopereBR (15% desc.)</label><span>R$ ${kwhCoopere.toFixed(4)}/kWh</span></div>
        <div class="info-item"><label>Desconto</label><span>${(desconto * 100).toFixed(0)}%</span></div>
      </div>
    </div>

    <div class="section">
      <div class="section-title">Comparativo Mensal</div>
      <div class="compare-grid">
        <div class="compare-card before">
          <div class="title">Hoje — EDP</div>
          <div class="price">${fmtBRL(faturaMedBase)}</div>
          <div class="sub">Media mensal considerada</div>
        </div>
        <div class="compare-card after">
          <div class="title">Com CoopereBR</div>
          <div class="price">${fmtBRL(faturaCoopere)}</div>
          <div class="sub">15% de desconto na energia</div>
        </div>
      </div>
    </div>

    <div class="section">
      <div class="highlight-box">
        <div class="section-title" style="border:none;padding:0;margin-bottom:16px;text-align:center;">Sua Economia Projetada</div>
        <div class="economy-cards">
          <div class="economy-card">
            <div class="value">${fmtBRL(economiaMensal)}</div>
            <div class="label">Economia Mensal</div>
          </div>
          <div class="economy-card">
            <div class="value">${fmtBRL(economiaAnual)}</div>
            <div class="label">Economia Anual</div>
          </div>
          <div class="economy-card" style="background:#0f4c25;">
            <div class="value">${fmtBRL(economia5anos)}</div>
            <div class="label">Economia em 5 anos</div>
          </div>
        </div>
      </div>
    </div>

    <div class="section">
      <div class="section-title">Historico de Consumo — Mes a Mes</div>
      <table>
        <thead>
          <tr>
            <th>Mes</th>
            <th style="text-align:right;">Consumo (kWh)</th>
            <th style="text-align:right;">Valor Original</th>
            <th style="text-align:right;">Com Desconto</th>
            <th style="text-align:right;">Economia</th>
            <th style="text-align:right;">Desconto %</th>
          </tr>
        </thead>
        <tbody>${tabelaHistorico}</tbody>
      </table>
    </div>

    <div class="footer">
      <p class="empresa">CoopereBR — Cooperativa de Energia Solar</p>
      <p>Proposta valida por 30 dias. Valores sujeitos a reajuste tarifario da concessionaria.</p>
    </div>
  </div>
</body>
</html>`;

// === Gerar PDF com Puppeteer ===
async function gerarPdf() {
  console.log('Gerando PDF da proposta do Marcio Maciel...');

  const desktopPath = path.join(os.homedir(), 'Desktop');
  let outputPath;
  if (fs.existsSync(desktopPath)) {
    outputPath = path.join(desktopPath, 'proposta-marcio-maciel.pdf');
  } else {
    outputPath = path.resolve('./proposta-marcio-maciel.pdf');
  }

  const browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });

  try {
    const page = await browser.newPage();
    await page.setContent(html, { waitUntil: 'networkidle0' });
    await page.pdf({
      path: outputPath,
      format: 'A4',
      printBackground: true,
      margin: { top: '10mm', bottom: '10mm', left: '10mm', right: '10mm' },
    });

    console.log(`\n=== PDF GERADO COM SUCESSO ===`);
    console.log(`Arquivo: ${outputPath}`);
    console.log(`\n--- Resumo ---`);
    console.log(`Cooperado: Marcio Maciel`);
    console.log(`UC: 0.001.556.475.054-47`);
    console.log(`Consumo medio: ${mediaConsumo.toFixed(0)} kWh/mes`);
    console.log(`Fatura EDP (media): ${fmtBRL(faturaMedBase)}`);
    console.log(`Com CoopereBR: ${fmtBRL(faturaCoopere)}`);
    console.log(`Economia mensal: ${fmtBRL(economiaMensal)}`);
    console.log(`Economia anual: ${fmtBRL(economiaAnual)}`);
    console.log(`\n--- Para enviar por WhatsApp ---`);
    console.log(`1. Abra o WhatsApp Web ou app`);
    console.log(`2. Envie o arquivo: ${outputPath}`);
    console.log(`3. Mensagem sugerida: "Ola Marcio! Segue sua proposta de adesao a CoopereBR com 15% de desconto na energia. Economia estimada: ${fmtBRL(economiaMensal)}/mes. Qualquer duvida estamos a disposicao!"`);
  } finally {
    await browser.close();
  }
}

gerarPdf().catch(err => {
  console.error('Erro ao gerar PDF:', err);
  process.exit(1);
});
