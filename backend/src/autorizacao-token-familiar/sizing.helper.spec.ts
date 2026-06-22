/**
 * Sprint Convênio FAMÍLIA M49 (22/06/2026) — Fatia E (G4 sizing).
 *
 * Helper puro: cotaKwhMensal × tarifaKwh ÷ valorTokenReais → tokens.
 * Multi-tenant: ConfigCooperToken findUnique por cooperativaId.
 * Premissas explícitas no retorno pra auditoria do número.
 */
import { estimarTokensPorConsumo } from './sizing.helper';

function mkPrisma(opts: {
  configValorTokenReais?: number | null;
  tarifas?: Array<{
    concessionaria: string;
    tusdNova: number;
    teNova: number;
    dataVigencia: Date;
  }>;
}) {
  return {
    tarifaConcessionaria: {
      findMany: jest.fn().mockResolvedValue(opts.tarifas ?? []),
      findFirst: jest
        .fn()
        .mockResolvedValue(opts.tarifas?.[0] ?? null),
    },
    configCooperToken: {
      findUnique: jest.fn().mockResolvedValue(
        opts.configValorTokenReais !== undefined
          ? { valorTokenReais: opts.configValorTokenReais }
          : null,
      ),
    },
  } as any;
}

describe('M49 Fatia E — estimarTokensPorConsumo (G4 sizing display-only)', () => {
  it('cota 100kWh + tarifa específica + config tenant → cálculo correto', async () => {
    const prisma = mkPrisma({
      configValorTokenReais: 0.5,
      tarifas: [
        {
          concessionaria: 'EDP ES',
          tusdNova: 0.46863,
          teNova: 0.32068,
          dataVigencia: new Date('2026-02-01'),
        },
      ],
    });
    const r = await estimarTokensPorConsumo(prisma, {
      cooperativaId: 'tenant-A',
      cotaKwhMensal: 100,
      distribuidora: 'EDP ES',
    });
    // 100 × 0.78931 = 78.93; / 0.5 = 157.86 → floor 157
    expect(r.valorReais).toBeCloseTo(78.93, 2);
    expect(r.tokens).toBe(157);
    expect(r.premissas).toEqual({
      cotaKwhMensal: 100,
      tarifaKwh: 0.78931,
      tarifaFonte: 'tarifa_concessionaria',
      valorTokenReais: 0.5,
      valorTokenFonte: 'config_tenant',
    });
  });

  it('sem tarifa cadastrada → fallback 0.5 (premissa.tarifaFonte=fallback)', async () => {
    const prisma = mkPrisma({ tarifas: [], configValorTokenReais: 0.5 });
    const r = await estimarTokensPorConsumo(prisma, {
      cooperativaId: 'tenant-A',
      cotaKwhMensal: 200,
    });
    // 200 × 0.5 = 100; / 0.5 = 200
    expect(r.valorReais).toBe(100);
    expect(r.tokens).toBe(200);
    expect(r.premissas.tarifaFonte).toBe('fallback');
    expect(r.premissas.tarifaKwh).toBe(0.5);
  });

  it('sem ConfigCooperToken → fallback 0.45 (premissa.valorTokenFonte=fallback)', async () => {
    const prisma = mkPrisma({
      tarifas: [
        {
          concessionaria: 'EDP ES',
          tusdNova: 0.4,
          teNova: 0.3,
          dataVigencia: new Date('2026-01-01'),
        },
      ],
    });
    const r = await estimarTokensPorConsumo(prisma, {
      cooperativaId: 'tenant-A',
      cotaKwhMensal: 100,
      distribuidora: 'EDP ES',
    });
    // 100 × 0.7 = 70; / 0.45 = 155.55 → floor 155
    expect(r.valorReais).toBe(70);
    expect(r.tokens).toBe(155);
    expect(r.premissas.valorTokenReais).toBe(0.45);
    expect(r.premissas.valorTokenFonte).toBe('fallback');
  });

  it('cota 0 → tokens 0 + valorReais 0', async () => {
    const prisma = mkPrisma({ configValorTokenReais: 0.5 });
    const r = await estimarTokensPorConsumo(prisma, {
      cooperativaId: 'tenant-A',
      cotaKwhMensal: 0,
    });
    expect(r.tokens).toBe(0);
    expect(r.valorReais).toBe(0);
  });

  it('cooperativaId vazio → throw', async () => {
    const prisma = mkPrisma({});
    await expect(
      estimarTokensPorConsumo(prisma, {
        cooperativaId: '',
        cotaKwhMensal: 100,
      }),
    ).rejects.toThrow(/cooperativaId obrigatório/);
  });

  it('cotaKwhMensal negativa → throw', async () => {
    const prisma = mkPrisma({});
    await expect(
      estimarTokensPorConsumo(prisma, {
        cooperativaId: 'tenant-A',
        cotaKwhMensal: -1,
      }),
    ).rejects.toThrow(/cotaKwhMensal/);
  });

  it('multi-tenant: configCooperToken.findUnique usa cooperativaId do param', async () => {
    const prisma = mkPrisma({ configValorTokenReais: 0.5 });
    await estimarTokensPorConsumo(prisma, {
      cooperativaId: 'tenant-X',
      cotaKwhMensal: 50,
    });
    expect(prisma.configCooperToken.findUnique).toHaveBeenCalledWith({
      where: { cooperativaId: 'tenant-X' },
      select: { valorTokenReais: true },
    });
  });

  it('arredondamento monetário 2 casas (regra global)', async () => {
    const prisma = mkPrisma({
      configValorTokenReais: 0.5,
      tarifas: [
        {
          concessionaria: 'X',
          tusdNova: 0.33333,
          teNova: 0.33333,
          dataVigencia: new Date(),
        },
      ],
    });
    const r = await estimarTokensPorConsumo(prisma, {
      cooperativaId: 'tenant-A',
      cotaKwhMensal: 100,
      distribuidora: 'X',
    });
    // 100 × 0.66666 = 66.666; arred = 66.67
    expect(r.valorReais).toBe(66.67);
  });
});
