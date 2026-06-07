/**
 * Specs do helper puro `ratearProporcionalCusteio` — Fatia 2.2.
 *
 * Cobertura conforme alinhamento Luciano:
 *  - distribuição normal (proporcional)
 *  - todos sem cota → fallback IGUALITARIO
 *  - 1 membro só
 *  - soma das parcelas = total (INVARIANTE crítica: zero perda de centavo)
 *  - paridade com condominios.calcularRateio (fórmula consumo/total)
 *  - edge cases: 0 entradas, peso negativo/NaN/Infinity, total 0
 */
import {
  ratearProporcionalCusteio,
  RateioEntrada,
} from './ratear-proporcional-custeio';

describe('ratearProporcionalCusteio — Fatia 2.2', () => {
  // ─── Distribuição normal ─────────────────────────────────────────────
  it('distribuição normal: 1000 entre 600/300/100 → 600/300/100 (proporção exata)', () => {
    const r = ratearProporcionalCusteio(1000, [
      { id: 'a', peso: 600 },
      { id: 'b', peso: 300 },
      { id: 'c', peso: 100 },
    ]);
    expect(r.modo).toBe('PROPORCIONAL');
    expect(r.saidas).toEqual([
      { id: 'a', valor: 600 },
      { id: 'b', valor: 300 },
      { id: 'c', valor: 100 },
    ]);
  });

  it('distribuição normal: 500 entre 100/200/200 → 100/200/200', () => {
    const r = ratearProporcionalCusteio(500, [
      { id: 'a', peso: 100 },
      { id: 'b', peso: 200 },
      { id: 'c', peso: 200 },
    ]);
    expect(r.saidas.map((s) => s.valor)).toEqual([100, 200, 200]);
  });

  // ─── Fallback IGUALITARIO ────────────────────────────────────────────
  it('todos sem cota (peso=0) → IGUALITARIO_FALLBACK', () => {
    const r = ratearProporcionalCusteio(900, [
      { id: 'a', peso: 0 },
      { id: 'b', peso: 0 },
      { id: 'c', peso: 0 },
    ]);
    expect(r.modo).toBe('IGUALITARIO_FALLBACK');
    expect(r.saidas.map((s) => s.valor)).toEqual([300, 300, 300]);
  });

  it('todos sem cota (peso=null/undefined coerção) → IGUALITARIO_FALLBACK', () => {
    const r = ratearProporcionalCusteio(600, [
      { id: 'a', peso: NaN },
      { id: 'b', peso: 0 },
      { id: 'c', peso: -100 }, // negativo conta como 0
    ]);
    expect(r.modo).toBe('IGUALITARIO_FALLBACK');
    expect(r.saidas.map((s) => s.valor)).toEqual([200, 200, 200]);
  });

  // ─── 1 membro só ─────────────────────────────────────────────────────
  it('1 membro só com cota → recebe o total inteiro', () => {
    const r = ratearProporcionalCusteio(500, [{ id: 'a', peso: 350 }]);
    expect(r.saidas).toEqual([{ id: 'a', valor: 500 }]);
    expect(r.modo).toBe('PROPORCIONAL');
  });

  it('1 membro sem cota → recebe o total inteiro (fallback IGUALITARIO)', () => {
    const r = ratearProporcionalCusteio(500, [{ id: 'a', peso: 0 }]);
    expect(r.saidas).toEqual([{ id: 'a', valor: 500 }]);
    expect(r.modo).toBe('IGUALITARIO_FALLBACK');
  });

  // ─── INVARIANTE: soma = total (fechamento de centavo) ────────────────
  describe('INVARIANTE: soma das parcelas = total (zero perda de centavo)', () => {
    it('100 / 3 (33.33+33.33+33.34=100): último item absorve diferença', () => {
      const r = ratearProporcionalCusteio(100, [
        { id: 'a', peso: 1 },
        { id: 'b', peso: 1 },
        { id: 'c', peso: 1 },
      ]);
      const soma = r.saidas.reduce((acc, s) => acc + s.valor, 0);
      expect(Math.round(soma * 100) / 100).toBe(100);
      // Os 2 primeiros pegam 33.33, último absorve o resíduo
      expect(r.saidas[0]!.valor).toBe(33.33);
      expect(r.saidas[1]!.valor).toBe(33.33);
      expect(r.saidas[2]!.valor).toBe(33.34);
    });

    it('IGUALITARIO 100 / 3 também fecha exatamente em 100', () => {
      const r = ratearProporcionalCusteio(100, [
        { id: 'a', peso: 0 },
        { id: 'b', peso: 0 },
        { id: 'c', peso: 0 },
      ]);
      const soma = r.saidas.reduce((acc, s) => acc + s.valor, 0);
      expect(Math.round(soma * 100) / 100).toBe(100);
    });

    it('caso difícil: 999.99 entre 7 pesos diversos → soma exatamente 999.99', () => {
      const r = ratearProporcionalCusteio(999.99, [
        { id: 'a', peso: 142 },
        { id: 'b', peso: 187 },
        { id: 'c', peso: 96 },
        { id: 'd', peso: 314 },
        { id: 'e', peso: 53 },
        { id: 'f', peso: 211 },
        { id: 'g', peso: 78 },
      ]);
      const soma = r.saidas.reduce((acc, s) => acc + s.valor, 0);
      expect(Math.round(soma * 100) / 100).toBe(999.99);
    });

    it('caso difícil 2: R$ 13.456,78 entre 5 funcionários com cotas 1/3/5/7/11', () => {
      const r = ratearProporcionalCusteio(13456.78, [
        { id: 'a', peso: 1 },
        { id: 'b', peso: 3 },
        { id: 'c', peso: 5 },
        { id: 'd', peso: 7 },
        { id: 'e', peso: 11 },
      ]);
      const soma = r.saidas.reduce((acc, s) => acc + s.valor, 0);
      expect(Math.round(soma * 100) / 100).toBe(13456.78);
    });

    it('total grande (200000 kWh × 53 membros mistos) → soma fecha', () => {
      const entradas: RateioEntrada[] = Array.from({ length: 53 }, (_, i) => ({
        id: `m${i}`,
        peso: 100 + i * 7,
      }));
      const r = ratearProporcionalCusteio(200000, entradas);
      const soma = r.saidas.reduce((acc, s) => acc + s.valor, 0);
      expect(Math.round(soma * 100) / 100).toBe(200000);
    });

    it('total 0 → todas as parcelas 0 + soma 0', () => {
      const r = ratearProporcionalCusteio(0, [
        { id: 'a', peso: 100 },
        { id: 'b', peso: 200 },
      ]);
      expect(r.saidas.map((s) => s.valor)).toEqual([0, 0]);
    });
  });

  // ─── Paridade com condominios.calcularRateio ─────────────────────────
  it('paridade com condominios.calcularRateio PROPORCIONAL_CONSUMO (fórmula consumo/total)', () => {
    // Réplica do exemplo do service de condomínios:
    // unidades com cotaKwhMensal 100/200/300, total 600
    const r = ratearProporcionalCusteio(600, [
      { id: 'u1', peso: 100 },
      { id: 'u2', peso: 200 },
      { id: 'u3', peso: 300 },
    ]);
    expect(r.saidas).toEqual([
      { id: 'u1', valor: 100 },
      { id: 'u2', valor: 200 },
      { id: 'u3', valor: 300 },
    ]);
  });

  // ─── Edge cases ──────────────────────────────────────────────────────
  it('0 entradas → array vazio', () => {
    const r = ratearProporcionalCusteio(1000, []);
    expect(r.saidas).toEqual([]);
  });

  it('peso Infinity tratado como 0 (não rompe rateio)', () => {
    const r = ratearProporcionalCusteio(300, [
      { id: 'a', peso: 100 },
      { id: 'b', peso: Number.POSITIVE_INFINITY },
      { id: 'c', peso: 200 },
    ]);
    // b foi tratado como 0 → a+c=300 redistribuem
    expect(r.modo).toBe('PROPORCIONAL');
    expect(r.saidas.find((s) => s.id === 'b')!.valor).toBe(0);
    const soma = r.saidas.reduce((acc, s) => acc + s.valor, 0);
    expect(Math.round(soma * 100) / 100).toBe(300);
  });
});
