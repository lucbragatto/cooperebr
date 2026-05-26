import {
  calcularRepasse,
  UsinaParaCalculo,
  GeracaoMesParaCalculo,
  TarifaResolver,
} from './calcular-repasse';

const usinaBase: UsinaParaCalculo = {
  formaPagamentoDono: null,
  valorAluguelFixo: null,
  percentualGeracaoDono: null,
  valorKwhPadrao: null,
  distribuidora: 'EDP_ES',
};

const geracaoBase: GeracaoMesParaCalculo = {
  kwhGerado: 10_000,
  competencia: new Date('2026-05-01'),
};

const tarifaResolverPadrao: TarifaResolver = async () => 0.80;
const tarifaResolverAusente: TarifaResolver = async () => null;

describe('calcularRepasse', () => {
  describe('formaPagamentoDono nao definida', () => {
    it('retorna valor=null com motivo claro', async () => {
      const r = await calcularRepasse(usinaBase, geracaoBase, tarifaResolverPadrao);
      expect(r.valor).toBeNull();
      expect(r.formula).toBe('forma_pagamento_dono_nao_definida');
      expect(r.motivo).toMatch(/formaPagamentoDono nao cadastrado/);
    });
  });

  describe('FIXO', () => {
    it('retorna valorAluguelFixo arredondado pra 2 casas', async () => {
      const r = await calcularRepasse(
        { ...usinaBase, formaPagamentoDono: 'FIXO', valorAluguelFixo: 1234.5678 },
        geracaoBase,
        tarifaResolverPadrao,
      );
      expect(r.valor).toBe(1234.57);
      expect(r.formula).toBe('FIXO');
      expect(r.fonteTarifa).toBeNull();
      expect(r.detalhes?.valorFixo).toBe(1234.5678);
    });

    it('independe de geracao (mesmo sem geracao retorna o fixo)', async () => {
      const r = await calcularRepasse(
        { ...usinaBase, formaPagamentoDono: 'FIXO', valorAluguelFixo: 500 },
        null,
        tarifaResolverPadrao,
      );
      expect(r.valor).toBe(500);
    });

    it('FIXO sem valor cadastrado retorna null com motivo', async () => {
      const r = await calcularRepasse(
        { ...usinaBase, formaPagamentoDono: 'FIXO' },
        geracaoBase,
        tarifaResolverPadrao,
      );
      expect(r.valor).toBeNull();
      expect(r.motivo).toMatch(/valorAluguelFixo obrigatorio/);
    });
  });

  describe('PERCENTUAL', () => {
    it('usa override usina.valorKwhPadrao quando disponivel', async () => {
      const r = await calcularRepasse(
        {
          ...usinaBase,
          formaPagamentoDono: 'PERCENTUAL',
          percentualGeracaoDono: 10,
          valorKwhPadrao: 1.20,
        },
        geracaoBase,
        tarifaResolverPadrao,
      );
      // 10.000 * 1,20 * 10% = 1200
      expect(r.valor).toBe(1200);
      expect(r.formula).toMatch(/PERCENTUAL/);
      expect(r.fonteTarifa).toBe('usina_override');
      expect(r.detalhes?.tarifaKwh).toBe(1.20);
      expect(r.detalhes?.percentual).toBe(10);
      expect(r.detalhes?.kwhGerado).toBe(10_000);
    });

    it('usa fallback tarifaResolver quando usina sem override', async () => {
      const r = await calcularRepasse(
        {
          ...usinaBase,
          formaPagamentoDono: 'PERCENTUAL',
          percentualGeracaoDono: 5,
        },
        geracaoBase,
        tarifaResolverPadrao,
      );
      // 10.000 * 0,80 * 5% = 400
      expect(r.valor).toBe(400);
      expect(r.fonteTarifa).toBe('tarifa_concessionaria');
    });

    it('retorna null com motivo quando nao ha tarifa de referencia', async () => {
      const r = await calcularRepasse(
        {
          ...usinaBase,
          formaPagamentoDono: 'PERCENTUAL',
          percentualGeracaoDono: 5,
        },
        geracaoBase,
        tarifaResolverAusente,
      );
      expect(r.valor).toBeNull();
      expect(r.fonteTarifa).toBe('ausente');
      expect(r.motivo).toMatch(/Tarifa.+nao encontrada/);
    });

    it('retorna null quando geracao = 0', async () => {
      const r = await calcularRepasse(
        {
          ...usinaBase,
          formaPagamentoDono: 'PERCENTUAL',
          percentualGeracaoDono: 10,
          valorKwhPadrao: 1.0,
        },
        { kwhGerado: 0, competencia: new Date() },
        tarifaResolverPadrao,
      );
      expect(r.valor).toBeNull();
      expect(r.motivo).toMatch(/Geracao mensal nao registrada/);
    });

    it('retorna null quando geracao=null', async () => {
      const r = await calcularRepasse(
        {
          ...usinaBase,
          formaPagamentoDono: 'PERCENTUAL',
          percentualGeracaoDono: 10,
          valorKwhPadrao: 1.0,
        },
        null,
        tarifaResolverPadrao,
      );
      expect(r.valor).toBeNull();
    });

    it('retorna null com motivo quando percentual ausente', async () => {
      const r = await calcularRepasse(
        {
          ...usinaBase,
          formaPagamentoDono: 'PERCENTUAL',
          valorKwhPadrao: 1.0,
        },
        geracaoBase,
        tarifaResolverPadrao,
      );
      expect(r.valor).toBeNull();
      expect(r.motivo).toMatch(/percentualGeracaoDono obrigatorio/);
    });
  });

  describe('HIBRIDO', () => {
    it('soma valorFixo + (kwh * tarifaKwh * pct/100) com override usina', async () => {
      const r = await calcularRepasse(
        {
          ...usinaBase,
          formaPagamentoDono: 'HIBRIDO',
          valorAluguelFixo: 500,
          percentualGeracaoDono: 5,
          valorKwhPadrao: 1.0,
        },
        geracaoBase,
        tarifaResolverPadrao,
      );
      // 500 + (10.000 * 1,0 * 5%) = 500 + 500 = 1000
      expect(r.valor).toBe(1000);
      expect(r.formula).toMatch(/HIBRIDO/);
      expect(r.detalhes?.valorFixo).toBe(500);
    });

    it('soma valorFixo + componente PERCENTUAL com fallback distribuidora', async () => {
      const r = await calcularRepasse(
        {
          ...usinaBase,
          formaPagamentoDono: 'HIBRIDO',
          valorAluguelFixo: 200,
          percentualGeracaoDono: 10,
          // valorKwhPadrao null — usa fallback 0,80
        },
        geracaoBase,
        tarifaResolverPadrao,
      );
      // 200 + (10.000 * 0,80 * 10%) = 200 + 800 = 1000
      expect(r.valor).toBe(1000);
      expect(r.fonteTarifa).toBe('tarifa_concessionaria');
    });

    it('HIBRIDO sem valorAluguelFixo retorna null', async () => {
      const r = await calcularRepasse(
        {
          ...usinaBase,
          formaPagamentoDono: 'HIBRIDO',
          percentualGeracaoDono: 5,
          valorKwhPadrao: 1.0,
        },
        geracaoBase,
        tarifaResolverPadrao,
      );
      expect(r.valor).toBeNull();
      expect(r.motivo).toMatch(/HIBRIDO exige valorAluguelFixo/);
    });

    it('HIBRIDO sem tarifa retorna null', async () => {
      const r = await calcularRepasse(
        {
          ...usinaBase,
          formaPagamentoDono: 'HIBRIDO',
          valorAluguelFixo: 500,
          percentualGeracaoDono: 5,
        },
        geracaoBase,
        tarifaResolverAusente,
      );
      expect(r.valor).toBeNull();
    });
  });

  describe('arredondamento financeiro', () => {
    it('valores float arredondam pra 2 casas (regra CLAUDE.md)', async () => {
      const r = await calcularRepasse(
        {
          ...usinaBase,
          formaPagamentoDono: 'PERCENTUAL',
          percentualGeracaoDono: 7.33,
          valorKwhPadrao: 1.13,
        },
        { kwhGerado: 9_876, competencia: new Date() },
        tarifaResolverPadrao,
      );
      // 9.876 * 1,13 * 7.33% ≈ 817.95... -> arredondado
      expect(r.valor).not.toBeNull();
      const str = String(r.valor);
      // No max 2 casas decimais
      const parts = str.split('.');
      if (parts.length > 1) {
        expect(parts[1].length).toBeLessThanOrEqual(2);
      }
    });
  });
});
