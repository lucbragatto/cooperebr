import { CobrancasService } from './cobrancas.service';
import { BadRequestException } from '@nestjs/common';

/**
 * Sprint 5 T6 — anti-duplicação de cobrança por (contratoId, mesReferencia, anoReferencia).
 *
 * Dupla camada de proteção:
 *   1. Guard em código aqui (cobrancas.service.ts:create)
 *   2. Constraint @@unique no schema (rede de segurança)
 *
 * Outros 2 gatilhos (faturas.service.ts linhas 529 e 889) já tinham
 * guard em código desde antes do T6 — T6 só completa a terceira porta.
 */
describe('CobrancasService.create — anti-duplicação T6', () => {
  const cobrancaFindFirst = jest.fn();
  const cobrancaCreate = jest.fn();
  const contratoFindUnique = jest.fn();

  const prismaMock = {
    cobranca: {
      findFirst: cobrancaFindFirst,
      create: cobrancaCreate,
    },
    contrato: { findUnique: contratoFindUnique },
  } as any;

  const empty = {} as any;

  let service: CobrancasService;

  const dadosBase = {
    contratoId: 'contrato-1',
    mesReferencia: 4,
    anoReferencia: 2026,
    valorBruto: 1000,
    percentualDesconto: 20,
    valorDesconto: 200,
    valorLiquido: 800,
    dataVencimento: new Date('2026-05-10'),
  };

  beforeEach(() => {
    jest.clearAllMocks();
    contratoFindUnique.mockResolvedValue({
      id: 'contrato-1',
      cooperativaId: 'coop-1',
      cooperado: { id: 'coop-uuid' },
      plano: { cooperTokenAtivo: false },
    });

    // CobrancasService tem muitas dependências — mockar tudo como empty.
    // Só prisma importa pra esta função.
    service = new CobrancasService(
      prismaMock,
      empty, empty, empty, empty, empty, empty, empty, empty, empty,
    );
  });

  it('T6: cria cobrança quando não existe duplicata', async () => {
    cobrancaFindFirst.mockResolvedValue(null);
    cobrancaCreate.mockResolvedValue({ id: 'cobranca-1', ...dadosBase });

    await service.create(dadosBase);

    expect(cobrancaFindFirst).toHaveBeenCalledWith({
      where: {
        contratoId: 'contrato-1',
        mesReferencia: 4,
        anoReferencia: 2026,
      },
      select: { id: true },
    });
    expect(cobrancaCreate).toHaveBeenCalledTimes(1);
  });

  it('T6: lança BadRequestException quando já existe cobrança na competência', async () => {
    cobrancaFindFirst.mockResolvedValue({ id: 'cobranca-existente' });

    await expect(service.create(dadosBase)).rejects.toThrow(BadRequestException);
    await expect(service.create(dadosBase)).rejects.toThrow(
      /Ja existe cobranca.*04\/2026/,
    );

    // Critical: create NÃO deve ter sido chamado
    expect(cobrancaCreate).not.toHaveBeenCalled();
  });

  it('T6: competências distintas no mesmo contrato não bloqueiam', async () => {
    cobrancaFindFirst.mockResolvedValue(null);
    cobrancaCreate.mockResolvedValue({ id: 'cobranca-2' });

    // Fevereiro
    await service.create({ ...dadosBase, mesReferencia: 2 });
    // Março
    await service.create({ ...dadosBase, mesReferencia: 3 });

    expect(cobrancaCreate).toHaveBeenCalledTimes(2);
  });
});

/**
 * Sprint 12 (2026-04-27): backend é fonte da verdade do desconto.
 * Cobranca herda Contrato.percentualDesconto quando body não envia.
 * Body explícito tem prioridade (override pontual).
 */
describe('CobrancasService.create — fallback de desconto via Contrato', () => {
  const cobrancaFindFirst = jest.fn();
  const cobrancaCreate = jest.fn();
  const contratoFindUnique = jest.fn();

  const prismaMock = {
    cobranca: { findFirst: cobrancaFindFirst, create: cobrancaCreate },
    contrato: { findUnique: contratoFindUnique },
  } as any;
  const empty = {} as any;

  let service: CobrancasService;

  beforeEach(() => {
    jest.clearAllMocks();
    cobrancaFindFirst.mockResolvedValue(null);
    cobrancaCreate.mockImplementation(({ data }: any) => Promise.resolve({ id: 'cob-1', ...data }));
    service = new CobrancasService(
      prismaMock,
      empty, empty, empty, empty, empty, empty, empty, empty, empty,
    );
  });

  function mockContrato(percentualDesconto: number) {
    contratoFindUnique.mockResolvedValue({
      id: 'contrato-1',
      cooperativaId: 'coop-1',
      cooperadoId: 'cooperado-1',
      percentualDesconto,
      cooperado: { id: 'cooperado-1' },
      plano: { cooperTokenAtivo: false },
    });
  }

  it('Cenário 1: bruto R$ 10, contrato 20%, body sem desconto → desc 2.00, líq 8.00', async () => {
    mockContrato(20);
    await service.create({
      contratoId: 'contrato-1',
      mesReferencia: 4,
      anoReferencia: 2026,
      valorBruto: 10,
      dataVencimento: new Date('2026-05-10'),
    });
    const arg = cobrancaCreate.mock.calls[0][0].data;
    expect(arg.percentualDesconto).toBe(20);
    expect(arg.valorDesconto).toBe(2);
    expect(arg.valorLiquido).toBe(8);
  });

  it('Cenário 3: contrato com desconto 0% → líquido = bruto', async () => {
    mockContrato(0);
    await service.create({
      contratoId: 'contrato-1',
      mesReferencia: 4,
      anoReferencia: 2026,
      valorBruto: 100,
      dataVencimento: new Date('2026-05-10'),
    });
    const arg = cobrancaCreate.mock.calls[0][0].data;
    expect(arg.percentualDesconto).toBe(0);
    expect(arg.valorDesconto).toBe(0);
    expect(arg.valorLiquido).toBe(100);
  });

  it('Cenário 4: body envia percentualDesconto=25 (override) → contrato 18% é ignorado', async () => {
    mockContrato(18);
    await service.create({
      contratoId: 'contrato-1',
      mesReferencia: 4,
      anoReferencia: 2026,
      valorBruto: 100,
      percentualDesconto: 25,
      dataVencimento: new Date('2026-05-10'),
    });
    const arg = cobrancaCreate.mock.calls[0][0].data;
    expect(arg.percentualDesconto).toBe(25);
    expect(arg.valorDesconto).toBe(25);
    expect(arg.valorLiquido).toBe(75);
  });

  it('Centavos: bruto R$ 327.45, contrato 18% → desc 58.94, líq 268.51', async () => {
    mockContrato(18);
    await service.create({
      contratoId: 'contrato-1',
      mesReferencia: 4,
      anoReferencia: 2026,
      valorBruto: 327.45,
      dataVencimento: new Date('2026-05-10'),
    });
    const arg = cobrancaCreate.mock.calls[0][0].data;
    expect(arg.percentualDesconto).toBe(18);
    expect(arg.valorDesconto).toBe(58.94);
    expect(arg.valorLiquido).toBe(268.51);
  });

  it('Normaliza dataVencimento "YYYY-MM-DD" pra Date UTC midnight', async () => {
    mockContrato(20);
    await service.create({
      contratoId: 'contrato-1',
      mesReferencia: 4,
      anoReferencia: 2026,
      valorBruto: 10,
      dataVencimento: '2026-05-03',
    });
    const arg = cobrancaCreate.mock.calls[0][0].data;
    expect(arg.dataVencimento).toBeInstanceOf(Date);
    expect(arg.dataVencimento.toISOString()).toBe('2026-05-03T00:00:00.000Z');
  });

  it('Lança BadRequestException quando dataVencimento é inválida', async () => {
    mockContrato(20);
    await expect(
      service.create({
        contratoId: 'contrato-1',
        mesReferencia: 4,
        anoReferencia: 2026,
        valorBruto: 10,
        dataVencimento: 'data-invalida',
      }),
    ).rejects.toThrow(BadRequestException);
  });
});
