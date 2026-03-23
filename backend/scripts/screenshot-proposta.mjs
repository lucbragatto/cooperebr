import puppeteer from 'puppeteer';
import fs from 'fs';
import path from 'path';

// Gera o HTML inline
const historico = [
  { mes: 'Fev/26', kwh: 3422 },
  { mes: 'Dez/25', kwh: 2543 },
  { mes: 'Mar/26', kwh: 3479 },
];
const totalFaturaAtual = 3534.67;
const consumoAtual = 3479;
const minimoFaturavel = 100;
const desconto = 0.15;
const mediaConsumo = historico.reduce((s,m)=>s+m.kwh,0)/historico.length;
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
  return `<tr><td>${m.mes}</td><td style="text-align:right;">${m.kwh.toLocaleString('pt-BR')}</td><td style="text-align:right;">${fmtBRL(valOriginal)}</td><td style="text-align:right;">${fmtBRL(valDesc)}</td><td style="text-align:right;color:#15803d;font-weight:600;">${fmtBRL(econM)}</td><td style="text-align:right;">${((econM/valOriginal)*100).toFixed(1)}%</td></tr>`;
}).join('');

const html = `<!DOCTYPE html><html lang="pt-BR"><head><meta charset="UTF-8"><style>*{margin:0;padding:0;box-sizing:border-box}body{font-family:'Segoe UI',Arial,sans-serif;background:#fff;padding:20px;color:#1f2937}.header{background:linear-gradient(135deg,#166534,#15803d);color:white;padding:28px 32px;border-radius:10px 10px 0 0}.header h1{font-size:22px;font-weight:700}.header p{font-size:13px;opacity:.85}.badge{display:inline-block;background:rgba(255,255,255,.2);border-radius:20px;padding:3px 12px;font-size:11px;margin-top:8px}.section{padding:22px 32px;border-bottom:1px solid #f0f0f0}.st{font-size:13px;font-weight:700;color:#166534;text-transform:uppercase;letter-spacing:.05em;margin-bottom:14px;padding-bottom:6px;border-bottom:2px solid #dcfce7}.ig{display:grid;grid-template-columns:1fr 1fr;gap:8px 20px}.ii label{font-size:10px;color:#6b7280;text-transform:uppercase;letter-spacing:.05em;display:block;margin-bottom:1px}.ii span{font-size:14px;font-weight:600}.hb{background:linear-gradient(135deg,#f0fdf4,#dcfce7);border:1px solid #86efac;border-radius:8px;padding:20px}.ec{display:grid;grid-template-columns:1fr 1fr 1fr;gap:12px;margin-top:12px}.card{background:#166534;color:white;border-radius:6px;padding:14px;text-align:center}.card .v{font-size:20px;font-weight:800;margin-bottom:3px}.card .l{font-size:10px;opacity:.85}.cg{display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-top:4px}.cb{border-radius:8px;padding:14px}.cb.b{background:#fef2f2;border:1px solid #fca5a5}.cb.a{background:#f0fdf4;border:1px solid #86efac}.cb .t{font-size:10px;font-weight:700;text-transform:uppercase;margin-bottom:6px}.cb.b .t{color:#dc2626}.cb.a .t{color:#166534}.cb .p{font-size:24px;font-weight:800}.cb.b .p{color:#dc2626}.cb.a .p{color:#166534}.cb .s{font-size:11px;color:#6b7280;margin-top:3px}table{width:100%;border-collapse:collapse;font-size:12px}th{background:#f9fafb;padding:7px 8px;text-align:left;font-size:10px;text-transform:uppercase;color:#6b7280;border-bottom:2px solid #e5e7eb}td{padding:7px 8px;border-bottom:1px solid #f3f4f6}.footer{background:#f9fafb;padding:16px 32px;text-align:center;font-size:11px;color:#6b7280}.fe{font-size:13px;font-weight:700;color:#166534;margin-bottom:3px}</style></head><body>
<div class="header"><h1>Proposta de Adesão</h1><p>Cooperativa de Energia Solar — CoopereBR</p><div class="badge">✓ MAR/2026</div></div>
<div class="section"><div class="st">Dados do Titular</div><div class="ig"><div class="ii"><label>Nome</label><span>Fernanda A. Vasconcellos</span></div><div class="ii"><label>UC</label><span>0.000.132.234.054-08</span></div><div class="ii"><label>Distribuidora</label><span>EDP Espírito Santo</span></div><div class="ii"><label>Classificação</label><span>B3 - Comercial | Trifásico</span></div></div></div>
<div class="section"><div class="st">Análise de Consumo</div><div class="ig"><div class="ii"><label>Consumo médio (meses típicos)</label><span>${mediaConsumo.toFixed(0)} kWh/mês</span></div><div class="ii"><label>Mínimo faturável (trifásico)</label><span>100 kWh</span></div><div class="ii"><label>kWh EDP</label><span>R$ ${kwhUnitario.toFixed(4)}/kWh</span></div><div class="ii"><label>kWh CoopereBR (15% desc.)</label><span>R$ ${kwhCoopere.toFixed(4)}/kWh</span></div></div></div>
<div class="section"><div class="st">Comparativo Mensal</div><div class="cg"><div class="cb b"><div class="t">⚡ Hoje — EDP</div><div class="p">${fmtBRL(faturaMedBase)}</div><div class="s">Média mensal</div></div><div class="cb a"><div class="t">🌱 Com CoopereBR</div><div class="p">${fmtBRL(faturaCoopere)}</div><div class="s">15% de desconto</div></div></div></div>
<div class="section"><div class="hb"><div class="st" style="border:none;padding:0;margin-bottom:12px;text-align:center">💰 Sua Economia Projetada</div><div class="ec"><div class="card"><div class="v">${fmtBRL(economiaMensal)}</div><div class="l">Economia Mensal</div></div><div class="card"><div class="v">${fmtBRL(economiaAnual)}</div><div class="l">Economia Anual</div></div><div class="card" style="background:#0f4c25"><div class="v">${fmtBRL(economia5anos)}</div><div class="l">Economia em 5 anos</div></div></div></div></div>
<div class="section"><div class="st">Histórico de Consumo</div><table><thead><tr><th>Mês</th><th style="text-align:right">kWh</th><th style="text-align:right">Valor EDP</th><th style="text-align:right">Com Desconto</th><th style="text-align:right">Economia</th><th style="text-align:right">%</th></tr></thead><tbody>${tabelaHistorico}</tbody></table><p style="margin-top:8px;font-size:10px;color:#9ca3af">* Out/25 (0 kWh), Nov/25 (196 kWh) e Jan/26 (857 kWh) excluídos por consumo atípico.</p></div>
<div class="footer"><p class="fe">COOPERE-BR</p><p>WhatsApp: (27) 4042-1630</p><p style="margin-top:6px;font-size:10px">Proposta válida por 30 dias. Valores sujeitos a reajuste tarifário.</p></div>
</body></html>`;

const browser = await puppeteer.launch({ headless: true, args: ['--no-sandbox', '--disable-setuid-sandbox'] });
const page = await browser.newPage();
await page.setViewport({ width: 900, height: 1200, deviceScaleFactor: 1.5 });
await page.setContent(html, { waitUntil: 'networkidle0' });

// Screenshot da parte de cima (header + dados + comparativo)
await page.screenshot({ path: 'proposta-fernanda-p1.jpg', clip: { x: 0, y: 0, width: 900, height: 1200 }, type: 'jpeg', quality: 92 });

// Screenshot da parte de baixo (economia + histórico + rodapé)
const totalHeight = await page.evaluate(() => document.body.scrollHeight);
await page.screenshot({ path: 'proposta-fernanda-p2.jpg', clip: { x: 0, y: 1100, width: 900, height: Math.min(totalHeight - 1100, 1200) }, type: 'jpeg', quality: 92 });

await browser.close();
console.log('✅ Screenshots geradas: proposta-fernanda-p1.jpg e proposta-fernanda-p2.jpg');
