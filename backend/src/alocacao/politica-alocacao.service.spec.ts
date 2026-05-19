/**
 * M14.A — specs do PoliticaAlocacaoService (CRUD + validação de faixa + multi-tenant).
 */
import { BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { PoliticaAlocacaoService } from './politica-alocacao.service';

type Any = any;

function makeService() {
  const prisma = {
    politicaAlocacao: {
      findMany: jest.fn(),
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
  };
  const service = new PoliticaAlocacaoService(prisma as Any);
  return { service, prisma };
}

const TENANT = 'coop-A';
const OTHER = 'coop-B';

describe('PoliticaAlocacaoService', () => {
  describe('listar', () => {
    it('filtra por tenant quando cooperativaId não-null', async () => {
      const { service, prisma } = makeService();
      prisma.politicaAlocacao.findMany.mockResolvedValue([]);
      await service.listar(TENANT);
      const call = prisma.politicaAlocacao.findMany.mock.calls[0][0];
      expect(call.where).toEqual({ cooperativaId: TENANT });
      expect(call.orderBy).toEqual([{ prioridade: 'desc' }, { faixaMin: 'asc' }]);
    });

    it('SUPER_ADMIN (null): sem filtro de tenant', async () => {
      const { service, prisma } = makeService();
      prisma.politicaAlocacao.findMany.mockResolvedValue([]);
      await service.listar(null);
      const call = prisma.politicaAlocacao.findMany.mock.calls[0][0];
      expect(call.where).toEqual({});
    });
  });

  describe('obter', () => {
    it('lança NotFound quando não existe', async () => {
      const { service, prisma } = makeService();
      prisma.politicaAlocacao.findUnique.mockResolvedValue(null);
      await expect(service.obter('p-x', TENANT)).rejects.toThrow(NotFoundException);
    });

    it('lança Forbidden em tenant errado', async () => {
      const { service, prisma } = makeService();
      prisma.politicaAlocacao.findUnique.mockResolvedValue({ id: 'p-1', cooperativaId: OTHER });
      await expect(service.obter('p-1', TENANT)).rejects.toThrow(ForbiddenException);
    });
  });

  describe('criar', () => {
    it('happy path: cria com defaults', async () => {
      const { service, prisma } = makeService();
      prisma.politicaAlocacao.create.mockResolvedValue({ id: 'p-1' });
      await service.criar({
        dto: { nome: 'Pequenos', faixaMin: 0, faixaMax: 500 } as any,
        cooperativaId: TENANT,
      });
      const call = prisma.politicaAlocacao.create.mock.calls[0][0];
      expect(call.data.cooperativaId).toBe(TENANT);
      expect(call.data.usinasElegiveis).toEqual([]);
      expect(call.data.ativa).toBe(true);
      expect(call.data.prioridade).toBe(0);
    });

    it('rejeita faixaMin negativa', async () => {
      const { service } = makeService();
      await expect(
        service.criar({ dto: { nome: 'x', faixaMin: -10 } as any, cooperativaId: TENANT }),
      ).rejects.toThrow(BadRequestException);
    });

    it('rejeita faixaMax <= faixaMin', async () => {
      const { service } = makeService();
      await expect(
        service.criar({
          dto: { nome: 'x', faixaMin: 500, faixaMax: 500 } as any,
          cooperativaId: TENANT,
        }),
      ).rejects.toThrow(/faixaMax deve ser > faixaMin/);
    });

    it('aceita faixaMax null (sem teto)', async () => {
      const { service, prisma } = makeService();
      prisma.politicaAlocacao.create.mockResolvedValue({ id: 'p-1' });
      await service.criar({
        dto: { nome: 'Grandes', faixaMin: 2000, faixaMax: null } as any,
        cooperativaId: TENANT,
      });
      expect(prisma.politicaAlocacao.create).toHaveBeenCalled();
    });
  });

  describe('atualizar', () => {
    it('aplica updates parciais (só campos definidos)', async () => {
      const { service, prisma } = makeService();
      prisma.politicaAlocacao.findUnique.mockResolvedValue({
        id: 'p-1',
        cooperativaId: TENANT,
        faixaMin: 500,
        faixaMax: 2000,
      });
      prisma.politicaAlocacao.update.mockResolvedValue({});
      await service.atualizar({ id: 'p-1', dto: { ativa: false }, cooperativaId: TENANT });
      const call = prisma.politicaAlocacao.update.mock.calls[0][0];
      expect(call.data).toEqual({ ativa: false });
    });

    it('lança Forbidden em tenant errado', async () => {
      const { service, prisma } = makeService();
      prisma.politicaAlocacao.findUnique.mockResolvedValue({ id: 'p-1', cooperativaId: OTHER });
      await expect(
        service.atualizar({ id: 'p-1', dto: { ativa: false }, cooperativaId: TENANT }),
      ).rejects.toThrow(ForbiddenException);
    });

    it('valida faixa quando faixaMin/faixaMax mudam', async () => {
      const { service, prisma } = makeService();
      prisma.politicaAlocacao.findUnique.mockResolvedValue({
        id: 'p-1',
        cooperativaId: TENANT,
        faixaMin: 0,
        faixaMax: 500,
      });
      await expect(
        service.atualizar({ id: 'p-1', dto: { faixaMin: 600 }, cooperativaId: TENANT }),
      ).rejects.toThrow(/faixaMax deve ser > faixaMin/);
    });
  });

  describe('remover', () => {
    it('delete OK quando tenant confere', async () => {
      const { service, prisma } = makeService();
      prisma.politicaAlocacao.findUnique.mockResolvedValue({ id: 'p-1', cooperativaId: TENANT });
      prisma.politicaAlocacao.delete.mockResolvedValue({});
      await service.remover('p-1', TENANT);
      expect(prisma.politicaAlocacao.delete).toHaveBeenCalledWith({ where: { id: 'p-1' } });
    });

    it('lança Forbidden em tenant errado', async () => {
      const { service, prisma } = makeService();
      prisma.politicaAlocacao.findUnique.mockResolvedValue({ id: 'p-1', cooperativaId: OTHER });
      await expect(service.remover('p-1', TENANT)).rejects.toThrow(ForbiddenException);
    });
  });
});
