/**
 * M14.A — specs do AlocacaoService (orchestration: simular wrap, listar, obter,
 * aplicar, descartar). Mock do AlocacaoEngineService isola da lógica do engine.
 */
import {
  BadRequestException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { AlocacaoService } from './alocacao.service';

type Any = any;

function buildPrisma() {
  return {
    alocacaoOtima: {
      findUnique: jest.fn(),
      findMany: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
    contrato: { update: jest.fn() },
    $transaction: jest.fn(async (cb: Any) => cb({ contrato: { update: jest.fn() }, alocacaoOtima: { update: jest.fn() } })),
  };
}

function makeService(engineSnapshot?: Any) {
  const prisma = buildPrisma();
  const engine = {
    simular: jest.fn().mockResolvedValue(engineSnapshot ?? {
      cooperativaId: 'coop-A',
      contratosAvaliados: 5,
      realocacoesSugeridas: 2,
      realocacoes: [],
      custoTotalAntesProxy: 0,
      custoTotalDepoisProxy: 0,
      economiaTotalProxy: 0,
      geradoEm: new Date().toISOString(),
    }),
  };
  const service = new AlocacaoService(prisma as Any, engine as Any);
  return { service, prisma, engine };
}

const TENANT = 'coop-A';
const OTHER = 'coop-B';

describe('AlocacaoService', () => {
  describe('simular', () => {
    it('chama engine.simular e grava AlocacaoOtima com status SUGERIDA', async () => {
      const { service, prisma, engine } = makeService();
      prisma.alocacaoOtima.create.mockImplementation((args: Any) => ({ id: 'a-1', ...args.data }));
      const result = await service.simular({ cooperativaId: TENANT, userId: 'u-1' });
      expect(engine.simular).toHaveBeenCalledWith(TENANT);
      const createArgs = prisma.alocacaoOtima.create.mock.calls[0][0];
      expect(createArgs.data.cooperativaId).toBe(TENANT);
      expect(createArgs.data.status).toBe('SUGERIDA');
      expect(createArgs.data.geradaPorUserId).toBe('u-1');
      expect(result.id).toBe('a-1');
    });

    it('userId null quando não informado', async () => {
      const { service, prisma } = makeService();
      prisma.alocacaoOtima.create.mockResolvedValue({ id: 'a-2' });
      await service.simular({ cooperativaId: TENANT });
      const createArgs = prisma.alocacaoOtima.create.mock.calls[0][0];
      expect(createArgs.data.geradaPorUserId).toBeNull();
    });
  });

  describe('listar', () => {
    it('filtra por tenant + status', async () => {
      const { service, prisma } = makeService();
      prisma.alocacaoOtima.findMany.mockResolvedValue([]);
      await service.listar({ cooperativaId: TENANT, status: 'SUGERIDA' });
      const call = prisma.alocacaoOtima.findMany.mock.calls[0][0];
      expect(call.where).toEqual({ cooperativaId: TENANT, status: 'SUGERIDA' });
      expect(call.take).toBe(50);
    });

    it('SUPER_ADMIN: sem tenant filter', async () => {
      const { service, prisma } = makeService();
      prisma.alocacaoOtima.findMany.mockResolvedValue([]);
      await service.listar({ cooperativaId: null });
      const call = prisma.alocacaoOtima.findMany.mock.calls[0][0];
      expect(call.where).toEqual({});
    });

    it('take: clamps a 100 max e 1 min', async () => {
      const { service, prisma } = makeService();
      prisma.alocacaoOtima.findMany.mockResolvedValue([]);
      await service.listar({ cooperativaId: TENANT, take: 9999 });
      let call = prisma.alocacaoOtima.findMany.mock.calls[0][0];
      expect(call.take).toBe(100);
      await service.listar({ cooperativaId: TENANT, take: 0 });
      call = prisma.alocacaoOtima.findMany.mock.calls[1][0];
      expect(call.take).toBe(1);
    });
  });

  describe('obter', () => {
    it('NotFound quando não existe', async () => {
      const { service, prisma } = makeService();
      prisma.alocacaoOtima.findUnique.mockResolvedValue(null);
      await expect(service.obter('a-x', TENANT)).rejects.toThrow(NotFoundException);
    });

    it('Forbidden em tenant errado', async () => {
      const { service, prisma } = makeService();
      prisma.alocacaoOtima.findUnique.mockResolvedValue({ id: 'a-1', cooperativaId: OTHER });
      await expect(service.obter('a-1', TENANT)).rejects.toThrow(ForbiddenException);
    });

    it('SUPER_ADMIN (null): sem check tenant', async () => {
      const { service, prisma } = makeService();
      prisma.alocacaoOtima.findUnique.mockResolvedValue({ id: 'a-1', cooperativaId: OTHER });
      await expect(service.obter('a-1', null)).resolves.toBeDefined();
    });
  });

  describe('aplicar', () => {
    function setupAlocacao(prisma: Any, opts: Partial<{
      status: string;
      realocacoes: Any[];
      aprovadasContratoIds: string[];
    }> = {}) {
      prisma.alocacaoOtima.findUnique.mockResolvedValue({
        id: 'a-1',
        cooperativaId: TENANT,
        status: opts.status ?? 'SUGERIDA',
        snapshot: {
          realocacoes: opts.realocacoes ?? [
            { contratoId: 'c-1', usinaSugeridaId: 'u-1' },
            { contratoId: 'c-2', usinaSugeridaId: 'u-2' },
          ],
        },
        aprovadasContratoIds: opts.aprovadasContratoIds ?? [],
        observacoes: null,
      });
    }

    it('rejeita lista vazia', async () => {
      const { service, prisma } = makeService();
      setupAlocacao(prisma);
      await expect(
        service.aplicar({ id: 'a-1', contratoIds: [], userId: 'u', cooperativaId: TENANT }),
      ).rejects.toThrow(BadRequestException);
    });

    it('rejeita aplicar quando status APROVADA_TOTAL (estado final)', async () => {
      const { service, prisma } = makeService();
      setupAlocacao(prisma, { status: 'APROVADA_TOTAL' });
      await expect(
        service.aplicar({ id: 'a-1', contratoIds: ['c-1'], userId: 'u', cooperativaId: TENANT }),
      ).rejects.toThrow(/estado final/);
    });

    it('rejeita IDs que não constam no snapshot', async () => {
      const { service, prisma } = makeService();
      setupAlocacao(prisma);
      await expect(
        service.aplicar({ id: 'a-1', contratoIds: ['c-X'], userId: 'u', cooperativaId: TENANT }),
      ).rejects.toThrow(/Nenhuma realocação válida/);
    });

    it('APROVADA_PARCIAL quando apenas alguns aprovados', async () => {
      const { service, prisma } = makeService();
      setupAlocacao(prisma);
      // Mock $transaction pra retornar UPDATE da alocação
      prisma.$transaction.mockImplementation(async (cb: Any) => {
        const tx = {
          contrato: { update: jest.fn() },
          alocacaoOtima: { update: jest.fn().mockImplementation((args) => ({ id: 'a-1', ...args.data })) },
        };
        return cb(tx);
      });
      const result = await service.aplicar({
        id: 'a-1',
        contratoIds: ['c-1'], // só 1 de 2
        userId: 'u-admin',
        cooperativaId: TENANT,
      });
      expect(result.status).toBe('APROVADA_PARCIAL');
    });

    it('APROVADA_TOTAL quando todos aprovados', async () => {
      const { service, prisma } = makeService();
      setupAlocacao(prisma);
      prisma.$transaction.mockImplementation(async (cb: Any) => {
        const tx = {
          contrato: { update: jest.fn() },
          alocacaoOtima: { update: jest.fn().mockImplementation((args) => ({ id: 'a-1', ...args.data })) },
        };
        return cb(tx);
      });
      const result = await service.aplicar({
        id: 'a-1',
        contratoIds: ['c-1', 'c-2'],
        userId: 'u-admin',
        cooperativaId: TENANT,
      });
      expect(result.status).toBe('APROVADA_TOTAL');
    });
  });

  describe('descartar', () => {
    it('marca status DESCARTADA + grava motivo', async () => {
      const { service, prisma } = makeService();
      prisma.alocacaoOtima.findUnique.mockResolvedValue({
        id: 'a-1',
        cooperativaId: TENANT,
        status: 'SUGERIDA',
        observacoes: null,
      });
      prisma.alocacaoOtima.update.mockResolvedValue({ status: 'DESCARTADA' });
      await service.descartar({ id: 'a-1', motivo: 'Não economiza o suficiente', cooperativaId: TENANT });
      const updateCall = prisma.alocacaoOtima.update.mock.calls[0][0];
      expect(updateCall.data.status).toBe('DESCARTADA');
      expect(updateCall.data.observacoes).toBe('Não economiza o suficiente');
    });

    it('idempotente: já DESCARTADA retorna sem update', async () => {
      const { service, prisma } = makeService();
      prisma.alocacaoOtima.findUnique.mockResolvedValue({
        id: 'a-1',
        cooperativaId: TENANT,
        status: 'DESCARTADA',
      });
      const result = await service.descartar({ id: 'a-1', cooperativaId: TENANT });
      expect(prisma.alocacaoOtima.update).not.toHaveBeenCalled();
      expect(result.status).toBe('DESCARTADA');
    });
  });
});
