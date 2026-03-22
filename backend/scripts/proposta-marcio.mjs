// Dados extraídos da foto da fatura do Márcio Maciel - FEV/2026
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

const consumoAtual = 1848; // kWh fev/26
const totalFaturaAtual = 1920.61; // R$
const tipoFornecimento = 'TRIFASICO';
const minimoFaturavel = 100; // kWh trifásico
const desconto = 0.15;

// Cálculos
const somaHistorico = historico.reduce((s, m) => s + m.kwh, 0);
const mediaConsumo = somaHistorico / historico.length;
const kwhUnitario = totalFaturaAtual / consumoAtual;
const consumoConsiderado = mediaConsumo - minimoFaturavel;
const faturaMedBase = consumoConsiderado * kwhUnitario;
const faturaCoopere = faturaMedBase * (1 - desconto);
const economiaM = faturaMedBase - faturaCoopere;
const economia12 = economiaM * 12;
const economia5 = economiaM * 60;
const kwhCoopere = kwhUnitario * (1 - desconto);

console.log('=== PROPOSTA COOPERE-BR — MÁRCIO MACIEL ===');
console.log(`UC: 0.001.556.475.054-47 | Ref: FEV/2026 | ${tipoFornecimento}`);
console.log('');
console.log(`Consumo médio (12 meses):    ${mediaConsumo.toFixed(0)} kWh/mês`);
console.log(`Mínimo faturável trifásico:  ${minimoFaturavel} kWh`);
console.log(`Consumo considerado:         ${consumoConsiderado.toFixed(0)} kWh/mês`);
console.log(`kWh EDP (unitário):          R$ ${kwhUnitario.toFixed(4)}`);
console.log(`kWh CoopereBR (c/ 15% desc): R$ ${kwhCoopere.toFixed(4)}`);
console.log('');
console.log(`Fatura base considerada:     R$ ${faturaMedBase.toFixed(2)}/mês`);
console.log(`Com CoopereBR (15% desc.):   R$ ${faturaCoopere.toFixed(2)}/mês`);
console.log(`Economia mensal:             R$ ${economiaM.toFixed(2)}`);
console.log(`Economia anual:              R$ ${economia12.toFixed(2)}`);
console.log(`Economia em 5 anos:          R$ ${economia5.toFixed(2)}`);
console.log('');
console.log('--- HISTÓRICO MÊS A MÊS ---');
historico.forEach(m => {
  const valOriginal = m.kwh * kwhUnitario;
  const valDesc = (Math.max(0, m.kwh - minimoFaturavel)) * kwhUnitario * (1 - desconto) + (minimoFaturavel * kwhUnitario);
  const econM = valOriginal - valDesc;
  console.log(`${m.mes}: ${m.kwh} kWh | R$ ${valOriginal.toFixed(2)} → R$ ${valDesc.toFixed(2)} | Economia R$ ${econM.toFixed(2)}`);
});
