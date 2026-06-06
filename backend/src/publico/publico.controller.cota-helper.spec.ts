/**
 * Sprint Onboarding Bloco 1 Fatia 1.2 (06/06/2026) — specs do helper
 * derivarCotaKwhMensal.
 *
 * Regra: consumoMedioKwh ?? média(historicoConsumo). Arredondado 2 casas.
 * 0 quando ambas fontes vazias/inválidas (caller decide se grava).
 */
import { derivarCotaKwhMensal } from './publico.controller';

describe('derivarCotaKwhMensal — Fatia 1.2 helper', () => {
  it('consumoMedioKwh direto preenchido → usa ele (prioridade)', () => {
    expect(
      derivarCotaKwhMensal({
        consumoMedioKwh: 350,
        historicoConsumo: [{ consumoKwh: 9999 }],
      }),
    ).toBe(350);
  });

  it('consumoMedioKwh direto > 0 com decimais → arredonda 2 casas', () => {
    expect(derivarCotaKwhMensal({ consumoMedioKwh: 350.456 })).toBe(350.46);
    expect(derivarCotaKwhMensal({ consumoMedioKwh: 350.123 })).toBe(350.12);
  });

  it('consumoMedioKwh ausente → média do histórico', () => {
    const r = derivarCotaKwhMensal({
      historicoConsumo: [
        { consumoKwh: 300 },
        { consumoKwh: 400 },
        { consumoKwh: 500 },
      ],
    });
    expect(r).toBe(400);
  });

  it('consumoMedioKwh = 0 → cai pra média do histórico (zero não conta como preenchido)', () => {
    const r = derivarCotaKwhMensal({
      consumoMedioKwh: 0,
      historicoConsumo: [{ consumoKwh: 100 }, { consumoKwh: 200 }],
    });
    expect(r).toBe(150);
  });

  it('média de 12 meses → arredonda 2 casas', () => {
    const historicoConsumo = Array.from({ length: 12 }, (_, i) => ({
      consumoKwh: 350 + i, // soma = 4266 / 12 = 355.5
    }));
    expect(derivarCotaKwhMensal({ historicoConsumo })).toBe(355.5);
  });

  it('ambos vazios → 0 (caller decide se grava)', () => {
    expect(derivarCotaKwhMensal({})).toBe(0);
    expect(
      derivarCotaKwhMensal({ consumoMedioKwh: 0, historicoConsumo: [] }),
    ).toBe(0);
  });

  it('consumoMedioKwh null + histórico null → 0', () => {
    expect(
      derivarCotaKwhMensal({ consumoMedioKwh: null, historicoConsumo: null }),
    ).toBe(0);
  });

  it('consumoMedioKwh NaN/Infinity → cai pra histórico', () => {
    expect(
      derivarCotaKwhMensal({
        consumoMedioKwh: Number.NaN,
        historicoConsumo: [{ consumoKwh: 250 }],
      }),
    ).toBe(250);
  });

  it('histórico só com zeros → 0 (não engana com soma zero)', () => {
    expect(
      derivarCotaKwhMensal({
        historicoConsumo: [{ consumoKwh: 0 }, { consumoKwh: 0 }],
      }),
    ).toBe(0);
  });

  it('histórico com consumoKwh ausente em alguns itens → considera 0 nesses', () => {
    const r = derivarCotaKwhMensal({
      historicoConsumo: [
        { consumoKwh: 300 },
        { consumoKwh: undefined as any },
        { consumoKwh: 600 },
      ],
    });
    expect(r).toBe(300); // (300 + 0 + 600) / 3
  });

  it('caso real fatura EDP Luciano (12 meses do E2E Sprint 11)', () => {
    // Histórico real da fatura 0.001.421.380.054-70:
    const historicoConsumo = [
      { consumoKwh: 1139 }, // 02/2026
      { consumoKwh: 949 },
      { consumoKwh: 1010 },
      { consumoKwh: 724 },
      { consumoKwh: 678 },
      { consumoKwh: 603 },
      { consumoKwh: 570 },
      { consumoKwh: 541 },
      { consumoKwh: 570 },
      { consumoKwh: 666 },
      { consumoKwh: 1011 },
      { consumoKwh: 1123 }, // 03/2025
    ];
    // Sem consumoMedioKwh direto:
    const r = derivarCotaKwhMensal({ historicoConsumo });
    // soma = 9584; média = 798.67
    expect(r).toBe(798.67);
  });
});
