import { calcularRepasseLiquido } from './calcular-repasse-liquido';
import type { UsinaParaCalculo, TarifaResolver } from './calcular-repasse';

/**
 * BH.5 (M41, 2026-05-30) — Cobertura do envelope `calcularRepasseLiquido`.
 *
 * Foco: garantir que o filtro Prisma só abate despesas com a combinação
 * exata de `tratamento=DESCONTO_NO_REPASSE` + `statusAprovacao=APROVADA` +
 * `statusResolucao=PENDENTE`, e que o líquido nunca fica negativo.
 *
 * O helper puro `calcularRepasse` já tem seus próprios specs — aqui mockamos
 * só o que importa pro envelope (passa pelas mesmas regras de bruto).
 */
describe('calcularRepasseLiquido', () => {
  const usinaBase: UsinaParaCalculo = {
    formaPagamentoDono: 'FIXO',
    valorAluguelFixo: 1000,
    percentualGeracaoDono: null,
    valorKwhPadrao: null,
    distribuidora: null,
  };

  const competencia = new Date(2026, 4, 15); // 15/Mai/2026
  const findMany = jest.fn();
  const prismaMock = { contaAPagar: { findMany } } as any;
  const tarifaResolverPadrao: TarifaResolver = () => 0;

  beforeEach(() => jest.clearAllMocks());

  it('Sem despesas no período → líquido === bruto', async () => {
    findMany.mockResolvedValueOnce([]);
    const r = await calcularRepasseLiquido({
      usina: usinaBase,
      usinaId: 'u1',
      cooperativaId: 'coop-A',
      geracaoMes: { kwhGerado: 0, competencia },
      tarifaResolver: tarifaResolverPadrao,
      prisma: prismaMock,
    });
    expect(r.valorBruto).toBe(1000);
    expect(r.valor).toBe(1000);
    expect(r.despesasAbatidas).toEqual([]);
    expect(r.totalDespesasAbatidas).toBe(0);
  });

  it('1 despesa DESCONTO_NO_REPASSE APROVADA + PENDENTE → abate', async () => {
    findMany.mockResolvedValueOnce([
      { id: 'd1', categoria: 'CUSD', valor: 300, descricao: 'CUSD 05/26', dataOcorrencia: competencia },
    ]);
    const r = await calcularRepasseLiquido({
      usina: usinaBase,
      usinaId: 'u1',
      cooperativaId: 'coop-A',
      geracaoMes: { kwhGerado: 0, competencia },
      tarifaResolver: tarifaResolverPadrao,
      prisma: prismaMock,
    });
    expect(r.valorBruto).toBe(1000);
    expect(r.totalDespesasAbatidas).toBe(300);
    expect(r.valor).toBe(700);
    expect(r.despesasAbatidas).toHaveLength(1);
  });

  it('Múltiplas despesas → somatório correto', async () => {
    findMany.mockResolvedValueOnce([
      { id: 'd1', categoria: 'CUSD', valor: 200, descricao: '', dataOcorrencia: competencia },
      { id: 'd2', categoria: 'MANUTENCAO_PREVENTIVA', valor: 150.5, descricao: '', dataOcorrencia: competencia },
      { id: 'd3', categoria: 'OUTRO', valor: 49.5, descricao: '', dataOcorrencia: competencia },
    ]);
    const r = await calcularRepasseLiquido({
      usina: usinaBase,
      usinaId: 'u1',
      cooperativaId: 'coop-A',
      geracaoMes: { kwhGerado: 0, competencia },
      tarifaResolver: tarifaResolverPadrao,
      prisma: prismaMock,
    });
    expect(r.totalDespesasAbatidas).toBe(400);
    expect(r.valor).toBe(600);
  });

  it('Filtro Prisma exige tratamento+statusAprovacao+statusResolucao corretos', async () => {
    findMany.mockResolvedValueOnce([]);
    await calcularRepasseLiquido({
      usina: usinaBase,
      usinaId: 'u1',
      cooperativaId: 'coop-A',
      geracaoMes: { kwhGerado: 0, competencia },
      tarifaResolver: tarifaResolverPadrao,
      prisma: prismaMock,
    });
    const where = findMany.mock.calls[0][0].where;
    expect(where.tratamento).toBe('DESCONTO_NO_REPASSE');
    expect(where.statusAprovacao).toBe('APROVADA');
    expect(where.statusResolucao).toBe('PENDENTE');
    expect(where.usinaId).toBe('u1');
    expect(where.cooperativaId).toBe('coop-A');
    // Tipos REEMBOLSO / ASSUMIDO + status PROPOSTA / REJEITADA / RESOLVIDA
    // ficam fora do filtro por definição — defesa em camadas garantida pelo Prisma.
  });

  it('Líquido nunca negativo: despesas > bruto → líquido = 0', async () => {
    findMany.mockResolvedValueOnce([
      { id: 'd1', categoria: 'OUTRO', valor: 5000, descricao: '', dataOcorrencia: competencia },
    ]);
    const r = await calcularRepasseLiquido({
      usina: usinaBase,
      usinaId: 'u1',
      cooperativaId: 'coop-A',
      geracaoMes: { kwhGerado: 0, competencia },
      tarifaResolver: tarifaResolverPadrao,
      prisma: prismaMock,
    });
    expect(r.valorBruto).toBe(1000);
    expect(r.totalDespesasAbatidas).toBe(5000);
    expect(r.valor).toBe(0); // Math.max(0, -4000) === 0
  });

  it('Bruto null (forma_pagamento_dono_nao_definida) → líquido também null', async () => {
    const usinaSemForma: UsinaParaCalculo = { ...usinaBase, formaPagamentoDono: null };
    findMany.mockResolvedValueOnce([]);
    const r = await calcularRepasseLiquido({
      usina: usinaSemForma,
      usinaId: 'u1',
      cooperativaId: 'coop-A',
      geracaoMes: { kwhGerado: 0, competencia },
      tarifaResolver: tarifaResolverPadrao,
      prisma: prismaMock,
    });
    expect(r.valorBruto).toBeNull();
    expect(r.valor).toBeNull();
  });

  it('Período explícito sobrescreve mês da geracaoMes', async () => {
    findMany.mockResolvedValueOnce([]);
    const inicio = new Date(2026, 3, 1); // 1/Abr
    const fim = new Date(2026, 4, 1); // 1/Mai (exclusivo)
    await calcularRepasseLiquido({
      usina: usinaBase,
      usinaId: 'u1',
      cooperativaId: 'coop-A',
      geracaoMes: { kwhGerado: 0, competencia }, // Maio
      tarifaResolver: tarifaResolverPadrao,
      prisma: prismaMock,
      periodoInicio: inicio,
      periodoFim: fim,
    });
    const where = findMany.mock.calls[0][0].where;
    expect(where.dataOcorrencia.gte).toEqual(inicio);
    expect(where.dataOcorrencia.lt).toEqual(fim);
  });

  it('Sem geracaoMes e sem período → não abate, líquido = bruto', async () => {
    const r = await calcularRepasseLiquido({
      usina: usinaBase,
      usinaId: 'u1',
      cooperativaId: 'coop-A',
      geracaoMes: null,
      tarifaResolver: tarifaResolverPadrao,
      prisma: prismaMock,
    });
    expect(findMany).not.toHaveBeenCalled();
    expect(r.valor).toBe(1000);
    expect(r.valorBruto).toBe(1000);
    expect(r.despesasAbatidas).toEqual([]);
  });
});
