import { EdpEsFaturaAdapter } from './edp-es.adapter';
import { ElfsmFaturaAdapter } from './elfsm.adapter';
import { EnergisaToFaturaAdapter } from './energisa-to.adapter';
import { FaturaAdapterRegistry } from './registry';
import type { FaturaRawInput } from './fatura-canonica.types';

describe('EdpEsFaturaAdapter - faturas reais', () => {
  let adapter: EdpEsFaturaAdapter;

  beforeEach(() => {
    adapter = new EdpEsFaturaAdapter();
  });

  // ============================================================
  // Validacao de input
  // ============================================================
  describe('validacao', () => {
    it('rubricas vazias -> INPUT_INSUFICIENTE', () => {
      const r = adapter.parsear({
        metadados: { mesReferencia: '2026-03', classificacao: 'B - B1', valorTotalFatura: 0 },
        rubricas: [],
      });
      expect(r.sucesso).toBe(false);
      if (!r.sucesso) {
        expect(r.motivo).toBe('INPUT_INSUFICIENTE');
        expect(r.detalhe).toContain('rubricas');
      }
    });

    it('mesReferencia ausente -> INPUT_INSUFICIENTE', () => {
      const r = adapter.parsear({
        metadados: { classificacao: 'B - B1', valorTotalFatura: 100 },
        rubricas: [{ descricao: 'TUSD - Energia Ativa Fornecida' }],
      });
      expect(r.sucesso).toBe(false);
      if (!r.sucesso) expect(r.motivo).toBe('INPUT_INSUFICIENTE');
    });

    it('rubrica desconhecida -> RUBRICA_DESCONHECIDA', () => {
      const r = adapter.parsear({
        metadados: { mesReferencia: '2026-03', classificacao: 'B - B1', valorTotalFatura: 100 },
        rubricas: [{ descricao: 'Servico exotico nao mapeado XYZ' }],
      });
      expect(r.sucesso).toBe(false);
      if (!r.sucesso) {
        expect(r.motivo).toBe('RUBRICA_DESCONHECIDA');
        expect(r.detalhe).toContain('exotico');
      }
    });
  });

  // ============================================================
  // Cenario 1: EDP residencial cativo (Leonardo MAR/26)
  // Total: R$ 570,56 | 539 kWh | B1 RESIDENCIAL CONVENCIONAL | sem GD
  // ============================================================
  describe('Cenario residencial cativo (Leonardo B1)', () => {
    const inputLeonardo: FaturaRawInput = {
      metadados: {
        mesReferencia: '2026-04',
        classificacao: 'B - B1-RESIDENCIAL',
        modalidadeTarifaria: 'CONVENCIONAL',
        titularNome: 'LEONARDO PIZZOL VIGNA',
        titularDocumento: '09204371765',
        numeroUC: '0.000.374.127.054-59',
        valorTotalFatura: 570.56,
        basePisCofinsDeclarada: 449.07,
        aliquotaPisDeclarada: 0.0094,
        aliquotaCofinsDeclarada: 0.0432,
      },
      rubricas: [
        {
          descricao: 'TUSD - Consumo',
          unidade: 'kWh',
          quantidade: 539,
          precoUnitarioComTributos: 0.59597403,
          tarifaUnitariaBase: 0.46863,
          valorTotalReais: 321.23,
          baseCalculoIcms: 321.23,
          aliquotaIcms: 0.17,
          valorIcms: 54.61,
          valorPisCofins: 14.03,
        },
        {
          descricao: 'TE - Consumo',
          unidade: 'kWh',
          quantidade: 539,
          precoUnitarioComTributos: 0.40782931,
          tarifaUnitariaBase: 0.32068,
          valorTotalReais: 219.82,
          baseCalculoIcms: 219.82,
          aliquotaIcms: 0.17,
          valorIcms: 37.37,
          valorPisCofins: 9.60,
        },
        {
          descricao: 'Contribuicao de Ilum. Publica - Lei Municipal 9156/2017',
          valorTotalReais: 29.51,
          baseCalculoIcms: 0,
          aliquotaIcms: 0,
          valorIcms: 0,
          valorPisCofins: 0,
        },
      ],
    };

    it('parseia com sucesso', () => {
      const r = adapter.parsear(inputLeonardo);
      expect(r.sucesso).toBe(true);
    });

    it('classifica grupo B1 RESIDENCIAL CONVENCIONAL', () => {
      const r = adapter.parsear(inputLeonardo);
      if (!r.sucesso) throw new Error('esperava sucesso');
      expect(r.fatura.grupoTarifario).toBe('B');
      expect(r.fatura.subgrupo).toBe('B1');
      expect(r.fatura.classeUso).toBe('RESIDENCIAL');
      expect(r.fatura.modalidadeTarifaria).toBe('CONVENCIONAL');
    });

    it('detecta titular PF e nao-GD', () => {
      const r = adapter.parsear(inputLeonardo);
      if (!r.sucesso) throw new Error('esperava sucesso');
      expect(r.fatura.titular.tipo).toBe('PF');
      expect(r.fatura.titular.nome).toBe('LEONARDO PIZZOL VIGNA');
      expect(r.fatura.classificacaoScee).toBe('NAO_GD');
    });

    it('classifica 3 rubricas: TUSD, TE, CIP', () => {
      const r = adapter.parsear(inputLeonardo);
      if (!r.sucesso) throw new Error('esperava sucesso');
      expect(r.fatura.rubricas).toHaveLength(3);
      expect(r.fatura.rubricas[0].tipo).toBe('TUSD');
      expect(r.fatura.rubricas[1].tipo).toBe('TE');
      expect(r.fatura.rubricas[2].tipo).toBe('CONTRIB_ILUM_PUBLICA');
    });

    it('consolida totais tributarios corretamente', () => {
      const r = adapter.parsear(inputLeonardo);
      if (!r.sucesso) throw new Error('esperava sucesso');
      const t = r.fatura.totaisTributarios;
      expect(t.icmsCobrado).toBeCloseTo(91.98, 2);
      expect(t.icmsSobreInjecao).toBeCloseTo(0, 2);
      expect(t.icmsLiquido).toBeCloseTo(91.98, 2);
      expect(t.pisCofinsCobrado).toBeCloseTo(23.63, 2);
      expect(t.basePisCofinsDeclarada).toBe(449.07);
    });
  });

  // ============================================================
  // Cenario 2: EXFISHES cooperada GDIII (ABR/26)
  // Total: R$ 32.486,37 | B3-COMERCIAL | participacao 71% (GD III)
  // ============================================================
  describe('Cenario cooperada GDIII (EXFISHES B3)', () => {
    const inputExfishes: FaturaRawInput = {
      metadados: {
        mesReferencia: '2026-04',
        classificacao: 'B - B3-COMERCIAL - SERV. DE TRANSPORTE, EXCL TRACAO ELETR',
        modalidadeTarifaria: 'CONVENCIONAL',
        titularNome: 'EXFISHES TERMINAL PESQUEIRO SPE LTDA',
        titularDocumento: '46416512000134',
        numeroUC: '0.001.233.346.054-81',
        valorTotalFatura: 32486.37,
        basePisCofinsDeclarada: 61151.94,
        aliquotaPisDeclarada: 0.0094,
        aliquotaCofinsDeclarada: 0.0432,
      },
      rubricas: [
        {
          descricao: 'TUSD - Energia Ativa Fornecida',
          unidade: 'kWh',
          quantidade: 73400,
          valorTotalReais: 43743.61,
          baseCalculoIcms: 43743.61,
          aliquotaIcms: 0.17,
          valorIcms: 7436.41,
          valorPisCofins: 1909.76,
        },
        {
          descricao: 'TUSD - En. At. Inj. oUC oPT GDIII 03/2026',
          unidade: 'kWh',
          quantidade: -73400,
          valorTotalReais: -17917.63,
          baseCalculoIcms: 0,
          aliquotaIcms: 0,
          valorIcms: 0,
          valorPisCofins: 0,
        },
        {
          descricao: 'TE - Energia Ativa Fornecida',
          unidade: 'kWh',
          quantidade: 73400,
          valorTotalReais: 29933.42,
          baseCalculoIcms: 29933.42,
          aliquotaIcms: 0.17,
          valorIcms: 5088.68,
          valorPisCofins: 1306.83,
        },
        {
          descricao: 'TE - En. At. Inj. oUC oPT GDIII 03/2026',
          unidade: 'kWh',
          quantidade: -73400,
          valorTotalReais: -23309.59,
          baseCalculoIcms: 0,
          aliquotaIcms: 0,
          valorIcms: 0,
          valorPisCofins: 0,
        },
        {
          descricao: 'Contribuicao de Ilum. Publica - Lei Municipal',
          valorTotalReais: 36.56,
        },
      ],
    };

    it('detecta titular PJ e classificacao GD_III', () => {
      const r = adapter.parsear(inputExfishes);
      if (!r.sucesso) throw new Error('esperava sucesso');
      expect(r.fatura.titular.tipo).toBe('PJ');
      expect(r.fatura.classificacaoScee).toBe('GD_III');
      expect(r.fatura.grupoTarifario).toBe('B');
      expect(r.fatura.subgrupo).toBe('B3');
      expect(r.fatura.classeUso).toBe('COMERCIAL');
    });

    it('classifica INJECAO_SCEE para linhas com "Inj."', () => {
      const r = adapter.parsear(inputExfishes);
      if (!r.sucesso) throw new Error('esperava sucesso');
      const injecoes = r.fatura.rubricas.filter((rb) => rb.tipo === 'INJECAO_SCEE');
      expect(injecoes).toHaveLength(2);
    });

    it('icmsLiquido = ICMS sobre fornecida (injecao tem ICMS 0 nessa fatura)', () => {
      const r = adapter.parsear(inputExfishes);
      if (!r.sucesso) throw new Error('esperava sucesso');
      expect(r.fatura.totaisTributarios.icmsCobrado).toBeCloseTo(12525.09, 2);
      expect(r.fatura.totaisTributarios.icmsLiquido).toBeCloseTo(12525.09, 2);
    });

    it('basePisCofinsDeclarada (Tema 69 EDP aplicou: base = baseICMS - ICMS)', () => {
      const r = adapter.parsear(inputExfishes);
      if (!r.sucesso) throw new Error('esperava sucesso');
      // baseIcmsTotal = 43743.61 + 29933.42 = 73677.03
      // icmsLiquido = 12525.09
      // base Tema 69 esperada = 73677.03 - 12525.09 = 61151.94
      expect(r.fatura.totaisTributarios.basePisCofinsDeclarada).toBeCloseTo(61151.94, 2);
      expect(r.fatura.totaisTributarios.baseIcmsTotal).toBeCloseTo(73677.03, 2);
    });
  });

  // ============================================================
  // Cenario 3: CUSD CoopereBR I (A4 industrial usina geradora)
  // Total: R$ 16.252,53 | Demanda Geracao 1000 kW = TUSD-G
  // ============================================================
  describe('Cenario CUSD usina geradora A4 (CoopereBR I)', () => {
    const inputCusdI: FaturaRawInput = {
      metadados: {
        mesReferencia: '2026-04',
        classificacao: 'A - A4-INDUSTRIAL',
        modalidadeTarifaria: 'VERDE',
        titularNome: 'COOPERATIVA DE ENERGIA RENOVAVEL BRASIL COOPERE BR',
        titularDocumento: '41604843000184',
        numeroUC: '0.002.410.013.054-78',
        valorTotalFatura: 16252.53,
        basePisCofinsDeclarada: 13339.78,
        aliquotaPisDeclarada: 0.0094,
        aliquotaCofinsDeclarada: 0.0432,
      },
      rubricas: [
        {
          descricao: 'TUSD - Energia Ativa Fornecida Ponta',
          quantidade: 139.65,
          valorTotalReais: 234.77,
          baseCalculoIcms: 234.77,
          aliquotaIcms: 0.17,
          valorIcms: 39.91,
          valorPisCofins: 10.25,
        },
        {
          descricao: 'TUSD - En. At. Ponta Inj. mUC oPT 04/2026',
          quantidade: -139.65,
          valorTotalReais: -234.77,
          baseCalculoIcms: -234.77,
          aliquotaIcms: 0.17,
          valorIcms: -39.91,
          valorPisCofins: -10.25,
        },
        {
          descricao: 'Demanda Geracao',
          unidade: 'kW',
          quantidade: 1000,
          valorTotalReais: 15654.77,
          baseCalculoIcms: 15654.77,
          aliquotaIcms: 0.17,
          valorIcms: 2661.31,
          valorPisCofins: 683.46,
        },
        {
          descricao: 'DRE-Demanda Reativa Excedente',
          unidade: 'kW',
          quantidade: 6.30,
          valorTotalReais: 255.82,
          baseCalculoIcms: 255.82,
          aliquotaIcms: 0.17,
          valorIcms: 43.49,
          valorPisCofins: 11.17,
        },
        {
          descricao: 'ERE-Energia Reativa Excedente',
          unidade: 'kWh',
          quantidade: 395.85,
          valorTotalReais: 161.43,
          baseCalculoIcms: 161.43,
          aliquotaIcms: 0.17,
          valorIcms: 27.44,
          valorPisCofins: 7.05,
        },
      ],
    };

    it('classifica grupo A subgrupo A4 INDUSTRIAL modalidade VERDE', () => {
      const r = adapter.parsear(inputCusdI);
      if (!r.sucesso) throw new Error('esperava sucesso');
      expect(r.fatura.grupoTarifario).toBe('A');
      expect(r.fatura.subgrupo).toBe('A4');
      expect(r.fatura.classeUso).toBe('INDUSTRIAL');
      expect(r.fatura.modalidadeTarifaria).toBe('VERDE');
    });

    it('detecta Demanda Geracao como TUSD_G (NAO como DEMANDA_CONTRATADA)', () => {
      const r = adapter.parsear(inputCusdI);
      if (!r.sucesso) throw new Error('esperava sucesso');
      const tusdG = r.fatura.rubricas.find((rb) => rb.tipo === 'TUSD_G');
      expect(tusdG).toBeDefined();
      expect(tusdG?.valorTotalReais).toBe(15654.77);
      expect(tusdG?.valorIcms).toBe(2661.31);
    });

    it('detecta DRE e ERE como tipos canonicos separados', () => {
      const r = adapter.parsear(inputCusdI);
      if (!r.sucesso) throw new Error('esperava sucesso');
      expect(r.fatura.rubricas.some((rb) => rb.tipo === 'DEMANDA_REATIVA_EXC')).toBe(true);
      expect(r.fatura.rubricas.some((rb) => rb.tipo === 'ENERGIA_REATIVA_EXC')).toBe(true);
    });

    it('classifica como GD_I (injecao sem GDII/GDIII na descricao)', () => {
      const r = adapter.parsear(inputCusdI);
      if (!r.sucesso) throw new Error('esperava sucesso');
      expect(r.fatura.classificacaoScee).toBe('GD_I');
    });

    it('infere posto PONTA na linha Ponta', () => {
      const r = adapter.parsear(inputCusdI);
      if (!r.sucesso) throw new Error('esperava sucesso');
      const tusdPonta = r.fatura.rubricas.find(
        (rb) => rb.tipo === 'TUSD' && rb.posto === 'PONTA',
      );
      expect(tusdPonta).toBeDefined();
    });
  });

  // ============================================================
  // Classificador de rubrica isolado - cada padrao
  // ============================================================
  describe('classificacao de rubrica - patterns isolados', () => {
    const casos: Array<[string, string]> = [
      ['TUSD - Energia Ativa Fornecida', 'TUSD'],
      ['TUSD - Energia Ativa Fornecida Ponta', 'TUSD'],
      ['TE - Energia Ativa Fornecida FPonta', 'TE'],
      ['TUSD - En. At. Inj. oUC oPT GDIII 04/2026', 'INJECAO_SCEE'],
      ['TE - En. At. FPonta Inj. mUC mPT GDIII 05/2026', 'INJECAO_SCEE'],
      ['Demanda Geracao', 'TUSD_G'],
      ['Demanda Geração', 'TUSD_G'],
      ['Demanda', 'DEMANDA_CONTRATADA'],
      ['Ultrapassagem', 'DEMANDA_ULTRAPASSAGEM'],
      ['DRE-Demanda Reativa Excedente', 'DEMANDA_REATIVA_EXC'],
      ['ERE-Energia Reativa Excedente', 'ENERGIA_REATIVA_EXC'],
      ['Adicional Bandeira Amarela', 'ADICIONAL_BANDEIRA'],
      ['Adicional Bandeira Amarela Energia Inj.', 'INJECAO_SCEE'], // Inj. ganha
      ['Contribuicao de Ilum. Publica - Lei Municipal', 'CONTRIB_ILUM_PUBLICA'],
    ];

    it.each(casos)('rubrica %s -> %s', (descricao, tipoEsperado) => {
      const r = adapter.parsear({
        metadados: { mesReferencia: '2026-01', classificacao: 'B - B1', valorTotalFatura: 100 },
        rubricas: [{ descricao, valorTotalReais: 10 }],
      });
      expect(r.sucesso).toBe(true);
      if (r.sucesso) {
        expect(r.fatura.rubricas[0].tipo).toBe(tipoEsperado);
      }
    });
  });
});

describe('Esqueletos ELFSM + ENERGISA_TO', () => {
  // ElfsmFaturaAdapter foi implementado em C2.5 (calibrado com fatura real Guilherme
  // Colatina/ES Jun/2026). Testes detalhados estao em elfsm.adapter.spec.ts.
  // Aqui mantemos so um smoke negativo - input vazio dispara INPUT_INSUFICIENTE
  // (nao mais NAO_IMPLEMENTADO).
  it('ElfsmFaturaAdapter input vazio -> INPUT_INSUFICIENTE (esqueleto removido em C2.5)', () => {
    const r = new ElfsmFaturaAdapter().parsear({ rubricas: [] });
    expect(r.sucesso).toBe(false);
    if (!r.sucesso) expect(r.motivo).toBe('INPUT_INSUFICIENTE');
  });

  it('EnergisaToFaturaAdapter retorna NAO_IMPLEMENTADO com nota TO', () => {
    const r = new EnergisaToFaturaAdapter().parsear({ rubricas: [] });
    expect(r.sucesso).toBe(false);
    if (!r.sucesso) {
      expect(r.motivo).toBe('NAO_IMPLEMENTADO');
      expect(r.detalhe).toContain('Tocantins');
    }
  });
});

describe('FaturaAdapterRegistry', () => {
  let registry: FaturaAdapterRegistry;

  beforeEach(() => {
    registry = new FaturaAdapterRegistry(
      new EdpEsFaturaAdapter(),
      new ElfsmFaturaAdapter(),
      new EnergisaToFaturaAdapter(),
    );
  });

  it('obterAdapter("EDP_ES") retorna EdpEsFaturaAdapter', () => {
    const a = registry.obterAdapter('EDP_ES');
    expect(a).not.toBeNull();
    expect(a?.distribuidora).toBe('EDP_ES');
  });

  it('obterAdapter("ELFSM") retorna esqueleto ElfsmFaturaAdapter', () => {
    const a = registry.obterAdapter('ELFSM');
    expect(a).not.toBeNull();
    expect(a?.distribuidora).toBe('ELFSM');
  });
  it('obterAdapter de distribuidora sem adapter registrado retorna null', () => {
    const a = registry.obterAdapter('CEMIG');
    expect(a).toBeNull();
  });

  it('listarDistribuidorasComAdapter inclui EDP_ES e ELFSM', () => {
    const lista = registry.listarDistribuidorasComAdapter();
    expect(lista).toContain('EDP_ES');
    expect(lista).toContain('ELFSM');
  });
});
