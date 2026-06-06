/**
 * Sprint Onboarding Bloco 0 Fatia 0.1 (06/06/2026) — specs PlanoClubeService.
 *
 * Cobertura:
 *  - CRUD multi-tenant (listar/obter/criar/atualizar/desativar)
 *  - 404 cross-tenant (anti-enumeração)
 *  - Validação semântica `cobra ⇒ valorMensal > 0`
 *  - Helper `resolverParaCobranca` pra Fatia 0.4 (defaults seguros)
 *  - Soft-delete preserva registro (não usa prisma.delete)
 */
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { PlanoClubeService } from './plano-clube.service';

describe('PlanoClubeService', () => {
  let service: PlanoClubeService;
  let prismaMock: any;

  const TENANT_A = 'coop-a';
  const TENANT_B = 'coop-b';

  beforeEach(() => {
    prismaMock = {
      planoClube: {
        findMany: jest.fn(),
        findFirst: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
      },
    };
    service = Object.create(PlanoClubeService.prototype);
    (service as any).prisma = prismaMock;
    (service as any).logger = { log: jest.fn(), warn: jest.fn(), error: jest.fn() };
  });

  // ─── listar ─────────────────────────────────────────────────────────
  it('listar — filtra por cooperativaId e ativos por default', async () => {
    prismaMock.planoClube.findMany.mockResolvedValue([]);

    await service.listar(TENANT_A);

    expect(prismaMock.planoClube.findMany).toHaveBeenCalledWith({
      where: { cooperativaId: TENANT_A, ativo: true },
      orderBy: [{ ativo: 'desc' }, { nome: 'asc' }],
    });
  });

  it('listar — incluirInativos remove o filtro ativo', async () => {
    prismaMock.planoClube.findMany.mockResolvedValue([]);

    await service.listar(TENANT_A, { incluirInativos: true });

    expect(prismaMock.planoClube.findMany).toHaveBeenCalledWith({
      where: { cooperativaId: TENANT_A },
      orderBy: [{ ativo: 'desc' }, { nome: 'asc' }],
    });
  });

  // ─── obter (multi-tenant) ───────────────────────────────────────────
  it('obter — 404 quando plano não existe no tenant (cross-tenant tampouco)', async () => {
    prismaMock.planoClube.findFirst.mockResolvedValue(null);

    await expect(service.obter('plano-de-outro', TENANT_A)).rejects.toThrow(NotFoundException);
    expect(prismaMock.planoClube.findFirst).toHaveBeenCalledWith({
      where: { id: 'plano-de-outro', cooperativaId: TENANT_A },
    });
  });

  it('obter — retorna o plano quando match', async () => {
    const plano = { id: 'p1', cooperativaId: TENANT_A, nome: 'Ouro', valorMensal: '49.90', cobra: true, ativo: true };
    prismaMock.planoClube.findFirst.mockResolvedValue(plano);

    const r = await service.obter('p1', TENANT_A);

    expect(r).toBe(plano);
  });

  // ─── criar ──────────────────────────────────────────────────────────
  it('criar — happy path: cooperativaId aplicado + defaults (cobra=true, ativo=true)', async () => {
    prismaMock.planoClube.create.mockResolvedValue({
      id: 'novo',
      cooperativaId: TENANT_A,
      nome: 'Ouro',
      descricao: null,
      valorMensal: '19.9',
      cobra: true,
      ativo: true,
      tierMinimo: null,
    });

    await service.criar(
      { nome: ' Ouro ', valorMensal: 19.9 },
      TENANT_A,
    );

    expect(prismaMock.planoClube.create).toHaveBeenCalledWith({
      data: {
        cooperativaId: TENANT_A,
        nome: 'Ouro', // trimado
        descricao: null,
        valorMensal: 19.9,
        cobra: true,
        ativo: true,
        tierMinimo: null,
      },
    });
  });

  it('criar — clube grátis (cobra=false) aceita valorMensal=0', async () => {
    prismaMock.planoClube.create.mockResolvedValue({
      id: 'p-gratis',
      nome: 'Gratis',
      valorMensal: '0',
      cobra: false,
    });

    await expect(
      service.criar({ nome: 'Gratis', valorMensal: 0, cobra: false }, TENANT_A),
    ).resolves.not.toThrow();
  });

  it('criar — cobra=true + valorMensal=0 → BadRequest (regra semântica)', async () => {
    await expect(
      service.criar({ nome: 'Ruim', valorMensal: 0, cobra: true }, TENANT_A),
    ).rejects.toThrow(BadRequestException);
    expect(prismaMock.planoClube.create).not.toHaveBeenCalled();
  });

  it('criar — cobra=true (default) + valorMensal=0 → BadRequest', async () => {
    await expect(
      service.criar({ nome: 'Default', valorMensal: 0 }, TENANT_A),
    ).rejects.toThrow('Quando cobra=true, valorMensal deve ser > 0');
  });

  // ─── atualizar (multi-tenant + semântica combinada) ────────────────
  it('atualizar — 404 cross-tenant', async () => {
    prismaMock.planoClube.findFirst.mockResolvedValue(null);

    await expect(
      service.atualizar('plano-x', { nome: 'Novo' }, TENANT_A),
    ).rejects.toThrow(NotFoundException);
    expect(prismaMock.planoClube.update).not.toHaveBeenCalled();
  });

  it('atualizar — semântica usa estado combinado (cobra=true + valorMensal=0 mesmo só passando 1)', async () => {
    prismaMock.planoClube.findFirst.mockResolvedValue({
      id: 'p1',
      cooperativaId: TENANT_A,
      cobra: true,
      valorMensal: '19.9',
      nome: 'X',
      ativo: true,
      tierMinimo: null,
    });

    // delta só zera o valor — combinado fica cobra=true (do atual) + valorMensal=0 (do delta).
    await expect(
      service.atualizar('p1', { valorMensal: 0 }, TENANT_A),
    ).rejects.toThrow(BadRequestException);
  });

  it('atualizar — desabilita cobra preservando valorMensal=0 (válido)', async () => {
    prismaMock.planoClube.findFirst.mockResolvedValue({
      id: 'p1',
      cooperativaId: TENANT_A,
      cobra: true,
      valorMensal: '0',
      nome: 'X',
      ativo: true,
      tierMinimo: null,
    });
    prismaMock.planoClube.update.mockResolvedValue({});

    await expect(
      service.atualizar('p1', { cobra: false }, TENANT_A),
    ).resolves.not.toThrow();
    expect(prismaMock.planoClube.update).toHaveBeenCalledWith({
      where: { id: 'p1' },
      data: { cobra: false },
    });
  });

  // ─── desativar (soft-delete) ───────────────────────────────────────
  it('desativar — soft delete (ativo=false), preserva registro pra histórico', async () => {
    prismaMock.planoClube.findFirst.mockResolvedValue({
      id: 'p1',
      cooperativaId: TENANT_A,
    });
    prismaMock.planoClube.update.mockResolvedValue({});

    await service.desativar('p1', TENANT_A);

    expect(prismaMock.planoClube.update).toHaveBeenCalledWith({
      where: { id: 'p1' },
      data: { ativo: false },
    });
  });

  it('desativar — 404 cross-tenant', async () => {
    prismaMock.planoClube.findFirst.mockResolvedValue(null);

    await expect(service.desativar('p1', TENANT_B)).rejects.toThrow(NotFoundException);
  });

  // ─── resolverParaCobranca (helper Fatia 0.4) ───────────────────────
  describe('resolverParaCobranca (helper Fatia 0.4)', () => {
    it('null/undefined → retorna null (caller decide se erro)', async () => {
      expect(await service.resolverParaCobranca(null, TENANT_A)).toBeNull();
      expect(await service.resolverParaCobranca(undefined, TENANT_A)).toBeNull();
      expect(await service.resolverParaCobranca('', TENANT_A)).toBeNull();
    });

    it('plano de outro tenant → null (anti-vazamento)', async () => {
      prismaMock.planoClube.findFirst.mockResolvedValue(null);

      expect(await service.resolverParaCobranca('p1', TENANT_A)).toBeNull();
      expect(prismaMock.planoClube.findFirst).toHaveBeenCalledWith({
        where: { id: 'p1', cooperativaId: TENANT_A, ativo: true },
        select: { id: true, valorMensal: true, cobra: true, nome: true },
      });
    });

    it('plano ativo do tenant → retorna { id, valorMensal numérico, cobra, nome }', async () => {
      prismaMock.planoClube.findFirst.mockResolvedValue({
        id: 'p1',
        valorMensal: '19.90',
        cobra: true,
        nome: 'Ouro',
      });

      const r = await service.resolverParaCobranca('p1', TENANT_A);

      expect(r).toEqual({ id: 'p1', valorMensal: 19.9, cobra: true, nome: 'Ouro' });
    });
  });
});
