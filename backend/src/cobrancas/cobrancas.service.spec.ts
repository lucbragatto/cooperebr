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
