/**
 * M14.A — specs do AlocacaoEngineService (algoritmo greedy + validações integradas).
 *
 * Estratégia: mock Prisma + AlocacaoValidadorService. Cenários cobrem:
 *  - Sem realocações úteis (contratos já em usina compatível com política)
 *  - Realocação por política (cooperado em usina fora da classe GD preferida)
 *  - Validação bloqueia candidata (concentração, distribuidora, classe GD, estabilidade)
 *  - Capacidade da usina alvo já cheia (filtro defensivo)
 *  - Contrato sem usina (alocação inicial)
 */
import { AlocacaoEngineService } from './alocacao-engine.service';

type Any = any;

function buildPrismaMock(data: Any) {
  return {
    contrato: {
      findMany: jest.fn().mockResolvedValue(data.contratos ?? []),
    },
    usina: {
      findMany: jest.fn().mockResolvedValue(data.usinas ?? []),
    },
    politicaAlocacao: {
      findMany: jest.fn().mockResolvedValue(data.politicas ?? []),
    },
  };
}

function buildValidador(overrides?: {
  estabilidade?: boolean;
  distribuidora?: boolean;
  concentracao?: boolean;
  classeGd?: boolean;
}) {
  return {
    validarEstabilidade: jest.fn().mockResolvedValue({ valido: overrides?.estabilidade ?? true }),
    validarDistribuidora: jest.fn().mockResolvedValue({ valido: overrides?.distribuidora ?? true }),
    validarConcentracao25: jest.fn().mockResolvedValue({ valido: overrides?.concentracao ?? true }),
    validarClasseGd: jest.fn().mockResolvedValue({ valido: overrides?.classeGd ?? true }),
  };
}

function makeEngine(args: { prismaData?: Any; validadorOverrides?: Any } = {}) {
  const prisma = buildPrismaMock(args.prismaData ?? {});
  const validador = buildValidador(args.validadorOverrides);
  const engine = new AlocacaoEngineService(prisma as Any, validador as Any);
  return { engine, prisma, validador };
}

describe('AlocacaoEngineService.simular', () => {
  it('retorna snapshot vazio quando não há contratos', async () => {
    const { engine } = makeEngine();
    const r = await engine.simular('coop-1');
    expect(r.contratosAvaliados).toBe(0);
    expect(r.realocacoesSugeridas).toBe(0);
    expect(r.realocacoes).toEqual([]);
  });

  it('não sugere realocação quando contrato já está em usina compatível com política', async () => {
    const usinaCompativel = {
      id: 'u-1',
      nome: 'Usina A',
      capacidadeKwh: 100_000,
      classeGdAnotada: 'GD_II',
      distribuidora: 'EDP_ES',
      contratos: [{ kwhContrato: 100 }],
    };
    const { engine } = makeEngine({
      prismaData: {
        contratos: [
          {
            id: 'c-1',
            cooperadoId: 'coop-1',
            cooperado: { id: 'coop-1', nomeCompleto: 'Maria' },
            ucId: 'uc-1',
            uc: { id: 'uc-1', numero: 'UC-001' },
            kwhContrato: 100,
            usinaId: 'u-1',
            classeGdAplicada: 'GD_II',
            dataInicio: new Date('2025-01-01'),
          },
        ],
        usinas: [usinaCompativel],
        politicas: [
          {
            id: 'p-1',
            cooperativaId: 'coop-A',
            nome: 'Pequenos',
            faixaMin: 0,
            faixaMax: 500,
            classeGdPreferida: 'GD_II',
            usinasElegiveis: [],
            prioridade: 30,
            ativa: true,
          },
        ],
      },
    });
    const r = await engine.simular('coop-A');
    expect(r.contratosAvaliados).toBe(1);
    expect(r.realocacoesSugeridas).toBe(0);
  });

  it('sugere realocação quando contrato em usina fora da política (classe GD)', async () => {
    const { engine } = makeEngine({
      prismaData: {
        contratos: [
          {
            id: 'c-1',
            cooperadoId: 'coop-1',
            cooperado: { id: 'coop-1', nomeCompleto: 'João' },
            ucId: 'uc-1',
            uc: { id: 'uc-1', numero: 'UC-001' },
            kwhContrato: 200,
            usinaId: 'u-gdi', // está em GD_I
            classeGdAplicada: null,
            dataInicio: new Date('2025-01-01'),
          },
        ],
        usinas: [
          {
            id: 'u-gdi',
            nome: 'Usina GD_I',
            capacidadeKwh: 100_000,
            classeGdAnotada: 'GD_I',
            distribuidora: 'EDP_ES',
            contratos: [{ kwhContrato: 200 }],
          },
          {
            id: 'u-gdii',
            nome: 'Usina GD_II',
            capacidadeKwh: 100_000,
            classeGdAnotada: 'GD_II',
            distribuidora: 'EDP_ES',
            contratos: [],
          },
        ],
        politicas: [
          {
            id: 'p-1',
            cooperativaId: 'coop-A',
            nome: 'Pequenos',
            faixaMin: 0,
            faixaMax: 500,
            classeGdPreferida: 'GD_II',
            usinasElegiveis: [],
            prioridade: 30,
            ativa: true,
          },
        ],
      },
    });
    const r = await engine.simular('coop-A');
    expect(r.realocacoesSugeridas).toBe(1);
    expect(r.realocacoes[0]).toMatchObject({
      contratoId: 'c-1',
      usinaAtualId: 'u-gdi',
      usinaSugeridaId: 'u-gdii',
    });
    expect(r.economiaTotalProxy).toBeGreaterThan(0);
  });

  it('NÃO sugere realocação quando estabilidade <3 meses bloqueia', async () => {
    const dataRecente = new Date();
    dataRecente.setDate(dataRecente.getDate() - 30);
    const { engine } = makeEngine({
      prismaData: {
        contratos: [
          {
            id: 'c-1',
            cooperadoId: 'coop-1',
            cooperado: { id: 'coop-1', nomeCompleto: 'João' },
            ucId: 'uc-1',
            uc: { id: 'uc-1', numero: 'UC-001' },
            kwhContrato: 200,
            usinaId: 'u-gdi',
            classeGdAplicada: null,
            dataInicio: dataRecente,
          },
        ],
        usinas: [
          {
            id: 'u-gdi',
            nome: 'Usina GD_I',
            capacidadeKwh: 100_000,
            classeGdAnotada: 'GD_I',
            distribuidora: 'EDP_ES',
            contratos: [{ kwhContrato: 200 }],
          },
          {
            id: 'u-gdii',
            nome: 'Usina GD_II',
            capacidadeKwh: 100_000,
            classeGdAnotada: 'GD_II',
            distribuidora: 'EDP_ES',
            contratos: [],
          },
        ],
        politicas: [
          {
            id: 'p-1',
            cooperativaId: 'coop-A',
            nome: 'Pequenos',
            faixaMin: 0,
            faixaMax: 500,
            classeGdPreferida: 'GD_II',
            usinasElegiveis: [],
            prioridade: 30,
            ativa: true,
          },
        ],
      },
      validadorOverrides: { estabilidade: false },
    });
    const r = await engine.simular('coop-A');
    expect(r.realocacoesSugeridas).toBe(0);
  });

  it('NÃO sugere quando validador rejeita concentração 25%', async () => {
    const { engine } = makeEngine({
      prismaData: {
        contratos: [
          {
            id: 'c-1',
            cooperadoId: 'coop-1',
            cooperado: { id: 'coop-1', nomeCompleto: 'João' },
            ucId: 'uc-1',
            uc: { id: 'uc-1', numero: 'UC-001' },
            kwhContrato: 50_000,
            usinaId: 'u-gdi',
            classeGdAplicada: null,
            dataInicio: new Date('2025-01-01'),
          },
        ],
        usinas: [
          {
            id: 'u-gdi',
            nome: 'Usina GD_I',
            capacidadeKwh: 200_000,
            classeGdAnotada: 'GD_I',
            distribuidora: 'EDP_ES',
            contratos: [{ kwhContrato: 50_000 }],
          },
          {
            id: 'u-gdii',
            nome: 'Usina GD_II',
            capacidadeKwh: 100_000,
            classeGdAnotada: 'GD_II',
            distribuidora: 'EDP_ES',
            contratos: [],
          },
        ],
        politicas: [
          {
            id: 'p-1',
            cooperativaId: 'coop-A',
            nome: 'Médios',
            faixaMin: 500.01,
            faixaMax: 100_000,
            classeGdPreferida: 'GD_II',
            usinasElegiveis: [],
            prioridade: 20,
            ativa: true,
          },
        ],
      },
      validadorOverrides: { concentracao: false }, // bloqueia tudo
    });
    const r = await engine.simular('coop-A');
    expect(r.realocacoesSugeridas).toBe(0);
  });

  it('filtro de capacidade: ignora usina alvo que não cabe', async () => {
    const { engine } = makeEngine({
      prismaData: {
        contratos: [
          {
            id: 'c-1',
            cooperadoId: 'coop-1',
            cooperado: { id: 'coop-1', nomeCompleto: 'João' },
            ucId: 'uc-1',
            uc: { id: 'uc-1', numero: 'UC-001' },
            kwhContrato: 200,
            usinaId: 'u-gdi',
            classeGdAplicada: null,
            dataInicio: new Date('2025-01-01'),
          },
        ],
        usinas: [
          {
            id: 'u-gdi',
            nome: 'Usina GD_I',
            capacidadeKwh: 100_000,
            classeGdAnotada: 'GD_I',
            distribuidora: 'EDP_ES',
            contratos: [{ kwhContrato: 200 }],
          },
          {
            id: 'u-gdii-cheia',
            nome: 'Usina GD_II cheia',
            capacidadeKwh: 1_000,
            classeGdAnotada: 'GD_II',
            distribuidora: 'EDP_ES',
            contratos: [{ kwhContrato: 999 }],
          },
        ],
        politicas: [
          {
            id: 'p-1',
            cooperativaId: 'coop-A',
            nome: 'Pequenos',
            faixaMin: 0,
            faixaMax: 500,
            classeGdPreferida: 'GD_II',
            usinasElegiveis: [],
            prioridade: 30,
            ativa: true,
          },
        ],
      },
    });
    const r = await engine.simular('coop-A');
    expect(r.realocacoesSugeridas).toBe(0);
  });

  it('contrato sem usina vinculada: sugere alocação inicial', async () => {
    const { engine } = makeEngine({
      prismaData: {
        contratos: [
          {
            id: 'c-1',
            cooperadoId: 'coop-1',
            cooperado: { id: 'coop-1', nomeCompleto: 'Nova adesão' },
            ucId: 'uc-1',
            uc: { id: 'uc-1', numero: 'UC-001' },
            kwhContrato: 200,
            usinaId: null,
            classeGdAplicada: null,
            dataInicio: new Date('2025-01-01'),
          },
        ],
        usinas: [
          {
            id: 'u-gdii',
            nome: 'Usina GD_II',
            capacidadeKwh: 100_000,
            classeGdAnotada: 'GD_II',
            distribuidora: 'EDP_ES',
            contratos: [],
          },
        ],
        politicas: [
          {
            id: 'p-1',
            cooperativaId: 'coop-A',
            nome: 'Pequenos',
            faixaMin: 0,
            faixaMax: 500,
            classeGdPreferida: 'GD_II',
            usinasElegiveis: [],
            prioridade: 30,
            ativa: true,
          },
        ],
      },
    });
    const r = await engine.simular('coop-A');
    expect(r.realocacoesSugeridas).toBe(1);
    expect(r.realocacoes[0].usinaAtualId).toBeNull();
    expect(r.realocacoes[0].motivosMudanca[0]).toMatch(/sem usina vinculada/);
  });
});
