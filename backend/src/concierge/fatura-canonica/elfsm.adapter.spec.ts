import { ElfsmFaturaAdapter } from './elfsm.adapter';
import type { FaturaRawInput } from './fatura-canonica.types';

/**
 * Specs do ElfsmFaturaAdapter calibrado com fatura real do Guilherme Alves
 * dos Santos (Colatina/ES, B1 GD I, Jun/2026, total R$ 334,56).
 *
 * Chave NF3e: 32260627485069000109660000038268281000112380
 */
describe('ElfsmFaturaAdapter - faturas reais', () => {
  let adapter: ElfsmFaturaAdapter;

  beforeEach(() => {
    adapter = new ElfsmFaturaAdapter();
  });

  // ============================================================
  // Validacao de input
  // ============================================================
  describe('validacao', () => {
    it('rubricas vazias -> INPUT_INSUFICIENTE', () => {
      const r = adapter.parsear({
        metadados: { mesReferencia: '2026-06', classificacao: 'B10 RESIDENCIAL', valorTotalFatura: 0 },
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
        metadados: { classificacao: 'B10 RESIDENCIAL', valorTotalFatura: 100 },
        rubricas: [{ descricao: 'Consumo' }],
      });
      expect(r.sucesso).toBe(false);
      if (!r.sucesso) expect(r.motivo).toBe('INPUT_INSUFICIENTE');
    });

    it('rubrica desconhecida -> RUBRICA_DESCONHECIDA', () => {
      const r = adapter.parsear({
        metadados: { mesReferencia: '2026-06', classificacao: 'B10 RESIDENCIAL', valorTotalFatura: 100 },
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
  // Cenario real: Guilherme Alves dos Santos (B1 GD I, Jun/2026)
  // Total R$ 334,56 | 288 kWh consumo direto + 278 kWh SCEE
  // ============================================================
  describe('Cenario Guilherme B1 GD I (residencial Colatina)', () => {
    const inputGuilherme: FaturaRawInput = {
      metadados: {
        mesReferencia: '2026-06',
        dataVencimento: '2026-06-17',
        classificacao: 'B10 RESIDENCIAL',
        modalidadeTarifaria: 'Convencional Monomia',
        titularNome: 'GUILHERME ALVES DOS SANTOS',
        numeroUC: '126658',
        valorTotalFatura: 334.56,
        basePisCofinsDeclarada: 235.36,
        aliquotaPisDeclarada: 0.0116,
        aliquotaCofinsDeclarada: 0.0533,
      },
      rubricas: [
        {
          descricao: 'Consumo',
          unidade: 'kWh',
          quantidade: 288,
          precoUnitarioComTributos: 0.98458333,
          tarifaUnitariaBase: 0.76422,
          valorTotalReais: 283.56,
          baseCalculoIcms: 283.56,
          aliquotaIcms: 0.17,
          valorIcms: 48.20,
          valorPisCofins: 15.27,
        },
        {
          descricao: 'Consumo SCEE',
          unidade: 'kWh',
          quantidade: 278,
          precoUnitarioComTributos: 0.61194245,
          tarifaUnitariaBase: 0.47500,
          valorTotalReais: 170.12,
          baseCalculoIcms: 170.13,
          aliquotaIcms: 0.17,
          valorIcms: 28.92,
          valorPisCofins: 9.15,
        },
        {
          descricao: 'En.At.Inj.mUC.mPT - 06/2026 - GD I',
          unidade: 'kWh',
          quantidade: -278,
          precoUnitarioComTributos: 0.52140288,
          tarifaUnitariaBase: 0.47500,
          valorTotalReais: -144.95,
          baseCalculoIcms: -22.07,
          aliquotaIcms: 0.17,
          valorIcms: -3.75,
          valorPisCofins: -9.15,
        },
        {
          descricao: 'Contr Il Pub Munic',
          unidade: 'Un',
          quantidade: 1,
          precoUnitarioComTributos: 25.83,
          tarifaUnitariaBase: 25.83,
          valorTotalReais: 25.83,
          baseCalculoIcms: 0,
          aliquotaIcms: 0,
          valorIcms: 0,
          valorPisCofins: 0,
        },
      ],
    };

    it('parsea com sucesso e marca distribuidora ELFSM/ES', () => {
      const r = adapter.parsear(inputGuilherme);
      expect(r.sucesso).toBe(true);
      if (r.sucesso) {
        expect(r.fatura.distribuidora).toBe('ELFSM');
        expect(r.fatura.uf).toBe('ES');
        expect(r.fatura.mesReferencia).toBe('2026-06');
        expect(r.fatura.dataVencimento).toBe('2026-06-17');
      }
    });

    it('extrai titular como PF (sem documento), subgrupo B10 residencial', () => {
      const r = adapter.parsear(inputGuilherme);
      expect(r.sucesso).toBe(true);
      if (r.sucesso) {
        expect(r.fatura.titular.tipo).toBe('PF');
        expect(r.fatura.titular.nome).toBe('GUILHERME ALVES DOS SANTOS');
        expect(r.fatura.numeroUC).toBe('126658');
        expect(r.fatura.grupoTarifario).toBe('B');
        expect(r.fatura.subgrupo).toBe('B10');
        expect(r.fatura.classeUso).toBe('RESIDENCIAL');
        expect(r.fatura.modalidadeTarifaria).toBe('CONVENCIONAL');
      }
    });

    it('classifica as 4 rubricas (Consumo=TUSD, Consumo SCEE=TUSD, Injecao=INJECAO_SCEE, CIP)', () => {
      const r = adapter.parsear(inputGuilherme);
      expect(r.sucesso).toBe(true);
      if (r.sucesso) {
        expect(r.fatura.rubricas).toHaveLength(4);

        const tipos = r.fatura.rubricas.map((rub) => rub.tipo);
        expect(tipos).toContain('TUSD'); // Consumo + Consumo SCEE
        expect(tipos).toContain('INJECAO_SCEE');
        expect(tipos).toContain('CONTRIB_ILUM_PUBLICA');

        const consumoDireto = r.fatura.rubricas.find((rub) => rub.descricaoOriginal === 'Consumo');
        expect(consumoDireto?.tipo).toBe('TUSD');
        expect(consumoDireto?.valorTotalReais).toBe(283.56);

        const consumoScee = r.fatura.rubricas.find((rub) => rub.descricaoOriginal === 'Consumo SCEE');
        expect(consumoScee?.tipo).toBe('TUSD');
        expect(consumoScee?.valorTotalReais).toBe(170.12);

        const injecao = r.fatura.rubricas.find((rub) => rub.tipo === 'INJECAO_SCEE');
        expect(injecao?.valorTotalReais).toBe(-144.95);
        expect(injecao?.valorPisCofins).toBe(-9.15); // ELFSM cancela PIS/COFINS via injecao
      }
    });

    it('detecta classificacao SCEE como GD_I pela descricao "GD I"', () => {
      const r = adapter.parsear(inputGuilherme);
      expect(r.sucesso).toBe(true);
      if (r.sucesso) {
        expect(r.fatura.classificacaoScee).toBe('GD_I');
      }
    });

    it('consolida totais tributarios corretamente (ICMS liquido R$ 73,37)', () => {
      const r = adapter.parsear(inputGuilherme);
      expect(r.sucesso).toBe(true);
      if (r.sucesso) {
        const t = r.fatura.totaisTributarios;
        // ICMS positivos: 48.20 + 28.92 = 77.12
        expect(t.icmsCobrado).toBeCloseTo(77.12, 2);
        // ICMS injecao: -3.75
        expect(t.icmsSobreInjecao).toBeCloseTo(-3.75, 2);
        // Liquido: 73.37 (bate com a fatura impressa)
        expect(t.icmsLiquido).toBeCloseTo(73.37, 2);
        // PIS+COFINS positivo cobrado (soma sem sinal): 15.27 + 9.15 = 24.42
        expect(t.pisCofinsCobrado).toBeCloseTo(24.42, 2);
        // Base PIS+COFINS declarada na lateral da fatura
        expect(t.basePisCofinsDeclarada).toBe(235.36);
        expect(t.aliquotaPis).toBe(0.0116);
        expect(t.aliquotaCofins).toBe(0.0533);
        expect(t.aliquotaIcms).toBe(0.17);
      }
    });
  });

  // ============================================================
  // Cenario sem GD (residencial cativo ELFSM hipotetico)
  // ============================================================
  describe('Cenario cativo sem GD', () => {
    it('classificacaoScee = NAO_GD quando nao ha injecao', () => {
      const r = adapter.parsear({
        metadados: {
          mesReferencia: '2026-06',
          classificacao: 'B10 RESIDENCIAL',
          valorTotalFatura: 200,
        },
        rubricas: [
          {
            descricao: 'Consumo',
            unidade: 'kWh',
            quantidade: 200,
            valorTotalReais: 190,
            baseCalculoIcms: 190,
            aliquotaIcms: 0.17,
            valorIcms: 32.3,
            valorPisCofins: 10.2,
          },
          { descricao: 'Contr Il Pub Munic', unidade: 'Un', quantidade: 1, valorTotalReais: 10 },
        ],
      });
      expect(r.sucesso).toBe(true);
      if (r.sucesso) {
        expect(r.fatura.classificacaoScee).toBe('NAO_GD');
      }
    });
  });

  // ============================================================
  // Parser de classificacao - aceita variantes B1 / B10 / B - B10
  // ============================================================
  describe('parser de classificacao', () => {
    const baseInput = (classificacao: string): FaturaRawInput => ({
      metadados: { mesReferencia: '2026-06', classificacao, valorTotalFatura: 100 },
      rubricas: [{ descricao: 'Consumo', valorTotalReais: 100 }],
    });

    it('aceita "B10 RESIDENCIAL" e preserva subgrupo B10', () => {
      const r = adapter.parsear(baseInput('B10 RESIDENCIAL'));
      expect(r.sucesso).toBe(true);
      if (r.sucesso) {
        expect(r.fatura.subgrupo).toBe('B10');
        expect(r.fatura.grupoTarifario).toBe('B');
      }
    });

    it('aceita "B - B10 - RESIDENCIAL"', () => {
      const r = adapter.parsear(baseInput('B - B10 - RESIDENCIAL'));
      expect(r.sucesso).toBe(true);
      if (r.sucesso) {
        expect(r.fatura.subgrupo).toBe('B10');
      }
    });

    it('aceita "B1 RESIDENCIAL" classico (padrao ANEEL)', () => {
      const r = adapter.parsear(baseInput('B1 RESIDENCIAL'));
      expect(r.sucesso).toBe(true);
      if (r.sucesso) {
        expect(r.fatura.subgrupo).toBe('B1');
      }
    });
  });
});
