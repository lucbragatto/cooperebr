/**
 * Testes unitários — ConveniosProgressaoService
 *
 * Cobre:
 *   - calcularFaixa  (lógica pura, sem I/O)
 *   - recalcularFaixa (orquestração com Prisma mockado)
 *   - resolverDescontoConvenio (acúmulo, cap 100%, override individual)
 *
 * Convenções do projeto:
 *   - Lógica pura é extraída e testada diretamente.
 *   - Dependências de I/O são substituídas por jest.fn() mocks.
 *   - Nenhum módulo NestJS / TestingModule necessário.
 */

// ─── Extração da lógica pura de calcularFaixa ─────────────────────────────
// Replica fielmente o algoritmo de convenios-progressao.service.ts

interface Faixa {
  minMembros: number;
  maxMembros: number | null;
  descontoMembros: number;
  descontoConveniado: number;
}

interface FaixaResult {
  index: number;
  descontoMembros: number;
  descontoConveniado: number;
}

function calcularFaixa(faixas: Faixa[], membrosAtivos: number): FaixaResult {
  const sorted = [...faixas].sort((a, b) => a.minMembros - b.minMembros);

  let faixaEscolhida = sorted[0];
  let faixaIndex = 0;

  for (let i = 0; i < sorted.length; i++) {
    if (membrosAtivos >= sorted[i].minMembros) {
      faixaEscolhida = sorted[i];
      faixaIndex = i;
    }
  }

  if (membrosAtivos < sorted[0].minMembros) {
    return { index: 0, descontoMembros: 0, descontoConveniado: 0 };
  }

  return {
    index: faixaIndex,
    descontoMembros: faixaEscolhida.descontoMembros,
    descontoConveniado: faixaEscolhida.descontoConveniado,
  };
}

// ─── Extração da lógica pura de validarFaixas ─────────────────────────────

function validarFaixas(
  faixas: { minMembros: number; maxMembros: number | null; descontoMembros: number; descontoConveniado: number }[],
): void {
  if (faixas.length === 0) return;

  const sorted = [...faixas].sort((a, b) => a.minMembros - b.minMembros);

  for (let i = 0; i < sorted.length; i++) {
    const faixa = sorted[i];
    if (faixa.descontoMembros < 0 || faixa.descontoMembros > 100) {
      throw new Error(`Desconto de membros na faixa ${i + 1} deve estar entre 0 e 100`);
    }
    if (faixa.descontoConveniado < 0 || faixa.descontoConveniado > 100) {
      throw new Error(`Desconto do conveniado na faixa ${i + 1} deve estar entre 0 e 100`);
    }
    if (i > 0) {
      const anterior = sorted[i - 1];
      if (anterior.maxMembros != null && faixa.minMembros > anterior.maxMembros + 1) {
        throw new Error(`Gap entre faixas ${i} e ${i + 1}: ${anterior.maxMembros} → ${faixa.minMembros}`);
      }
    }
  }
}

// ─── Factory de mock para PrismaService ───────────────────────────────────

function makePrismaMock() {
  return {
    contratoConvenio: {
      findUnique: jest.fn(),
      update: jest.fn(),
      findMany: jest.fn(),
    },
    convenioCooperado: {
      count: jest.fn(),
      updateMany: jest.fn(),
      findFirst: jest.fn(),
    },
    historicoFaixaConvenio: {
      create: jest.fn(),
    },
  };
}

// ─── Fixtures ─────────────────────────────────────────────────────────────

const FAIXAS_PADRAO: Faixa[] = [
  { minMembros: 1,  maxMembros: 5,    descontoMembros: 5,  descontoConveniado: 2  },
  { minMembros: 6,  maxMembros: 10,   descontoMembros: 10, descontoConveniado: 5  },
  { minMembros: 11, maxMembros: null, descontoMembros: 15, descontoConveniado: 10 },
];

// ══════════════════════════════════════════════════════════════════════════════
// 1. calcularFaixa — lógica pura
// ══════════════════════════════════════════════════════════════════════════════

describe('calcularFaixa — lógica pura', () => {

  // ── faixas vazias ──────────────────────────────────────────────────────────

  describe('faixas vazias', () => {
    it('lança se sorted[0] é undefined quando faixas = [] (guarda o contrato do caller)', () => {
      // calcularFaixa não é chamada com [] pelo recalcularFaixa (ele guarda antes),
      // mas testamos o comportamento defensivo de sorted[0] ser undefined.
      // A função acessa sorted[0] sem checagem — expor esse caso para documentar.
      expect(() => calcularFaixa([], 5)).toThrow();
    });
  });

  // ── abaixo da primeira faixa ───────────────────────────────────────────────

  describe('membros abaixo da primeira faixa (minMembros = 1)', () => {
    it('0 membros retorna index 0 e descontos zerados', () => {
      const result = calcularFaixa(FAIXAS_PADRAO, 0);
      expect(result).toEqual({ index: 0, descontoMembros: 0, descontoConveniado: 0 });
    });

    it('negativo retorna index 0 e descontos zerados (defensivo)', () => {
      const result = calcularFaixa(FAIXAS_PADRAO, -1);
      expect(result).toEqual({ index: 0, descontoMembros: 0, descontoConveniado: 0 });
    });
  });

  // ── faixa com minMembros > 0 ───────────────────────────────────────────────

  describe('faixas onde minMembros começa em 5', () => {
    const FAIXAS_COM_GAP_INICIAL: Faixa[] = [
      { minMembros: 5,  maxMembros: 9,    descontoMembros: 8,  descontoConveniado: 3 },
      { minMembros: 10, maxMembros: null, descontoMembros: 15, descontoConveniado: 7 },
    ];

    it('1 membro (abaixo do mínimo 5) retorna descontos zerados', () => {
      const result = calcularFaixa(FAIXAS_COM_GAP_INICIAL, 1);
      expect(result).toEqual({ index: 0, descontoMembros: 0, descontoConveniado: 0 });
    });

    it('4 membros (abaixo do mínimo 5) retorna descontos zerados', () => {
      const result = calcularFaixa(FAIXAS_COM_GAP_INICIAL, 4);
      expect(result).toEqual({ index: 0, descontoMembros: 0, descontoConveniado: 0 });
    });
  });

  // ── faixa 1 (1–5 membros) ─────────────────────────────────────────────────

  describe('faixa 1 — 1 a 5 membros', () => {
    it('1 membro cai na faixa 1 (index 0)', () => {
      const result = calcularFaixa(FAIXAS_PADRAO, 1);
      expect(result).toEqual({ index: 0, descontoMembros: 5, descontoConveniado: 2 });
    });

    it('5 membros ainda cai na faixa 1', () => {
      const result = calcularFaixa(FAIXAS_PADRAO, 5);
      expect(result).toEqual({ index: 0, descontoMembros: 5, descontoConveniado: 2 });
    });
  });

  // ── faixa 2 (6–10 membros) ────────────────────────────────────────────────

  describe('faixa 2 — 6 a 10 membros', () => {
    it('6 membros avança para faixa 2 (index 1)', () => {
      const result = calcularFaixa(FAIXAS_PADRAO, 6);
      expect(result).toEqual({ index: 1, descontoMembros: 10, descontoConveniado: 5 });
    });

    it('10 membros ainda cai na faixa 2', () => {
      const result = calcularFaixa(FAIXAS_PADRAO, 10);
      expect(result).toEqual({ index: 1, descontoMembros: 10, descontoConveniado: 5 });
    });
  });

  // ── faixa 3 (11+ membros, sem teto) ──────────────────────────────────────

  describe('faixa 3 — 11+ membros (maxMembros = null)', () => {
    it('11 membros avança para faixa 3 (index 2)', () => {
      const result = calcularFaixa(FAIXAS_PADRAO, 11);
      expect(result).toEqual({ index: 2, descontoMembros: 15, descontoConveniado: 10 });
    });

    it('12 membros permanece na faixa 3', () => {
      const result = calcularFaixa(FAIXAS_PADRAO, 12);
      expect(result).toEqual({ index: 2, descontoMembros: 15, descontoConveniado: 10 });
    });

    it('100 membros permanece na faixa 3 (sem teto)', () => {
      const result = calcularFaixa(FAIXAS_PADRAO, 100);
      expect(result).toEqual({ index: 2, descontoMembros: 15, descontoConveniado: 10 });
    });
  });

  // ── faixa sobe corretamente ───────────────────────────────────────────────

  describe('progressão de faixa — sobe', () => {
    it('de 5 para 6 membros: faixa sobe de index 0 para index 1', () => {
      const antes = calcularFaixa(FAIXAS_PADRAO, 5);
      const depois = calcularFaixa(FAIXAS_PADRAO, 6);
      expect(antes.index).toBe(0);
      expect(depois.index).toBe(1);
      expect(depois.descontoMembros).toBeGreaterThan(antes.descontoMembros);
    });

    it('de 10 para 11 membros: faixa sobe de index 1 para index 2', () => {
      const antes = calcularFaixa(FAIXAS_PADRAO, 10);
      const depois = calcularFaixa(FAIXAS_PADRAO, 11);
      expect(antes.index).toBe(1);
      expect(depois.index).toBe(2);
      expect(depois.descontoMembros).toBeGreaterThan(antes.descontoMembros);
    });
  });

  // ── faixa desce corretamente ──────────────────────────────────────────────

  describe('regressão de faixa — desce', () => {
    it('de 11 para 10 membros: faixa desce de index 2 para index 1', () => {
      const antes = calcularFaixa(FAIXAS_PADRAO, 11);
      const depois = calcularFaixa(FAIXAS_PADRAO, 10);
      expect(antes.index).toBe(2);
      expect(depois.index).toBe(1);
      expect(depois.descontoMembros).toBeLessThan(antes.descontoMembros);
    });

    it('de 6 para 5 membros: faixa desce de index 1 para index 0', () => {
      const antes = calcularFaixa(FAIXAS_PADRAO, 6);
      const depois = calcularFaixa(FAIXAS_PADRAO, 5);
      expect(antes.index).toBe(1);
      expect(depois.index).toBe(0);
    });

    it('de 6 para 0 membros: perde faixa inteiramente (desconto zero)', () => {
      const depois = calcularFaixa(FAIXAS_PADRAO, 0);
      expect(depois).toEqual({ index: 0, descontoMembros: 0, descontoConveniado: 0 });
    });
  });

  // ── faixas fora de ordem no input ─────────────────────────────────────────

  describe('faixas fornecidas fora de ordem', () => {
    it('ordena antes de calcular e retorna resultado correto', () => {
      const faixasDesordenadas: Faixa[] = [
        { minMembros: 11, maxMembros: null, descontoMembros: 15, descontoConveniado: 10 },
        { minMembros: 1,  maxMembros: 5,   descontoMembros: 5,  descontoConveniado: 2  },
        { minMembros: 6,  maxMembros: 10,  descontoMembros: 10, descontoConveniado: 5  },
      ];
      expect(calcularFaixa(faixasDesordenadas, 8)).toEqual({ index: 1, descontoMembros: 10, descontoConveniado: 5 });
    });
  });

  // ── uma única faixa ───────────────────────────────────────────────────────

  describe('apenas uma faixa configurada', () => {
    const FAIXA_UNICA: Faixa[] = [
      { minMembros: 1, maxMembros: null, descontoMembros: 20, descontoConveniado: 8 },
    ];

    it('0 membros: desconto zero', () => {
      expect(calcularFaixa(FAIXA_UNICA, 0)).toEqual({ index: 0, descontoMembros: 0, descontoConveniado: 0 });
    });

    it('1 membro: entra na faixa única', () => {
      expect(calcularFaixa(FAIXA_UNICA, 1)).toEqual({ index: 0, descontoMembros: 20, descontoConveniado: 8 });
    });

    it('50 membros: permanece na faixa única', () => {
      expect(calcularFaixa(FAIXA_UNICA, 50)).toEqual({ index: 0, descontoMembros: 20, descontoConveniado: 8 });
    });
  });

  // ── valores extremos e de fronteira ──────────────────────────────────────

  describe('boundary values', () => {
    it('Number.MAX_SAFE_INTEGER membros cai na última faixa sem overflow', () => {
      const result = calcularFaixa(FAIXAS_PADRAO, Number.MAX_SAFE_INTEGER);
      expect(result.index).toBe(2);
    });

    it('faixa com desconto 0 é válida (isenção sem benefício)', () => {
      const faixaZero: Faixa[] = [
        { minMembros: 1, maxMembros: null, descontoMembros: 0, descontoConveniado: 0 },
      ];
      const result = calcularFaixa(faixaZero, 5);
      expect(result).toEqual({ index: 0, descontoMembros: 0, descontoConveniado: 0 });
    });

    it('faixa com desconto 100% é válida (desconto total)', () => {
      const faixaTotal: Faixa[] = [
        { minMembros: 1, maxMembros: null, descontoMembros: 100, descontoConveniado: 100 },
      ];
      const result = calcularFaixa(faixaTotal, 1);
      expect(result).toEqual({ index: 0, descontoMembros: 100, descontoConveniado: 100 });
    });
  });
});

// ══════════════════════════════════════════════════════════════════════════════
// 2. validarFaixas — lógica pura de ConveniosService
// ══════════════════════════════════════════════════════════════════════════════

describe('validarFaixas — lógica pura', () => {
  it('não lança para array vazio', () => {
    expect(() => validarFaixas([])).not.toThrow();
  });

  it('não lança para faixas válidas sem gap', () => {
    expect(() => validarFaixas([
      { minMembros: 1, maxMembros: 5,    descontoMembros: 5,  descontoConveniado: 2  },
      { minMembros: 6, maxMembros: null, descontoMembros: 10, descontoConveniado: 5  },
    ])).not.toThrow();
  });

  it('lança para descontoMembros negativo', () => {
    expect(() => validarFaixas([
      { minMembros: 1, maxMembros: null, descontoMembros: -1, descontoConveniado: 5 },
    ])).toThrow(/entre 0 e 100/);
  });

  it('lança para descontoMembros acima de 100', () => {
    expect(() => validarFaixas([
      { minMembros: 1, maxMembros: null, descontoMembros: 101, descontoConveniado: 5 },
    ])).toThrow(/entre 0 e 100/);
  });

  it('lança para descontoConveniado negativo', () => {
    expect(() => validarFaixas([
      { minMembros: 1, maxMembros: null, descontoMembros: 10, descontoConveniado: -5 },
    ])).toThrow(/entre 0 e 100/);
  });

  it('lança para descontoConveniado acima de 100', () => {
    expect(() => validarFaixas([
      { minMembros: 1, maxMembros: null, descontoMembros: 10, descontoConveniado: 150 },
    ])).toThrow(/entre 0 e 100/);
  });

  it('lança quando há gap entre faixas com maxMembros definido', () => {
    expect(() => validarFaixas([
      { minMembros: 1,  maxMembros: 5,   descontoMembros: 5,  descontoConveniado: 2 },
      { minMembros: 10, maxMembros: null, descontoMembros: 15, descontoConveniado: 8 },
    ])).toThrow(/Gap entre faixas/);
  });

  it('não lança quando próxima faixa começa exatamente em maxMembros + 1', () => {
    expect(() => validarFaixas([
      { minMembros: 1,  maxMembros: 5,   descontoMembros: 5,  descontoConveniado: 2 },
      { minMembros: 6, maxMembros: null, descontoMembros: 10, descontoConveniado: 5 },
    ])).not.toThrow();
  });

  it('não lança quando maxMembros é null (sem teto, próxima faixa permitida)', () => {
    // Quando maxMembros é null a checagem de gap é ignorada
    expect(() => validarFaixas([
      { minMembros: 1,  maxMembros: null, descontoMembros: 5,  descontoConveniado: 2 },
      { minMembros: 6,  maxMembros: null, descontoMembros: 10, descontoConveniado: 5 },
    ])).not.toThrow();
  });
});

// ══════════════════════════════════════════════════════════════════════════════
// 3. recalcularFaixa — orquestração com Prisma mockado
// ══════════════════════════════════════════════════════════════════════════════

describe('recalcularFaixa — orquestração com Prisma mockado', () => {
  // Importamos o serviço real para testar a orquestração completa.
  // As dependências de I/O são substituídas por mocks.
  const { ConveniosProgressaoService } = require('./convenios-progressao.service');

  let prisma: ReturnType<typeof makePrismaMock>;
  let service: InstanceType<typeof ConveniosProgressaoService>;

  beforeEach(() => {
    prisma = makePrismaMock();
    service = new ConveniosProgressaoService(prisma as any);
  });

  it('retorna sem fazer nada se convênio não existe', async () => {
    prisma.contratoConvenio.findUnique.mockResolvedValue(null);

    await service.recalcularFaixa('id-inexistente', 'TEST');

    expect(prisma.contratoConvenio.update).not.toHaveBeenCalled();
    expect(prisma.convenioCooperado.count).not.toHaveBeenCalled();
  });

  it('zera cache quando configBeneficio não tem faixas', async () => {
    prisma.contratoConvenio.findUnique.mockResolvedValue({
      id: 'conv-1',
      configBeneficio: {},
      faixaAtualIndex: 1,
      membrosAtivosCache: 5,
      descontoMembrosAtual: 10,
      descontoConveniadoAtual: 5,
    });

    await service.recalcularFaixa('conv-1', 'TEST');

    expect(prisma.contratoConvenio.update).toHaveBeenCalledWith({
      where: { id: 'conv-1' },
      data: {
        faixaAtualIndex: 0,
        membrosAtivosCache: 0,
        descontoMembrosAtual: 0,
        descontoConveniadoAtual: 0,
      },
    });
  });

  it('zera cache quando configBeneficio é null', async () => {
    prisma.contratoConvenio.findUnique.mockResolvedValue({
      id: 'conv-1',
      configBeneficio: null,
      faixaAtualIndex: 0,
      membrosAtivosCache: 0,
      descontoMembrosAtual: 0,
      descontoConveniadoAtual: 0,
    });

    await service.recalcularFaixa('conv-1', 'TEST');

    expect(prisma.contratoConvenio.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ descontoMembrosAtual: 0 }) }),
    );
  });

  it('atualiza para faixa correta conforme contagem de membros', async () => {
    prisma.contratoConvenio.findUnique.mockResolvedValue({
      id: 'conv-2',
      configBeneficio: { faixas: FAIXAS_PADRAO },
      faixaAtualIndex: 0,
      membrosAtivosCache: 3,
      descontoMembrosAtual: 5,
      descontoConveniadoAtual: 2,
    });
    prisma.convenioCooperado.count.mockResolvedValue(8); // → faixa 2 (index 1)
    prisma.contratoConvenio.update.mockResolvedValue({});
    prisma.historicoFaixaConvenio.create.mockResolvedValue({});
    prisma.convenioCooperado.updateMany.mockResolvedValue({});

    await service.recalcularFaixa('conv-2', 'NOVO_MEMBRO');

    expect(prisma.contratoConvenio.update).toHaveBeenCalledWith({
      where: { id: 'conv-2' },
      data: {
        faixaAtualIndex: 1,
        membrosAtivosCache: 8,
        descontoMembrosAtual: 10,
        descontoConveniadoAtual: 5,
      },
    });
  });

  it('registra histórico quando a faixa muda', async () => {
    prisma.contratoConvenio.findUnique.mockResolvedValue({
      id: 'conv-3',
      configBeneficio: { faixas: FAIXAS_PADRAO },
      faixaAtualIndex: 0,
      membrosAtivosCache: 5,
      descontoMembrosAtual: 5,
      descontoConveniadoAtual: 2,
    });
    prisma.convenioCooperado.count.mockResolvedValue(11); // → faixa 3 (index 2)
    prisma.contratoConvenio.update.mockResolvedValue({});
    prisma.historicoFaixaConvenio.create.mockResolvedValue({});
    prisma.convenioCooperado.updateMany.mockResolvedValue({});

    await service.recalcularFaixa('conv-3', 'NOVO_MEMBRO');

    expect(prisma.historicoFaixaConvenio.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          convenioId: 'conv-3',
          faixaAnteriorIdx: 0,
          faixaNovaIdx: 2,
          membrosAtivos: 11,
        }),
      }),
    );
  });

  it('NÃO registra histórico quando faixa e desconto permanecem iguais', async () => {
    prisma.contratoConvenio.findUnique.mockResolvedValue({
      id: 'conv-4',
      configBeneficio: { faixas: FAIXAS_PADRAO },
      faixaAtualIndex: 1,
      membrosAtivosCache: 7,
      descontoMembrosAtual: 10, // mesmo que será calculado
      descontoConveniadoAtual: 5,
    });
    prisma.convenioCooperado.count.mockResolvedValue(8); // → ainda faixa 2 (index 1, desconto 10%)
    prisma.contratoConvenio.update.mockResolvedValue({});
    prisma.convenioCooperado.updateMany.mockResolvedValue({});

    await service.recalcularFaixa('conv-4', 'RECALCULO_CRON');

    expect(prisma.historicoFaixaConvenio.create).not.toHaveBeenCalled();
  });

  it('atualiza label faixaAtual em todos os membros ativos', async () => {
    prisma.contratoConvenio.findUnique.mockResolvedValue({
      id: 'conv-5',
      configBeneficio: { faixas: FAIXAS_PADRAO },
      faixaAtualIndex: 0,
      membrosAtivosCache: 5,
      descontoMembrosAtual: 5,
      descontoConveniadoAtual: 2,
    });
    prisma.convenioCooperado.count.mockResolvedValue(6); // → faixa 2
    prisma.contratoConvenio.update.mockResolvedValue({});
    prisma.historicoFaixaConvenio.create.mockResolvedValue({});
    prisma.convenioCooperado.updateMany.mockResolvedValue({});

    await service.recalcularFaixa('conv-5', 'NOVO_MEMBRO');

    expect(prisma.convenioCooperado.updateMany).toHaveBeenCalledWith({
      where: { convenioId: 'conv-5', ativo: true },
      data: { faixaAtual: 'Faixa 2 (10%)' },
    });
  });
});

// ══════════════════════════════════════════════════════════════════════════════
// 4. resolverDescontoConvenio — movido para configuracao-cobranca.service.ts
//    Testes removidos pois o método não existe mais neste serviço.
// ══════════════════════════════════════════════════════════════════════════════
// ══════════════════════════════════════════════════════════════════════════════
// NOTE: resolverDescontoConvenio foi movido para configuracao-cobranca.service.ts
// Os testes dessa lógica devem ser criados em configuracao-cobranca.service.spec.ts
