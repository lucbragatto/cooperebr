import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

// Dados do Márcio extraídos da fatura
const cooperadoId = 'cmn1xnxo70000uof4ih6qac20';
const planoId = 'plano-prata'; // 15% desconto

// Histórico da fatura (lido pelo OCR com correção manual)
const historico = [
  { mesAno: 'Fev/25', consumoKwh: 2615, valorRS: 0 },
  { mesAno: 'Mar/25', consumoKwh: 2161, valorRS: 0 },
  { mesAno: 'Abr/25', consumoKwh: 2268, valorRS: 0 },
  { mesAno: 'Mai/25', consumoKwh: 1399, valorRS: 0 },
  { mesAno: 'Jun/25', consumoKwh: 1102, valorRS: 0 },
  { mesAno: 'Jul/25', consumoKwh: 1109, valorRS: 0 },
  { mesAno: 'Ago/25', consumoKwh: 1508, valorRS: 0 },
  { mesAno: 'Set/25', consumoKwh: 1503, valorRS: 0 },
  { mesAno: 'Out/25', consumoKwh: 1656, valorRS: 0 },
  { mesAno: 'Nov/25', consumoKwh: 1736, valorRS: 0 },
  { mesAno: 'Dez/25', consumoKwh: 1807, valorRS: 0 },
  { mesAno: 'Jan/26', consumoKwh: 2219, valorRS: 0 },
];

const consumoAtual = 1848;
const totalFatura = 1920.61;
const tipoFornecimento = 'TRIFASICO';
const minimoFaturavel = 100;
const descontoBase = 0.15;

// Cálculos
const mediaConsumo = historico.reduce((s, m) => s + m.consumoKwh, 0) / historico.length;
const kwhUnitario = totalFatura / consumoAtual;
const consumoConsiderado = mediaConsumo - minimoFaturavel;
const valorMedioBase = consumoConsiderado * kwhUnitario;
const valorComDesconto = valorMedioBase * (1 - descontoBase);
const economiaM = valorMedioBase - valorComDesconto;
const economia12 = economiaM * 12;
const economia5 = economiaM * 60;
const mesesEconomia = Math.round(economia5 / totalFatura * 10) / 10;

// Buscar tarifa vigente
const tarifa = await prisma.tarifaConcessionaria.findFirst({ orderBy: { dataVigencia: 'desc' } });

// Criar proposta no banco
const proposta = await prisma.propostaCooperado.create({
  data: {
    cooperadoId,
    planoId,
    status: 'PENDENTE',
    mesReferencia: 'Fev/2026',
    consumoMedioKwh: Math.round(mediaConsumo),
    kwhApuradoBase: Number(kwhUnitario.toFixed(5)),
    kwhContrato: Math.round(consumoConsiderado),
    descontoAplicado: 15,
    economiaMensal: Number(economiaM.toFixed(2)),
    economiaAnual: Number(economia12.toFixed(2)),
    totalOriginal: Number(valorMedioBase.toFixed(2)),
    totalComDesconto: Number(valorComDesconto.toFixed(2)),
    kwhMesRecente: Number(kwhUnitario.toFixed(5)),
    historicoConsumo: historico,
    opcoes: [{
      id: 'opcao-1',
      planoId,
      planoNome: 'Plano Prata 15%',
      desconto: 15,
      kwhContrato: Math.round(consumoConsiderado),
      valorMensal: Number(valorComDesconto.toFixed(2)),
      economiaMensal: Number(economiaM.toFixed(2)),
      economia12: Number(economia12.toFixed(2)),
      economia5: Number(economia5.toFixed(2)),
    }],
  }
});

console.log('✅ Proposta criada:', proposta.id);
console.log('Cooperado:', cooperadoId);
console.log(`Consumo médio: ${Math.round(mediaConsumo)} kWh | Considerado: ${Math.round(consumoConsiderado)} kWh`);
console.log(`kWh unitário: R$ ${kwhUnitario.toFixed(4)}`);
console.log(`Fatura base: R$ ${valorMedioBase.toFixed(2)} → Com 15%: R$ ${valorComDesconto.toFixed(2)}`);
console.log(`Economia mensal: R$ ${economiaM.toFixed(2)} | 5 anos: R$ ${economia5.toFixed(2)}`);
console.log(`Equivale a ${mesesEconomia} meses de energia grátis em 5 anos`);

await prisma.$disconnect();
