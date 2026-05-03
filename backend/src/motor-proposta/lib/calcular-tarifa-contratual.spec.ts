import { calcularTarifaContratual, arredondar5 } from './calcular-tarifa-contratual';
import { NotImplementedException, BadRequestException } from '@nestjs/common';

/**
 * Cenários numéricos canônicos da Fase B (Decisão B33, 03/05/2026).
 * Tabela de referência:
 *
 *   valorCheioKwh = R$ 1,02
 *   tarifaSemImpostos = R$ 0,78
 *   descontoBase = 15%
 *   kwhCompensado / kwhContratoMensal = 500 kWh
 *
 *   ┌───────────────────────────┬─────────────┬────────────────┬──────────────┐
 *   │           Modelo          │ baseCalculo │ Tarifa contrat │ Cobrança 500 │
 *   ├───────────────────────────┼─────────────┼────────────────┼──────────────┤
 *   │ FIXO_MENSAL               │ KWH_CHEIO   │ 0,867          │ 433,50       │
 *   │ FIXO_MENSAL               │ SEM_TRIBUTO │ 0,903          │ 451,50       │
 *   │ CREDITOS_COMPENSADOS      │ KWH_CHEIO   │ 0,867          │ 433,50       │
 *   │ CREDITOS_COMPENSADOS      │ SEM_TRIBUTO │ 0,903          │ 451,50       │
 *   │ CREDITOS_DINAMICO         │ KWH_CHEIO   │ 0,867          │ 433,50       │
 *   │ CREDITOS_DINAMICO         │ SEM_TRIBUTO │ 0,903          │ 451,50       │
 *   └───────────────────────────┴─────────────┴────────────────┴──────────────┘
 */
describe('calcularTarifaContratual — Fase B (Decisão B33)', () => {
  const cenarioBase = {
    valorCheioKwh: 1.02,
    tarifaSemImpostos: 0.78,
    descontoPercentual: 15,
  };

  describe('6 cenários numéricos canônicos', () => {
    it('FIXO + KWH_CHEIO + 15% → 0,867 R$/kWh × 500 kWh = R$ 433,50', () => {
      const tarifa = calcularTarifaContratual({
        ...cenarioBase,
        baseCalculo: 'KWH_CHEIO',
      });
      expect(tarifa).toBe(0.867);
      const cobranca = arredondar5(tarifa * 500);
      expect(cobranca).toBe(433.5);
    });

    it('FIXO + SEM_TRIBUTO + 15% → 0,903 R$/kWh × 500 kWh = R$ 451,50', () => {
      const tarifa = calcularTarifaContratual({
        ...cenarioBase,
        baseCalculo: 'SEM_TRIBUTO',
      });
      expect(tarifa).toBe(0.903);
      const cobranca = arredondar5(tarifa * 500);
      expect(cobranca).toBe(451.5);
    });

    it('COMPENSADOS + KWH_CHEIO + 15% → 0,867 (mesma fórmula do FIXO no aceite)', () => {
      const tarifa = calcularTarifaContratual({
        ...cenarioBase,
        baseCalculo: 'KWH_CHEIO',
      });
      expect(tarifa).toBe(0.867);
      // COMPENSADOS: cobrança mês = kwhCompensado × tarifaContratual (snapshot fixo).
      // Cooperado compensa 500 kWh → paga R$ 433,50.
      const cobranca500 = arredondar5(tarifa * 500);
      expect(cobranca500).toBe(433.5);
    });

    it('COMPENSADOS + SEM_TRIBUTO + 15% → 0,903', () => {
      const tarifa = calcularTarifaContratual({
        ...cenarioBase,
        baseCalculo: 'SEM_TRIBUTO',
      });
      expect(tarifa).toBe(0.903);
      const cobranca500 = arredondar5(tarifa * 500);
      expect(cobranca500).toBe(451.5);
    });

    it('DINAMICO + KWH_CHEIO + 15% → 0,867 (recalculado mensalmente com fatura do mês)', () => {
      // DINAMICO usa a mesma fórmula do helper, mas inputs vêm da fatura
      // do mês corrente (não snapshot do aceite).
      const tarifa = calcularTarifaContratual({
        ...cenarioBase,
        baseCalculo: 'KWH_CHEIO',
      });
      expect(tarifa).toBe(0.867);
      const cobranca500 = arredondar5(tarifa * 500);
      expect(cobranca500).toBe(433.5);
    });

    it('DINAMICO + SEM_TRIBUTO + 15% → 0,903', () => {
      const tarifa = calcularTarifaContratual({
        ...cenarioBase,
        baseCalculo: 'SEM_TRIBUTO',
      });
      expect(tarifa).toBe(0.903);
      const cobranca500 = arredondar5(tarifa * 500);
      expect(cobranca500).toBe(451.5);
    });
  });

  describe('Variação tarifária mensal (DINAMICO)', () => {
    it('mês 1 com fatura R$ 1,02/kWh → 0,867; mês 2 com fatura R$ 1,10/kWh → 0,935', () => {
      const mes1 = calcularTarifaContratual({
        valorCheioKwh: 1.02,
        tarifaSemImpostos: 0.78,
        baseCalculo: 'KWH_CHEIO',
        descontoPercentual: 15,
      });
      const mes2 = calcularTarifaContratual({
        valorCheioKwh: 1.10,
        tarifaSemImpostos: 0.85,
        baseCalculo: 'KWH_CHEIO',
        descontoPercentual: 15,
      });
      expect(mes1).toBe(0.867);
      expect(mes2).toBe(0.935);
    });
  });

  describe('Validações de input', () => {
    it('valorCheioKwh zero ou negativo → BadRequestException', () => {
      expect(() => calcularTarifaContratual({
        valorCheioKwh: 0, tarifaSemImpostos: 0.78, baseCalculo: 'KWH_CHEIO', descontoPercentual: 15,
      })).toThrow(BadRequestException);
      expect(() => calcularTarifaContratual({
        valorCheioKwh: -1, tarifaSemImpostos: 0.78, baseCalculo: 'KWH_CHEIO', descontoPercentual: 15,
      })).toThrow(BadRequestException);
    });

    it('descontoPercentual fora do range 0-100 → BadRequestException', () => {
      expect(() => calcularTarifaContratual({
        valorCheioKwh: 1.02, tarifaSemImpostos: 0.78, baseCalculo: 'KWH_CHEIO', descontoPercentual: -5,
      })).toThrow(BadRequestException);
      expect(() => calcularTarifaContratual({
        valorCheioKwh: 1.02, tarifaSemImpostos: 0.78, baseCalculo: 'KWH_CHEIO', descontoPercentual: 150,
      })).toThrow(BadRequestException);
    });

    it('SEM_TRIBUTO com tarifaSemImpostos zero → BadRequestException', () => {
      expect(() => calcularTarifaContratual({
        valorCheioKwh: 1.02, tarifaSemImpostos: 0, baseCalculo: 'SEM_TRIBUTO', descontoPercentual: 15,
      })).toThrow(BadRequestException);
    });

    it('baseCalculo=COM_ICMS → NotImplementedException', () => {
      expect(() => calcularTarifaContratual({
        valorCheioKwh: 1.02, tarifaSemImpostos: 0.78, baseCalculo: 'COM_ICMS', descontoPercentual: 15,
      })).toThrow(NotImplementedException);
    });

    it('baseCalculo=CUSTOM → NotImplementedException', () => {
      expect(() => calcularTarifaContratual({
        valorCheioKwh: 1.02, tarifaSemImpostos: 0.78, baseCalculo: 'CUSTOM', descontoPercentual: 15,
      })).toThrow(NotImplementedException);
    });

    it('baseCalculo desconhecido → BadRequestException', () => {
      expect(() => calcularTarifaContratual({
        valorCheioKwh: 1.02, tarifaSemImpostos: 0.78, baseCalculo: 'XYZ' as any, descontoPercentual: 15,
      })).toThrow(BadRequestException);
    });
  });

  describe('Caso especial: 0% desconto (sanity)', () => {
    it('desconto 0 + KWH_CHEIO retorna o próprio valorCheioKwh', () => {
      const t = calcularTarifaContratual({
        valorCheioKwh: 1.02, tarifaSemImpostos: 0.78, baseCalculo: 'KWH_CHEIO', descontoPercentual: 0,
      });
      expect(t).toBe(1.02);
    });

    it('desconto 0 + SEM_TRIBUTO retorna o próprio valorCheioKwh', () => {
      const t = calcularTarifaContratual({
        valorCheioKwh: 1.02, tarifaSemImpostos: 0.78, baseCalculo: 'SEM_TRIBUTO', descontoPercentual: 0,
      });
      expect(t).toBe(1.02);
    });
  });
});
