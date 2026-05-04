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
import { simularPlano, SimularPlanoInput, ModeloCobranca, BaseCalculo, TipoDesconto } from '../lib/simular-plano';

const CENARIOS: Array<{
  numero: number;
  descricao: string;
  modeloCobranca: ModeloCobranca;
  baseCalculo: BaseCalculo;
  tipoDesconto?: TipoDesconto;
  descontoBase?: number;
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
    descricao: 'FIXO_MENSAL + SEM_TRIBUTO + 15% (ABATER_DA_CHEIA — padrão Fase B.5)',
    modeloCobranca: 'FIXO_MENSAL',
    baseCalculo: 'SEM_TRIBUTO',
    tipoDesconto: 'ABATER_DA_CHEIA',
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
    descricao: 'CREDITOS_COMPENSADOS + SEM_TRIBUTO + 15% (ABATER_DA_CHEIA — padrão Fase B.5)',
    modeloCobranca: 'CREDITOS_COMPENSADOS',
    baseCalculo: 'SEM_TRIBUTO',
    tipoDesconto: 'ABATER_DA_CHEIA',
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
    descricao: 'CREDITOS_DINAMICO + SEM_TRIBUTO + 15% (ABATER_DA_CHEIA — padrão Fase B.5)',
    modeloCobranca: 'CREDITOS_DINAMICO',
    baseCalculo: 'SEM_TRIBUTO',
    tipoDesconto: 'ABATER_DA_CHEIA',
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
  // Fase C.1.1 — 4 cenários cobrindo combinações baseCalculo × tipoDesconto.
  // Paridade matemática com motor-proposta.service.ts:308-360 (fonte canônica
  // real de uso). Inputs idênticos ao cenário do bug reportado por Luciano:
  // descontoBase=20, valorCheio=1.02, semImpostos=0.78, kwh=500.
  {
    numero: 7,
    descricao: 'KWH_CHEIO + APLICAR_SOBRE_BASE + 20% (helper Tipo I)',
    modeloCobranca: 'FIXO_MENSAL',
    baseCalculo: 'KWH_CHEIO',
    tipoDesconto: 'APLICAR_SOBRE_BASE',
    descontoBase: 20,
    esperado: {
      tarifaContratada: 0.816,
      valorBruto: 510.0,
      valorLiquido: 408.0,
      valorEconomiaMes: 102.0,
      valorEconomiaAno: 1224.0,
      valorEconomia5anos: 6120.0,
      valorEconomia15anos: 18360.0,
    },
  },
  {
    numero: 8,
    descricao: 'KWH_CHEIO + ABATER_DA_CHEIA + 20% (mesmo valor — redundância V4)',
    modeloCobranca: 'FIXO_MENSAL',
    baseCalculo: 'KWH_CHEIO',
    tipoDesconto: 'ABATER_DA_CHEIA',
    descontoBase: 20,
    esperado: {
      tarifaContratada: 0.816,
      valorBruto: 510.0,
      valorLiquido: 408.0,
      valorEconomiaMes: 102.0,
      valorEconomiaAno: 1224.0,
      valorEconomia5anos: 6120.0,
      valorEconomia15anos: 18360.0,
    },
  },
  {
    numero: 9,
    descricao: 'SEM_TRIBUTO + APLICAR_SOBRE_BASE + 20% (rara — abaixo de TUSD+TE)',
    modeloCobranca: 'FIXO_MENSAL',
    baseCalculo: 'SEM_TRIBUTO',
    tipoDesconto: 'APLICAR_SOBRE_BASE',
    descontoBase: 20,
    esperado: {
      tarifaContratada: 0.624,
      valorBruto: 510.0,
      valorLiquido: 312.0,
      valorEconomiaMes: 198.0,
      valorEconomiaAno: 2376.0,
      valorEconomia5anos: 11880.0,
      valorEconomia15anos: 35640.0,
    },
  },
  {
    numero: 10,
    descricao: 'SEM_TRIBUTO + ABATER_DA_CHEIA + 20% (padrão mercado GD)',
    modeloCobranca: 'FIXO_MENSAL',
    baseCalculo: 'SEM_TRIBUTO',
    tipoDesconto: 'ABATER_DA_CHEIA',
    descontoBase: 20,
    esperado: {
      tarifaContratada: 0.864,
      valorBruto: 510.0,
      valorLiquido: 432.0,
      valorEconomiaMes: 78.0,
      valorEconomiaAno: 936.0,
      valorEconomia5anos: 4680.0,
      valorEconomia15anos: 14040.0,
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
  const r = simularPlano({
    ...INPUT_BASE,
    modeloCobranca: c.modeloCobranca,
    baseCalculo: c.baseCalculo,
    ...(c.tipoDesconto !== undefined && { tipoDesconto: c.tipoDesconto }),
    ...(c.descontoBase !== undefined && { descontoBase: c.descontoBase }),
  });
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
  console.log(`✓ TODOS OS ${CENARIOS.length} CENÁRIOS PARIDADE OK`);
  process.exit(0);
} else {
  console.log(`✗ ${falhas}/${CENARIOS.length} cenário(s) com divergência`);
  process.exit(1);
}
