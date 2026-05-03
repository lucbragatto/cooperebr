/**
 * Spec standalone do helper web/lib/simular-plano.ts (Fase C.1).
 *
 * Valida paridade matemática com o backend (helper canônico
 * backend/src/motor-proposta/lib/calcular-tarifa-contratual.ts) nos 6
 * cenários da Fase B.5. Exit code 0 = todos verde; 1 = alguma divergência.
 *
 * Como rodar:
 *   cd web ; npx ts-node -O '{"module":"commonjs","moduleResolution":"node"}' --transpile-only scripts/test-simular-plano.ts
 *
 * O override de module=commonjs é necessário porque tsconfig.json do Next.js
 * usa "module":"esnext" que conflita com ts-node em modo Node CLI.
 *
 * Sem dependência de Jest. Sem rede. Sem banco.
 */
import { simularPlano, SimularPlanoInput, ModeloCobranca, BaseCalculo } from '../lib/simular-plano';

const CENARIOS: Array<{
  numero: number;
  descricao: string;
  modeloCobranca: ModeloCobranca;
  baseCalculo: BaseCalculo;
  esperado: {
    tarifaContratada: number;
    valorBruto: number;
    valorLiquido: number;
    valorEconomiaMes: number;
    valorEconomiaAno: number;
    valorEconomia5anos: number;
    valorEconomia15anos: number;
  };
}> = [
  {
    numero: 1,
    descricao: 'FIXO_MENSAL + KWH_CHEIO + 15%',
    modeloCobranca: 'FIXO_MENSAL',
    baseCalculo: 'KWH_CHEIO',
    esperado: {
      tarifaContratada: 0.867,
      valorBruto: 510.0,
      valorLiquido: 433.5,
      valorEconomiaMes: 76.5,
      valorEconomiaAno: 918.0,
      valorEconomia5anos: 4590.0,
      valorEconomia15anos: 13770.0,
    },
  },
  {
    numero: 2,
    descricao: 'FIXO_MENSAL + SEM_TRIBUTO + 15%',
    modeloCobranca: 'FIXO_MENSAL',
    baseCalculo: 'SEM_TRIBUTO',
    esperado: {
      tarifaContratada: 0.903,
      valorBruto: 510.0,
      valorLiquido: 451.5,
      valorEconomiaMes: 58.5,
      valorEconomiaAno: 702.0,
      valorEconomia5anos: 3510.0,
      valorEconomia15anos: 10530.0,
    },
  },
  {
    numero: 3,
    descricao: 'CREDITOS_COMPENSADOS + KWH_CHEIO + 15%',
    modeloCobranca: 'CREDITOS_COMPENSADOS',
    baseCalculo: 'KWH_CHEIO',
    esperado: {
      tarifaContratada: 0.867,
      valorBruto: 510.0,
      valorLiquido: 433.5,
      valorEconomiaMes: 76.5,
      valorEconomiaAno: 918.0,
      valorEconomia5anos: 4590.0,
      valorEconomia15anos: 13770.0,
    },
  },
  {
    numero: 4,
    descricao: 'CREDITOS_COMPENSADOS + SEM_TRIBUTO + 15%',
    modeloCobranca: 'CREDITOS_COMPENSADOS',
    baseCalculo: 'SEM_TRIBUTO',
    esperado: {
      tarifaContratada: 0.903,
      valorBruto: 510.0,
      valorLiquido: 451.5,
      valorEconomiaMes: 58.5,
      valorEconomiaAno: 702.0,
      valorEconomia5anos: 3510.0,
      valorEconomia15anos: 10530.0,
    },
  },
  {
    numero: 5,
    descricao: 'CREDITOS_DINAMICO + KWH_CHEIO + 15%',
    modeloCobranca: 'CREDITOS_DINAMICO',
    baseCalculo: 'KWH_CHEIO',
    esperado: {
      tarifaContratada: 0.867,
      valorBruto: 510.0,
      valorLiquido: 433.5,
      valorEconomiaMes: 76.5,
      valorEconomiaAno: 918.0,
      valorEconomia5anos: 4590.0,
      valorEconomia15anos: 13770.0,
    },
  },
  {
    numero: 6,
    descricao: 'CREDITOS_DINAMICO + SEM_TRIBUTO + 15%',
    modeloCobranca: 'CREDITOS_DINAMICO',
    baseCalculo: 'SEM_TRIBUTO',
    esperado: {
      tarifaContratada: 0.903,
      valorBruto: 510.0,
      valorLiquido: 451.5,
      valorEconomiaMes: 58.5,
      valorEconomiaAno: 702.0,
      valorEconomia5anos: 3510.0,
      valorEconomia15anos: 10530.0,
    },
  },
];

const INPUT_BASE: Omit<SimularPlanoInput, 'modeloCobranca' | 'baseCalculo'> = {
  valorCheioKwh: 1.02,
  tarifaSemImpostos: 0.78,
  descontoBase: 15,
  kwhContratoMensal: 500,
};

let falhas = 0;

console.log('=== Spec paridade web/lib/simular-plano vs backend (Fase C.1) ===\n');

for (const c of CENARIOS) {
  const r = simularPlano({ ...INPUT_BASE, modeloCobranca: c.modeloCobranca, baseCalculo: c.baseCalculo });
  const divs: string[] = [];
  const epsilon = 0.001; // 1/10 de centavo de tolerância
  const diff = (k: keyof typeof c.esperado) => {
    const exp = c.esperado[k];
    const obt = (r as any)[k];
    if (Math.abs(obt - exp) > epsilon) {
      divs.push(`  ${k}: esperado ${exp}, obtido ${obt}`);
    }
  };
  diff('tarifaContratada');
  diff('valorBruto');
  diff('valorLiquido');
  diff('valorEconomiaMes');
  diff('valorEconomiaAno');
  diff('valorEconomia5anos');
  diff('valorEconomia15anos');
  if (divs.length === 0) {
    console.log(`✓ Cenário ${c.numero}: ${c.descricao}`);
  } else {
    console.log(`✗ Cenário ${c.numero}: ${c.descricao}`);
    divs.forEach((d) => console.log(d));
    falhas += 1;
  }
}

console.log('');
if (falhas === 0) {
  console.log('✓ TODOS OS 6 CENÁRIOS PARIDADE OK');
  process.exit(0);
} else {
  console.log(`✗ ${falhas}/6 cenário(s) com divergência`);
  process.exit(1);
}
