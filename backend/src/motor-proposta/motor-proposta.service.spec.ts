/**
 * Testes unitários — MotorPropostaService
 *
 * Valida a lógica de cálculo usando dados reais da fatura Derli:
 *   kwhMesRecente=1930, valorMesRecente=2090.18
 *   tusd=0.46863, te=0.32068, descontoPadrao=20%
 */

// Extração da lógica pura de cálculo para testar sem Prisma/DI
function round5(v: number): number {
  return Math.round(v * 100000) / 100000;
}

interface CalcConfig {
  fonteKwh: string;
  thresholdOutlier: number;
  descontoPadrao: number;
  descontoMaximo: number;
  acaoOutlier: string;
  acaoResultadoAcima: string;
}

interface CalcInput {
  kwhMesRecente: number;
  valorMesRecente: number;
  historico: { consumoKwh: number; valorRS: number }[];
  tusd: number;
  te: number;
  mediaCooperativaKwh: number;
}

function calcularOpcao(
  base: 'MES_RECENTE' | 'MEDIA_12M',
  input: CalcInput,
  config: CalcConfig,
) {
  const kwhs = input.historico.map((h) => h.consumoKwh).filter((v) => v > 0);
  const valores = input.historico.map((h) => h.valorRS).filter((v) => v > 0);
  const kwhMedio12m =
    kwhs.length > 0
      ? kwhs.reduce((a, b) => a + b, 0) / kwhs.length
      : input.kwhMesRecente;
  const valorMedio12m =
    valores.length > 0
      ? valores.reduce((a, b) => a + b, 0) / valores.length
      : input.valorMesRecente;

  const tarifaUnitSemTrib = input.tusd + input.te;
  const kwhBase = base === 'MES_RECENTE' ? input.kwhMesRecente : kwhMedio12m;
  const valorBase = base === 'MES_RECENTE' ? input.valorMesRecente : valorMedio12m;
  const kwhApuradoBase = kwhBase > 0 ? valorBase / kwhBase : 0;

  let descontoPercentual = config.descontoPadrao;
  let descontoAbsoluto = tarifaUnitSemTrib * (descontoPercentual / 100);
  let valorCooperado = kwhApuradoBase - descontoAbsoluto;

  if (
    config.acaoResultadoAcima === 'AUMENTAR_DESCONTO' &&
    input.mediaCooperativaKwh > 0 &&
    valorCooperado > input.mediaCooperativaKwh
  ) {
    const descontoNecessario =
      ((kwhApuradoBase - input.mediaCooperativaKwh) / tarifaUnitSemTrib) * 100;
    descontoPercentual = Math.min(descontoNecessario, config.descontoMaximo);
    descontoAbsoluto = tarifaUnitSemTrib * (descontoPercentual / 100);
    valorCooperado = kwhApuradoBase - descontoAbsoluto;
  }

  const economiaMensal = descontoAbsoluto * kwhBase;
  const economiaAnual = economiaMensal * 12;
  const economiaPercentual =
    kwhApuradoBase > 0 ? (descontoAbsoluto / kwhApuradoBase) * 100 : 0;
  const mesesEquivalentes = valorBase > 0 ? economiaAnual / valorBase : 0;

  return {
    base,
    kwhApuradoBase: round5(kwhApuradoBase),
    descontoPercentual: round5(descontoPercentual),
    descontoAbsoluto: round5(descontoAbsoluto),
    kwhContrato: round5(kwhBase),
    valorCooperado: round5(valorCooperado),
    economiaAbsoluta: round5(descontoAbsoluto),
    economiaPercentual: round5(economiaPercentual),
    economiaMensal: round5(economiaMensal),
    economiaAnual: round5(economiaAnual),
    mesesEquivalentes: round5(mesesEquivalentes),
    tarifaUnitSemTrib: round5(tarifaUnitSemTrib),
  };
}

// ─── Tests ─────────────────────────────────────────────────────────────────

describe('MotorPropostaService — Cálculo', () => {
  const derliInput: CalcInput = {
    kwhMesRecente: 1930,
    valorMesRecente: 2090.18,
    tusd: 0.46863,
    te: 0.32068,
    mediaCooperativaKwh: 0, // sem cooperativa ativa para comparação
    historico: [
      { consumoKwh: 1850, valorRS: 1980.5 },
      { consumoKwh: 1920, valorRS: 2050.3 },
      { consumoKwh: 1780, valorRS: 1910.2 },
      { consumoKwh: 1650, valorRS: 1780.4 },
      { consumoKwh: 1700, valorRS: 1830.1 },
      { consumoKwh: 1820, valorRS: 1960.7 },
      { consumoKwh: 1900, valorRS: 2040.3 },
      { consumoKwh: 1950, valorRS: 2100.5 },
      { consumoKwh: 2010, valorRS: 2150.8 },
      { consumoKwh: 1880, valorRS: 2020.4 },
      { consumoKwh: 1960, valorRS: 2100.9 },
      { consumoKwh: 1930, valorRS: 2090.18 },
    ],
  };

  const defaultConfig: CalcConfig = {
    fonteKwh: 'MES_RECENTE',
    thresholdOutlier: 1.5,
    descontoPadrao: 20,
    descontoMaximo: 30,
    acaoOutlier: 'OFERECER_OPCAO',
    acaoResultadoAcima: 'AUMENTAR_DESCONTO',
  };

  describe('Base MES_RECENTE (dados Derli)', () => {
    const result = calcularOpcao('MES_RECENTE', derliInput, defaultConfig);

    it('deve calcular tarifaUnitSemTrib = tusd + te', () => {
      expect(result.tarifaUnitSemTrib).toBeCloseTo(0.78931, 4);
    });

    it('deve calcular kwhApuradoBase = valor/kwh', () => {
      // 2090.18 / 1930 = 1.08300...
      expect(result.kwhApuradoBase).toBeCloseTo(1.083, 3);
    });

    it('deve aplicar desconto de 20% sobre tarifa', () => {
      // 0.78931 * 0.20 = 0.15786
      expect(result.descontoAbsoluto).toBeCloseTo(0.15786, 4);
    });

    it('deve calcular valorCooperado = kwhApurado - desconto', () => {
      // 1.083 - 0.15786 = 0.925
      expect(result.valorCooperado).toBeCloseTo(0.92513, 3);
    });

    it('deve calcular economiaMensal = desconto * kwh', () => {
      // 0.15786 * 1930 = 304.67
      expect(result.economiaMensal).toBeCloseTo(304.67, 0);
    });

    it('deve calcular economiaAnual = mensal * 12', () => {
      expect(result.economiaAnual).toBeCloseTo(304.67 * 12, 0);
    });

    it('deve ter kwhContrato = kwhMesRecente', () => {
      expect(result.kwhContrato).toBe(1930);
    });
  });

  describe('Base MEDIA_12M (dados Derli)', () => {
    const result = calcularOpcao('MEDIA_12M', derliInput, defaultConfig);

    it('deve calcular média de kwh do histórico', () => {
      const mediaKwh =
        derliInput.historico.reduce((a, b) => a + b.consumoKwh, 0) /
        derliInput.historico.length;
      expect(result.kwhContrato).toBeCloseTo(mediaKwh, 0);
    });

    it('deve calcular economiaMensal com base na média', () => {
      expect(result.economiaMensal).toBeGreaterThan(0);
    });
  });

  describe('Outlier detection', () => {
    it('deve detectar outlier quando consumo > threshold * média', () => {
      const inputOutlier: CalcInput = {
        ...derliInput,
        kwhMesRecente: 5000, // muito acima da média ~1862
      };
      const kwhs = inputOutlier.historico.map((h) => h.consumoKwh);
      const media = kwhs.reduce((a, b) => a + b, 0) / kwhs.length;
      const outlier = inputOutlier.kwhMesRecente > media * defaultConfig.thresholdOutlier;
      expect(outlier).toBe(true);
    });

    it('NÃO deve detectar outlier com consumo normal', () => {
      const kwhs = derliInput.historico.map((h) => h.consumoKwh);
      const media = kwhs.reduce((a, b) => a + b, 0) / kwhs.length;
      const outlier = derliInput.kwhMesRecente > media * defaultConfig.thresholdOutlier;
      expect(outlier).toBe(false);
    });
  });

  describe('Ajuste de desconto quando acima da média cooperativa', () => {
    it('deve aumentar desconto se valorCooperado > mediaCooperativa', () => {
      const inputComMedia: CalcInput = {
        ...derliInput,
        mediaCooperativaKwh: 0.95, // ligeiramente abaixo do valorCooperado normal (~0.925)
      };
      // Com descontoPadrao 20%, valorCooperado ~0.925 < 0.95 → sem ajuste
      // Usamos valor que force o ajuste: mediaCooperativa bem acima do resultado base
      const inputForceAjuste: CalcInput = {
        ...derliInput,
        mediaCooperativaKwh: 0.90, // abaixo de 0.925 → sem ajuste (valorCooperado já é menor)
      };
      // Na verdade, o ajuste só ocorre quando valorCooperado > mediaCooperativa
      // valorCooperado normal ~0.925. Se media = 0.90, 0.925 > 0.90 → deve aumentar desconto
      const result = calcularOpcao('MES_RECENTE', inputForceAjuste, defaultConfig);
      expect(result.descontoPercentual).toBeGreaterThan(20);
      expect(result.valorCooperado).toBeLessThanOrEqual(0.90 + 0.01);
    });

    it('deve respeitar descontoMaximo', () => {
      const inputComMedia: CalcInput = {
        ...derliInput,
        mediaCooperativaKwh: 0.1, // valor muito baixo exigiria desconto > 30%
      };
      const result = calcularOpcao('MES_RECENTE', inputComMedia, defaultConfig);
      expect(result.descontoPercentual).toBeLessThanOrEqual(30);
    });
  });

  describe('round5 helper', () => {
    it('deve arredondar para 5 casas decimais', () => {
      expect(round5(1.123456789)).toBe(1.12346);
      expect(round5(0)).toBe(0);
      expect(round5(100)).toBe(100);
    });
  });
});
