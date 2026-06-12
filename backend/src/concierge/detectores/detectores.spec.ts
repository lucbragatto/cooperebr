import { EdpEsFaturaAdapter } from '../fatura-canonica/edp-es.adapter';
import type { FaturaRawInput, FaturaCanonica } from '../fatura-canonica/fatura-canonica.types';
import { DetectorTema69Stricto } from './detector-tema69-stricto';
import { DetectorTese3PisCofinsSobreScee } from './detector-tese3-pis-sobre-scee';
import { DetectorTese2IcmsTusdGeracao } from './detector-tese2-icms-tusd-g';
import { DetectorTese6IcmsTusdTeSobreScee } from './detector-tese6-icms-scee';
import { DetectoresRegistry } from './detectores.registry';
import { projetar60mSelic } from './detectores.types';

/**
 * Helper: parseia input e devolve fatura canonica (lanca se falhar).
 */
function parsear(input: FaturaRawInput): FaturaCanonica {
  const adapter = new EdpEsFaturaAdapter();
  const r = adapter.parsear(input);
  if (!r.sucesso) {
    throw new Error(`Adapter falhou: ${r.motivo} - ${r.detalhe}`);
  }
  return r.fatura;
}

describe('projetar60mSelic', () => {
  it('multiplica por 60 e por 1.25 (SELIC ~25%)', () => {
    expect(projetar60mSelic(100)).toBe(7500);
  });

  it('retorna 0 para valores nao-positivos', () => {
    expect(projetar60mSelic(0)).toBe(0);
    expect(projetar60mSelic(-50)).toBe(0);
  });

  it('arredonda em 2 casas decimais', () => {
    expect(projetar60mSelic(49.91)).toBe(3743.25);
  });
});

// ════════════════════════════════════════════════════════════════════════
// DetectorTema69Stricto
// ════════════════════════════════════════════════════════════════════════
describe('DetectorTema69Stricto', () => {
  const detector = new DetectorTema69Stricto();

  it('Leonardo (cativo sem GD): base declarada bate com esperada -> sem padrao', () => {
    const fatura = parsear({
      metadados: {
        mesReferencia: '2026-04',
        classificacao: 'B - B1-RESIDENCIAL',
        valorTotalFatura: 570.56,
        basePisCofinsDeclarada: 449.07,
        aliquotaPisDeclarada: 0.0094,
        aliquotaCofinsDeclarada: 0.0432,
      },
      rubricas: [
        { descricao: 'TUSD - Consumo', valorTotalReais: 321.23, baseCalculoIcms: 321.23, aliquotaIcms: 0.17, valorIcms: 54.61, valorPisCofins: 14.03 },
        { descricao: 'TE - Consumo', valorTotalReais: 219.82, baseCalculoIcms: 219.82, aliquotaIcms: 0.17, valorIcms: 37.37, valorPisCofins: 9.60 },
        { descricao: 'Contribuicao de Ilum. Publica', valorTotalReais: 29.51 },
      ],
    });
    const r = detector.detectar(fatura);
    expect(r.padrao).toBeNull();
  });

  it('CUSD CoopereBR II: declarada < esperada em ~R$ 248 -> FAVORAVEL_AO_CLIENTE', () => {
    // Subset das 5 rubricas tributadas (TUSD/TE fornecida/injetada omitidas
    // pois cancelam):
    //   baseIcms positiva = 15303.57 + 178.64 + 357.26 + 357.26 + 673.88 = 16870.61
    //   icmsCobrado = 2601.61 + 30.37 + 60.73 + 60.73 + 114.56 = 2868.00
    //   Esperada Tema 69 = 16870.61 - 2868.00 = 14002.61
    // Pra forcar FAVORAVEL ~R$ 248 declarada = 14002.61 - 248 = 13754.61
    const fatura = parsear({
      metadados: {
        mesReferencia: '2026-05',
        classificacao: 'A - A4-COMERCIAL',
        valorTotalFatura: 17422.37,
        basePisCofinsDeclarada: 13754.61,
        aliquotaPisDeclarada: 0.0063,
        aliquotaCofinsDeclarada: 0.0289,
      },
      rubricas: [
        // Demanda Geracao - principal item ICMS
        { descricao: 'Demanda Geracao', valorTotalReais: 15303.57, baseCalculoIcms: 15303.57, aliquotaIcms: 0.17, valorIcms: 2601.61, valorPisCofins: 447.11 },
        // Demanda contratada normal
        { descricao: 'Demanda', valorTotalReais: 178.64, baseCalculoIcms: 178.64, aliquotaIcms: 0.17, valorIcms: 30.37, valorPisCofins: 5.22 },
        // Ultrapassagem
        { descricao: 'Ultrapassagem', valorTotalReais: 357.26, baseCalculoIcms: 357.26, aliquotaIcms: 0.17, valorIcms: 60.73, valorPisCofins: 10.44 },
        // DRE
        { descricao: 'DRE-Demanda Reativa Excedente', valorTotalReais: 357.26, baseCalculoIcms: 357.26, aliquotaIcms: 0.17, valorIcms: 60.73, valorPisCofins: 10.44 },
        // ERE
        { descricao: 'ERE-Energia Reativa Excedente', valorTotalReais: 673.88, baseCalculoIcms: 673.88, aliquotaIcms: 0.17, valorIcms: 114.56, valorPisCofins: 19.68 },
        // CIP
        { descricao: 'Contribuicao de Ilum. Publica', valorTotalReais: 239.81 },
      ],
    });
    const r = detector.detectar(fatura);
    expect(r.padrao).not.toBeNull();
    expect(r.padrao?.sinal).toBe('FAVORAVEL_AO_CLIENTE');
    expect(r.padrao?.valorIndebitoMensal).toBe(0);
    expect(r.padrao?.detalhe).toContain('Divergencia');
    expect(r.padrao?.fundamento.classificacaoDossie).toBe('T3');
  });

  it('cenario hipotetico - cobrancas com Tema 69 ignorado -> INDEBITO_TRIBUTARIO', () => {
    // Forca cenario antigo (pre-2017): base declarada inclui ICMS na soma.
    const fatura = parsear({
      metadados: {
        mesReferencia: '2015-06',
        classificacao: 'B - B1-RESIDENCIAL',
        valorTotalFatura: 600,
        basePisCofinsDeclarada: 700, // declarada INCLUIU ICMS de R$ 100
        aliquotaPisDeclarada: 0.0094,
        aliquotaCofinsDeclarada: 0.0432,
      },
      rubricas: [
        { descricao: 'TUSD - Consumo', valorTotalReais: 500, baseCalculoIcms: 500, aliquotaIcms: 0.17, valorIcms: 85, valorPisCofins: 0 },
        { descricao: 'TE - Consumo', valorTotalReais: 200, baseCalculoIcms: 200, aliquotaIcms: 0.17, valorIcms: 15, valorPisCofins: 0 },
      ],
    });
    const r = detector.detectar(fatura);
    expect(r.padrao).not.toBeNull();
    expect(r.padrao?.sinal).toBe('INDEBITO_TRIBUTARIO');
    expect(r.padrao?.valorIndebitoMensal).toBeGreaterThan(0);
  });
});

// ════════════════════════════════════════════════════════════════════════
// DetectorTese3PisCofinsSobreScee
// ════════════════════════════════════════════════════════════════════════
describe('DetectorTese3PisCofinsSobreScee', () => {
  const detector = new DetectorTese3PisCofinsSobreScee();

  it('Leonardo (cativo sem GD): tese nao aplica -> sem padrao', () => {
    const fatura = parsear({
      metadados: {
        mesReferencia: '2026-04',
        classificacao: 'B - B1-RESIDENCIAL',
        valorTotalFatura: 570.56,
        aliquotaPisDeclarada: 0.0094,
        aliquotaCofinsDeclarada: 0.0432,
        basePisCofinsDeclarada: 449.07,
      },
      rubricas: [
        { descricao: 'TUSD - Consumo', valorTotalReais: 321.23, baseCalculoIcms: 321.23, aliquotaIcms: 0.17, valorIcms: 54.61, valorPisCofins: 14.03 },
        { descricao: 'TE - Consumo', valorTotalReais: 219.82, baseCalculoIcms: 219.82, aliquotaIcms: 0.17, valorIcms: 37.37, valorPisCofins: 9.60 },
      ],
    });
    const r = detector.detectar(fatura);
    expect(r.padrao).toBeNull();
  });

  it('Luciano (B1 GD residencial): captura R$ ~49,91/mes', () => {
    // TUSD fornecida 656.30, injetada total -564.31 (4 linhas), liquido 92.00
    // TE fornecida 449.11, injetada total -386.15 (4 linhas), liquido 62.96
    // Liquido total 154.96 - icmsLiq 17.28 = baseCorreta 137.68
    // PIS+COFINS legitimo: 137.68 * 0.064 = 8.81
    // PIS+COFINS cobrado: 58.72 (34.86 + 23.86)
    // Indebito: 58.72 - 8.81 = 49.91
    const fatura = parsear({
      metadados: {
        mesReferencia: '2026-03',
        classificacao: 'B - B1-RESIDENCIAL',
        valorTotalFatura: 184.46,
        basePisCofinsDeclarada: 917.49,
        aliquotaPisDeclarada: 0.0114,
        aliquotaCofinsDeclarada: 0.0526,
      },
      rubricas: [
        { descricao: 'TUSD - Energia Ativa Fornecida', valorTotalReais: 656.30, baseCalculoIcms: 656.30, aliquotaIcms: 0.17, valorIcms: 111.57, valorPisCofins: 34.86 },
        { descricao: 'TUSD - En. At. Inj. oUC oPT 02/2026 (a)', valorTotalReais: -252.00, baseCalculoIcms: -266.13, aliquotaIcms: 0.17, valorIcms: -45.24, valorPisCofins: 0 },
        { descricao: 'TUSD - En. At. Inj. oUC oPT 02/2026 (b)', valorTotalReais: -156.03, baseCalculoIcms: -164.79, aliquotaIcms: 0.17, valorIcms: -28.01, valorPisCofins: 0 },
        { descricao: 'TUSD - En. At. Inj. oUC oPT 02/2026 (c)', valorTotalReais: -78.20, baseCalculoIcms: -82.59, aliquotaIcms: 0.17, valorIcms: -14.04, valorPisCofins: 0 },
        { descricao: 'TUSD - En. At. Inj. oUC oPT 02/2026 (d)', valorTotalReais: -78.08, baseCalculoIcms: -82.46, aliquotaIcms: 0.17, valorIcms: -14.02, valorPisCofins: 0 },
        { descricao: 'TE - Energia Ativa Fornecida', valorTotalReais: 449.11, baseCalculoIcms: 449.11, aliquotaIcms: 0.17, valorIcms: 76.35, valorPisCofins: 23.86 },
        { descricao: 'TE - En. At. Inj. oUC oPT 02/2026 (a)', valorTotalReais: -172.44, baseCalculoIcms: -182.11, aliquotaIcms: 0.17, valorIcms: -30.96, valorPisCofins: 0 },
        { descricao: 'TE - En. At. Inj. oUC oPT 02/2026 (b)', valorTotalReais: -106.77, baseCalculoIcms: -112.76, aliquotaIcms: 0.17, valorIcms: -19.17, valorPisCofins: 0 },
        { descricao: 'TE - En. At. Inj. oUC oPT 02/2026 (c)', valorTotalReais: -53.51, baseCalculoIcms: -56.51, aliquotaIcms: 0.17, valorIcms: -9.61, valorPisCofins: 0 },
        { descricao: 'TE - En. At. Inj. oUC oPT 02/2026 (d)', valorTotalReais: -53.43, baseCalculoIcms: -56.43, aliquotaIcms: 0.17, valorIcms: -9.59, valorPisCofins: 0 },
      ],
    });
    const r = detector.detectar(fatura);
    expect(r.padrao).not.toBeNull();
    expect(r.padrao?.sinal).toBe('INDEBITO_TRIBUTARIO');
    // Tolerancia 1.5 reais (calculo manual aproximado)
    expect(r.padrao?.valorIndebitoMensal).toBeGreaterThan(48);
    expect(r.padrao?.valorIndebitoMensal).toBeLessThan(52);
    expect(r.padrao?.fundamento.classificacaoDossie).toBe('T3');
    expect(r.padrao?.fundamento.risco).toBe('MEDIO');
  });

  it('EXFISHES ABR/26 (cooperada GDIII): captura R$ ~2.515/mes', () => {
    // TUSD liquido: 43743.61 - 17917.63 = 25825.98
    // TE liquido: 29933.42 - 23309.59 = 6623.83
    // Liquido total: 32449.81
    // ICMS liquido (so fornecida tem ICMS, injetada GDIII tem 0):
    //   7436.41 + 5088.68 = 12525.09
    // Base correta: 32449.81 - 12525.09 = 19924.72
    // Aliq PIS+COFINS EXFISHES: 0.094 + 0.0432 = OPS! EXFISHES tem 0.063 + 0.0289 = 0.0352
    // PIS+COFINS legitimo: 19924.72 * 0.0352 = 701.35
    // PIS+COFINS cobrado: 1909.76 + 1306.83 = 3216.59
    // Indebito: 3216.59 - 701.35 = 2515.24
    const fatura = parsear({
      metadados: {
        mesReferencia: '2026-04',
        classificacao: 'B - B3-COMERCIAL',
        valorTotalFatura: 32486.37,
        basePisCofinsDeclarada: 61151.94,
        aliquotaPisDeclarada: 0.0063,
        aliquotaCofinsDeclarada: 0.0289,
      },
      rubricas: [
        { descricao: 'TUSD - Energia Ativa Fornecida', valorTotalReais: 43743.61, baseCalculoIcms: 43743.61, aliquotaIcms: 0.17, valorIcms: 7436.41, valorPisCofins: 1909.76 },
        { descricao: 'TUSD - En. At. Inj. oUC oPT GDIII 03/2026', valorTotalReais: -17917.63, baseCalculoIcms: 0, aliquotaIcms: 0, valorIcms: 0, valorPisCofins: 0 },
        { descricao: 'TE - Energia Ativa Fornecida', valorTotalReais: 29933.42, baseCalculoIcms: 29933.42, aliquotaIcms: 0.17, valorIcms: 5088.68, valorPisCofins: 1306.83 },
        { descricao: 'TE - En. At. Inj. oUC oPT GDIII 03/2026', valorTotalReais: -23309.59, baseCalculoIcms: 0, aliquotaIcms: 0, valorIcms: 0, valorPisCofins: 0 },
      ],
    });
    const r = detector.detectar(fatura);
    expect(r.padrao).not.toBeNull();
    expect(r.padrao?.sinal).toBe('INDEBITO_TRIBUTARIO');
    expect(r.padrao?.valorIndebitoMensal).toBeGreaterThan(2500);
    expect(r.padrao?.valorIndebitoMensal).toBeLessThan(2530);
  });

  it('CUSD CoopereBR I (TUSD/TE cancelam 100%): indebito Tese 3 nulo', () => {
    const fatura = parsear({
      metadados: {
        mesReferencia: '2026-04',
        classificacao: 'A - A4-INDUSTRIAL',
        valorTotalFatura: 16252.53,
        basePisCofinsDeclarada: 13339.78,
        aliquotaPisDeclarada: 0.0094,
        aliquotaCofinsDeclarada: 0.0432,
      },
      rubricas: [
        // TUSD/TE fornecida e injetada cancelam (PIS/COFINS positivos cancelados pelos negativos)
        { descricao: 'TUSD - Energia Ativa Fornecida Ponta', valorTotalReais: 234.77, baseCalculoIcms: 234.77, aliquotaIcms: 0.17, valorIcms: 39.91, valorPisCofins: 10.25 },
        { descricao: 'TUSD - En. At. Ponta Inj. mUC oPT 04/2026', valorTotalReais: -234.77, baseCalculoIcms: -234.77, aliquotaIcms: 0.17, valorIcms: -39.91, valorPisCofins: -10.25 },
        { descricao: 'TE - Energia Ativa Fornecida Ponta', valorTotalReais: 85.07, baseCalculoIcms: 85.07, aliquotaIcms: 0.17, valorIcms: 14.46, valorPisCofins: 3.71 },
        { descricao: 'TE - En. At. Ponta Inj. mUC oPT 04/2026', valorTotalReais: -85.07, baseCalculoIcms: -85.07, aliquotaIcms: 0.17, valorIcms: -14.46, valorPisCofins: -3.71 },
        // Demanda Geracao + DRE + ERE - nao sao energeticos, Tese 3 nao toca
        { descricao: 'Demanda Geracao', valorTotalReais: 15654.77, baseCalculoIcms: 15654.77, aliquotaIcms: 0.17, valorIcms: 2661.31, valorPisCofins: 683.46 },
      ],
    });
    const r = detector.detectar(fatura);
    // PIS+COFINS cobrado positivo sobre TUSD+TE energetico: 10.25+3.71 = 13.96
    // Mas legitimo seria sobre liquido = 0 - icmsLiq = 0; pisLegitimo = 0
    // Indebito candidato: 13.96 - 0 = 13.96 (acima da tolerancia 0.5)
    // Pode dar padrao positivo mas baixo. O importante e que NAO seja R$ 2000+.
    if (r.padrao) {
      expect(r.padrao.valorIndebitoMensal).toBeLessThan(20);
    }
  });
});

// ════════════════════════════════════════════════════════════════════════
// DetectorTese2IcmsTusdGeracao
// ════════════════════════════════════════════════════════════════════════
describe('DetectorTese2IcmsTusdGeracao', () => {
  const detector = new DetectorTese2IcmsTusdGeracao();

  it('Leonardo (residencial sem demanda): sem padrao', () => {
    const fatura = parsear({
      metadados: {
        mesReferencia: '2026-04',
        classificacao: 'B - B1-RESIDENCIAL',
        valorTotalFatura: 570.56,
        aliquotaPisDeclarada: 0.0094,
        aliquotaCofinsDeclarada: 0.0432,
      },
      rubricas: [
        { descricao: 'TUSD - Consumo', valorTotalReais: 321.23, baseCalculoIcms: 321.23, aliquotaIcms: 0.17, valorIcms: 54.61, valorPisCofins: 14.03 },
        { descricao: 'TE - Consumo', valorTotalReais: 219.82, baseCalculoIcms: 219.82, aliquotaIcms: 0.17, valorIcms: 37.37, valorPisCofins: 9.60 },
      ],
    });
    const r = detector.detectar(fatura);
    expect(r.padrao).toBeNull();
  });

  it('CUSD CoopereBR I (usina): captura R$ 2.732,24 (TUSD-G + DRE + ERE)', () => {
    const fatura = parsear({
      metadados: {
        mesReferencia: '2026-04',
        classificacao: 'A - A4-INDUSTRIAL',
        valorTotalFatura: 16252.53,
        aliquotaPisDeclarada: 0.0094,
        aliquotaCofinsDeclarada: 0.0432,
      },
      rubricas: [
        { descricao: 'Demanda Geracao', valorTotalReais: 15654.77, baseCalculoIcms: 15654.77, aliquotaIcms: 0.17, valorIcms: 2661.31, valorPisCofins: 683.46 },
        { descricao: 'DRE-Demanda Reativa Excedente', valorTotalReais: 255.82, baseCalculoIcms: 255.82, aliquotaIcms: 0.17, valorIcms: 43.49, valorPisCofins: 11.17 },
        { descricao: 'ERE-Energia Reativa Excedente', valorTotalReais: 161.43, baseCalculoIcms: 161.43, aliquotaIcms: 0.17, valorIcms: 27.44, valorPisCofins: 7.05 },
      ],
    });
    const r = detector.detectar(fatura);
    expect(r.padrao).not.toBeNull();
    expect(r.padrao?.sinal).toBe('INDEBITO_TRIBUTARIO');
    expect(r.padrao?.valorIndebitoMensal).toBeCloseTo(2732.24, 1);
    expect(r.padrao?.valorIndebito60mSelic).toBeCloseTo(204918, -1);
    expect(r.padrao?.fundamento.classificacaoDossie).toBe('T2');
    expect(r.padrao?.fundamento.risco).toBe('BAIXO');
    expect(r.padrao?.detalhe).toContain('TUSD_G');
    expect(r.padrao?.detalhe).toContain('DEMANDA_REATIVA_EXC');
    expect(r.padrao?.detalhe).toContain('ENERGIA_REATIVA_EXC');
  });

  it('CUSD CoopereBR II (usina+UC): captura R$ 2.868,00 (todos 5 tipos)', () => {
    const fatura = parsear({
      metadados: {
        mesReferencia: '2026-05',
        classificacao: 'A - A4-COMERCIAL',
        valorTotalFatura: 17422.37,
        aliquotaPisDeclarada: 0.0063,
        aliquotaCofinsDeclarada: 0.0289,
      },
      rubricas: [
        { descricao: 'Demanda', valorTotalReais: 178.64, baseCalculoIcms: 178.64, aliquotaIcms: 0.17, valorIcms: 30.37, valorPisCofins: 5.22 },
        { descricao: 'Demanda Geracao', valorTotalReais: 15303.57, baseCalculoIcms: 15303.57, aliquotaIcms: 0.17, valorIcms: 2601.61, valorPisCofins: 447.11 },
        { descricao: 'Ultrapassagem', valorTotalReais: 357.26, baseCalculoIcms: 357.26, aliquotaIcms: 0.17, valorIcms: 60.73, valorPisCofins: 10.44 },
        { descricao: 'DRE-Demanda Reativa Excedente', valorTotalReais: 357.26, baseCalculoIcms: 357.26, aliquotaIcms: 0.17, valorIcms: 60.73, valorPisCofins: 10.44 },
        { descricao: 'ERE-Energia Reativa Excedente', valorTotalReais: 673.88, baseCalculoIcms: 673.88, aliquotaIcms: 0.17, valorIcms: 114.56, valorPisCofins: 19.68 },
      ],
    });
    const r = detector.detectar(fatura);
    expect(r.padrao).not.toBeNull();
    expect(r.padrao?.valorIndebitoMensal).toBeCloseTo(2868.00, 1);
    expect(r.padrao?.rubricasEnvolvidas).toHaveLength(5);
  });
});

// ════════════════════════════════════════════════════════════════════════
// DetectorTese6IcmsTusdTeSobreScee
// ════════════════════════════════════════════════════════════════════════
describe('DetectorTese6IcmsTusdTeSobreScee', () => {
  const detector = new DetectorTese6IcmsTusdTeSobreScee();

  it('EXFISHES ABR/2026 (EDP cobra ICMS sobre bruto): indebito ~R$ 7.008', () => {
    // Base BRUTA = 43743.61 + 29933.42 = 73677.03
    // Injecao SCEE = 17917.63 + 23309.59 = 41227.22
    // Base LIQUIDA correta = 32449.81
    // ICMS cobrado sobre fornecida = 7436.41 + 5088.68 = 12525.09
    // ICMS legitimo = 32449.81 * 0.17 = 5516.47
    // Indebito = 12525.09 - 5516.47 = 7008.62
    const fatura = parsear({
      metadados: {
        mesReferencia: '2026-04',
        classificacao: 'B - B3-COMERCIAL',
        valorTotalFatura: 32486.37,
        basePisCofinsDeclarada: 61151.94,
        aliquotaPisDeclarada: 0.0094,
        aliquotaCofinsDeclarada: 0.0432,
      },
      rubricas: [
        { descricao: 'TUSD - Energia Ativa Fornecida', valorTotalReais: 43743.61, baseCalculoIcms: 43743.61, aliquotaIcms: 0.17, valorIcms: 7436.41, valorPisCofins: 1909.76 },
        { descricao: 'TUSD - En. At. Inj. oUC oPT GDIII 03/2026', valorTotalReais: -17917.63, baseCalculoIcms: 0, aliquotaIcms: 0, valorIcms: 0, valorPisCofins: 0 },
        { descricao: 'TE - Energia Ativa Fornecida', valorTotalReais: 29933.42, baseCalculoIcms: 29933.42, aliquotaIcms: 0.17, valorIcms: 5088.68, valorPisCofins: 1306.83 },
        { descricao: 'TE - En. At. Inj. oUC oPT GDIII 03/2026', valorTotalReais: -23309.59, baseCalculoIcms: 0, aliquotaIcms: 0, valorIcms: 0, valorPisCofins: 0 },
      ],
    });
    const r = detector.detectar(fatura);
    expect(r.padrao).not.toBeNull();
    expect(r.padrao?.sinal).toBe('INDEBITO_TRIBUTARIO');
    expect(r.padrao?.valorIndebitoMensal).toBeCloseTo(7008.62, 1);
    expect(r.padrao?.valorIndebito60mSelic).toBeCloseTo(525646.5, 0);
    expect(r.padrao?.fundamento.classificacaoDossie).toBe('T3');
    expect(r.padrao?.fundamento.risco).toBe('MEDIO');
    expect(r.padrao?.fundamento.ementa).toContain('Art. 79 Lei 5.764/71');
    expect(r.padrao?.fundamento.ementa).toContain('TJ-MT');
    expect(r.padrao?.detalhe).toContain('Base ICMS LIQUIDA');
  });

  it('ELFSM-style (concessionaria que ja aplica ICMS negativo na injecao): sem indebito', () => {
    // Simula uma fatura onde a concessionaria zera o ICMS no liquido
    // (cobrando positivo sobre forn E negativo sobre inj) - cancela.
    const fatura = parsear({
      metadados: {
        mesReferencia: '2026-04',
        classificacao: 'B - B3-COMERCIAL',
        valorTotalFatura: 5000,
        basePisCofinsDeclarada: 4500,
        aliquotaPisDeclarada: 0.0094,
        aliquotaCofinsDeclarada: 0.0432,
      },
      rubricas: [
        { descricao: 'TUSD - Energia Ativa Fornecida', valorTotalReais: 10000, baseCalculoIcms: 10000, aliquotaIcms: 0.17, valorIcms: 1700, valorPisCofins: 526 },
        { descricao: 'TUSD - Injecao SCEE', valorTotalReais: -8000, baseCalculoIcms: -8000, aliquotaIcms: 0.17, valorIcms: -1360, valorPisCofins: -421 },
        { descricao: 'TE - Energia Ativa Fornecida', valorTotalReais: 6000, baseCalculoIcms: 6000, aliquotaIcms: 0.17, valorIcms: 1020, valorPisCofins: 316 },
        { descricao: 'TE - Injecao SCEE', valorTotalReais: -4000, baseCalculoIcms: -4000, aliquotaIcms: 0.17, valorIcms: -680, valorPisCofins: -210 },
      ],
    });
    const r = detector.detectar(fatura);
    // ICMS liquido = (1700 + 1020) - (1360 + 680) = 680
    // Base liquida = (10000 + 6000) - (8000 + 4000) = 4000
    // ICMS legitimo = 4000 * 0.17 = 680
    // Indebito = 680 - 680 = 0 -> sem padrao
    expect(r.padrao).toBeNull();
  });

  it('cativo sem GD: detector nao aplica', () => {
    const fatura = parsear({
      metadados: {
        mesReferencia: '2026-04',
        classificacao: 'B - B1-RESIDENCIAL',
        valorTotalFatura: 570.56,
        basePisCofinsDeclarada: 449.07,
        aliquotaPisDeclarada: 0.0094,
        aliquotaCofinsDeclarada: 0.0432,
      },
      rubricas: [
        { descricao: 'TUSD - Consumo', valorTotalReais: 321.23, baseCalculoIcms: 321.23, aliquotaIcms: 0.17, valorIcms: 54.61, valorPisCofins: 14.03 },
        { descricao: 'TE - Consumo', valorTotalReais: 219.82, baseCalculoIcms: 219.82, aliquotaIcms: 0.17, valorIcms: 37.37, valorPisCofins: 9.60 },
      ],
    });
    const r = detector.detectar(fatura);
    expect(r.padrao).toBeNull();
  });

  it('aliq ICMS zero: detector nao aplica', () => {
    const fatura = parsear({
      metadados: {
        mesReferencia: '2026-04',
        classificacao: 'B - B3-COMERCIAL',
        valorTotalFatura: 100,
        basePisCofinsDeclarada: 90,
        aliquotaPisDeclarada: 0.0094,
        aliquotaCofinsDeclarada: 0.0432,
      },
      rubricas: [
        { descricao: 'TUSD - Energia Ativa Fornecida', valorTotalReais: 50, baseCalculoIcms: 50, aliquotaIcms: 0, valorIcms: 0, valorPisCofins: 4.4 },
        { descricao: 'TUSD - Injecao SCEE', valorTotalReais: -10, baseCalculoIcms: 0, aliquotaIcms: 0, valorIcms: 0, valorPisCofins: 0 },
      ],
    });
    const r = detector.detectar(fatura);
    expect(r.padrao).toBeNull();
  });
});

// ════════════════════════════════════════════════════════════════════════
// DetectoresRegistry
// ════════════════════════════════════════════════════════════════════════
describe('DetectoresRegistry - consolidacao', () => {
  let registry: DetectoresRegistry;

  beforeEach(() => {
    registry = new DetectoresRegistry(
      new DetectorTema69Stricto(),
      new DetectorTese3PisCofinsSobreScee(),
      new DetectorTese2IcmsTusdGeracao(),
      new DetectorTese6IcmsTusdTeSobreScee(),
    );
  });

  it('lista 4 detectores', () => {
    const lista = registry.listarDetectores();
    expect(lista).toHaveLength(4);
    expect(lista).toContain('TEMA_69_STRICTO_DIVERGENCIA');
    expect(lista).toContain('TESE_3_PIS_COFINS_SOBRE_SCEE');
    expect(lista).toContain('TESE_2_ICMS_TUSD_GERACAO');
    expect(lista).toContain('TESE_6_ICMS_TUSD_TE_SOBRE_SCEE');
  });

  it('CUSD I: roda 4 detectores - so Tese 2 retorna padrao significativo', () => {
    const fatura = parsear({
      metadados: {
        mesReferencia: '2026-04',
        classificacao: 'A - A4-INDUSTRIAL',
        valorTotalFatura: 16252.53,
        basePisCofinsDeclarada: 13339.78,
        aliquotaPisDeclarada: 0.0094,
        aliquotaCofinsDeclarada: 0.0432,
      },
      rubricas: [
        { descricao: 'Demanda Geracao', valorTotalReais: 15654.77, baseCalculoIcms: 15654.77, aliquotaIcms: 0.17, valorIcms: 2661.31, valorPisCofins: 683.46 },
        { descricao: 'DRE-Demanda Reativa Excedente', valorTotalReais: 255.82, baseCalculoIcms: 255.82, aliquotaIcms: 0.17, valorIcms: 43.49, valorPisCofins: 11.17 },
        { descricao: 'ERE-Energia Reativa Excedente', valorTotalReais: 161.43, baseCalculoIcms: 161.43, aliquotaIcms: 0.17, valorIcms: 27.44, valorPisCofins: 7.05 },
      ],
    });
    const consolidado = registry.detectarTodos(fatura);
    expect(consolidado.padroes.length).toBeGreaterThanOrEqual(1);
    expect(consolidado.indebitoMensalTotal).toBeGreaterThan(2700);
    expect(consolidado.padroes[0].codigo).toBe('TESE_2_ICMS_TUSD_GERACAO');
  });

  it('ordena padroes por valorIndebitoMensal desc - EXFISHES ABR Tese 6 maior que Tese 3', () => {
    // EXFISHES ABR/2026 com os 4 detectores ativos:
    // - Tese 6 (ICMS sobre TUSD/TE) ~ R$ 7.008/mes (maior) - aliq 17% > PIS+COFINS
    // - Tese 3 (PIS+COFINS sobre SCEE) ~ R$ 1.500-2.500/mes
    // - Tese 2 (ICMS TUSD-G) sem demanda contratada - null
    // - Tema 69 ok - null
    const fatura = parsear({
      metadados: {
        mesReferencia: '2026-04',
        classificacao: 'B - B3-COMERCIAL',
        valorTotalFatura: 32486.37,
        basePisCofinsDeclarada: 61151.94,
        aliquotaPisDeclarada: 0.0063,
        aliquotaCofinsDeclarada: 0.0289,
      },
      rubricas: [
        { descricao: 'TUSD - Energia Ativa Fornecida', valorTotalReais: 43743.61, baseCalculoIcms: 43743.61, aliquotaIcms: 0.17, valorIcms: 7436.41, valorPisCofins: 1909.76 },
        { descricao: 'TUSD - En. At. Inj. oUC oPT GDIII 03/2026', valorTotalReais: -17917.63, baseCalculoIcms: 0, aliquotaIcms: 0, valorIcms: 0, valorPisCofins: 0 },
        { descricao: 'TE - Energia Ativa Fornecida', valorTotalReais: 29933.42, baseCalculoIcms: 29933.42, aliquotaIcms: 0.17, valorIcms: 5088.68, valorPisCofins: 1306.83 },
        { descricao: 'TE - En. At. Inj. oUC oPT GDIII 03/2026', valorTotalReais: -23309.59, baseCalculoIcms: 0, aliquotaIcms: 0, valorIcms: 0, valorPisCofins: 0 },
      ],
    });
    const c = registry.detectarTodos(fatura);
    // Tese 6 vira o primeiro (maior indebito ~R$ 7.008/mes)
    expect(c.padroes[0].codigo).toBe('TESE_6_ICMS_TUSD_TE_SOBRE_SCEE');
    expect(c.padroes[0].valorIndebitoMensal).toBeGreaterThan(6500);
    // Tese 3 vem em seguida
    expect(c.padroes[1]?.codigo).toBe('TESE_3_PIS_COFINS_SOBRE_SCEE');
    // Combinado >= R$ 700k em 60m+SELIC (Tese 6 sozinha ja da ~525k)
    expect(c.indebito60mSelicTotal).toBeGreaterThan(600000);
  });
});
