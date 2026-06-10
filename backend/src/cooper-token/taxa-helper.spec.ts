/**
 * Sprint Clube P1 — Fase 1.5 Bloco 2 (10/06/2026).
 *
 * Specs do helper puro `calcularTaxa`. Garante:
 *  - Fallback preserva comportamento antigo (2% emissao, 1% QR) quando
 *    config eh null/undefined OU campo especifico vem null/undefined.
 *  - Custom config aplica corretamente percentual + fixa.
 *  - Math.round(x*10000)/10000 sem ruido float.
 *  - Clamp defensivo (taxa nunca > bruto; bruto<=0 retorna 0).
 *  - Aceita Prisma Decimal (objeto com toNumber) e number cru.
 */
import { calcularTaxa } from './taxa-helper';

describe('calcularTaxa — Fase 1.5 helper puro', () => {
  describe('Fallback (config null/undefined)', () => {
    it('emissao com config null → 2% (preserva TAXA_EMISSAO antigo)', () => {
      const r = calcularTaxa('emissao', 100, null);
      expect(r.taxa).toBe(2);
      expect(r.liquido).toBe(98);
      expect(r.perc).toBe(2);
      expect(r.fixa).toBe(0);
    });

    it('qr com config null → 1% (preserva TAXA_QR antigo)', () => {
      const r = calcularTaxa('qr', 100, null);
      expect(r.taxa).toBe(1);
      expect(r.liquido).toBe(99);
    });

    it('transferencia com config null → 0%', () => {
      const r = calcularTaxa('transferencia', 100, null);
      expect(r.taxa).toBe(0);
      expect(r.liquido).toBe(100);
    });

    it('resgate com config null → 0%', () => {
      const r = calcularTaxa('resgate', 100, null);
      expect(r.taxa).toBe(0);
      expect(r.liquido).toBe(100);
    });

    it('emissao com config undefined → 2%', () => {
      const r = calcularTaxa('emissao', 100, undefined);
      expect(r.taxa).toBe(2);
    });

    it('emissao com config = objeto sem campos → 2% (campo null cai no default)', () => {
      const r = calcularTaxa('emissao', 100, {});
      expect(r.taxa).toBe(2);
    });

    it('emissao com taxaEmissaoPerc=null explicito → 2%', () => {
      const r = calcularTaxa('emissao', 100, { taxaEmissaoPerc: null });
      expect(r.taxa).toBe(2);
    });
  });

  describe('Config custom — percentual', () => {
    it('emissao 3% sem fixa', () => {
      const r = calcularTaxa('emissao', 100, { taxaEmissaoPerc: 3 });
      expect(r.taxa).toBe(3);
      expect(r.liquido).toBe(97);
      expect(r.perc).toBe(3);
    });

    it('qr 0.5% sem fixa', () => {
      const r = calcularTaxa('qr', 200, { taxaQrPerc: 0.5 });
      expect(r.taxa).toBe(1);
      expect(r.liquido).toBe(199);
    });

    it('transferencia 2% sem fixa', () => {
      const r = calcularTaxa('transferencia', 100, { taxaTransferenciaPerc: 2 });
      expect(r.taxa).toBe(2);
      expect(r.liquido).toBe(98);
    });

    it('resgate 5% sem fixa', () => {
      const r = calcularTaxa('resgate', 1000, { taxaResgatePerc: 5 });
      expect(r.taxa).toBe(50);
      expect(r.liquido).toBe(950);
    });
  });

  describe('Config custom — fixa', () => {
    it('emissao 0% + 0.5 fixa', () => {
      const r = calcularTaxa('emissao', 100, {
        taxaEmissaoPerc: 0,
        taxaEmissaoFixa: 0.5,
      });
      expect(r.taxa).toBe(0.5);
      expect(r.liquido).toBe(99.5);
    });

    it('qr 1% + 0.01 fixa', () => {
      const r = calcularTaxa('qr', 100, { taxaQrPerc: 1, taxaQrFixa: 0.01 });
      expect(r.taxa).toBe(1.01);
      expect(r.liquido).toBe(98.99);
      expect(r.perc).toBe(1);
      expect(r.fixa).toBe(0.01);
    });

    it('resgate 0% + 1 token fixa', () => {
      const r = calcularTaxa('resgate', 100, {
        taxaResgatePerc: 0,
        taxaResgateFixa: 1,
      });
      expect(r.taxa).toBe(1);
      expect(r.liquido).toBe(99);
    });
  });

  describe('Math.round sem ruido float', () => {
    it('bruto 33 + 1% → taxa 0.33 + liquido 32.67 (sem 0.330000007)', () => {
      const r = calcularTaxa('qr', 33, null);
      expect(r.taxa).toBe(0.33);
      expect(r.liquido).toBe(32.67);
    });

    it('bruto 0.1 + 1% → taxa 0.001 + liquido 0.099', () => {
      const r = calcularTaxa('qr', 0.1, null);
      expect(r.taxa).toBe(0.001);
      expect(r.liquido).toBe(0.099);
    });

    it('combinacao perc + fixa preserva 4 casas decimais', () => {
      const r = calcularTaxa('emissao', 7, {
        taxaEmissaoPerc: 1.5,
        taxaEmissaoFixa: 0.123,
      });
      // 7 * 1.5 / 100 = 0.105; + 0.123 = 0.228
      expect(r.taxa).toBe(0.228);
      expect(r.liquido).toBe(6.772);
    });
  });

  describe('Edge cases / clamps defensivos', () => {
    it('bruto 0 → taxa 0 + liquido 0 (nao aplica %)', () => {
      const r = calcularTaxa('emissao', 0, null);
      expect(r.taxa).toBe(0);
      expect(r.liquido).toBe(0);
    });

    it('bruto negativo → taxa 0 + liquido 0', () => {
      const r = calcularTaxa('emissao', -10, null);
      expect(r.taxa).toBe(0);
      expect(r.liquido).toBe(0);
    });

    it('taxa fixa > bruto → clamp em bruto (liquido 0, nao negativo)', () => {
      const r = calcularTaxa('emissao', 1, {
        taxaEmissaoPerc: 0,
        taxaEmissaoFixa: 100,
      });
      expect(r.taxa).toBe(1);
      expect(r.liquido).toBe(0);
    });

    it('config com perc/fixa NaN → cai no default da operacao', () => {
      const r = calcularTaxa('emissao', 100, {
        taxaEmissaoPerc: 'abc' as any,
        taxaEmissaoFixa: undefined,
      });
      expect(r.taxa).toBe(2);
    });
  });

  describe('Aceita Prisma Decimal (objeto com toNumber)', () => {
    it('config com Decimal-like → le como number', () => {
      const r = calcularTaxa('emissao', 100, {
        taxaEmissaoPerc: { toNumber: () => 3 } as any,
        taxaEmissaoFixa: { toNumber: () => 0 } as any,
      });
      expect(r.taxa).toBe(3);
      expect(r.liquido).toBe(97);
    });
  });

  describe('Isolamento entre operacoes', () => {
    it('config customizada para emissao NAO afeta QR (continua 1%)', () => {
      const config = { taxaEmissaoPerc: 5, taxaEmissaoFixa: 0.5 };
      const emissao = calcularTaxa('emissao', 100, config);
      const qr = calcularTaxa('qr', 100, config);
      expect(emissao.taxa).toBe(5.5);
      expect(qr.taxa).toBe(1);
    });

    it('config customizada para resgate NAO afeta transferencia', () => {
      const config = { taxaResgatePerc: 10, taxaTransferenciaPerc: 2 };
      const resgate = calcularTaxa('resgate', 100, config);
      const transf = calcularTaxa('transferencia', 100, config);
      expect(resgate.taxa).toBe(10);
      expect(transf.taxa).toBe(2);
    });
  });
});
