import { ForbiddenException } from '@nestjs/common';
import { PlanosService } from './planos.service';
import { PerfilUsuario } from '../auth/perfil.enum';
import { ModeloCobranca, TipoCampanha } from '@prisma/client';

describe('PlanosService - Multi-tenant (Fase A)', () => {
  let service: PlanosService;
  const planoFindMany = jest.fn();
  const planoFindUnique = jest.fn();
  const planoCreate = jest.fn();
  const planoUpdate = jest.fn();
  const planoDelete = jest.fn();
  const planoCount = jest.fn();
  const contratoCount = jest.fn();

  const prismaMock: any = {
    plano: {
      findMany: planoFindMany,
      findUnique: planoFindUnique,
      create: planoCreate,
      update: planoUpdate,
      delete: planoDelete,
      count: planoCount,
    },
    contrato: { count: contratoCount },
  };

  const userSuper = { perfil: PerfilUsuario.SUPER_ADMIN, cooperativaId: null };
  const userAdminA = { perfil: PerfilUsuario.ADMIN, cooperativaId: 'coop-A' };
  const userAdminB = { perfil: PerfilUsuario.ADMIN, cooperativaId: 'coop-B' };

  const dtoMinimo = {
    nome: 'Plano Teste',
    modeloCobranca: 'FIXO_MENSAL' as const,
    descontoBase: 20,
  };

  beforeEach(() => {
    jest.clearAllMocks();
    service = new PlanosService(prismaMock);
  });

  describe('findAll() — listagem com filtro tenant', () => {
    it('Test 1: SUPER_ADMIN findAll() retorna todos os planos sem filtro', async () => {
      planoFindMany.mockResolvedValueOnce([{ id: 'p1' }, { id: 'p2' }, { id: 'p3' }]);
      await service.findAll(userSuper);
      expect(planoFindMany).toHaveBeenCalledWith({ orderBy: { createdAt: 'desc' } });
    });

    it('Test 2: ADMIN findAll() retorna apenas próprios + globais', async () => {
      planoFindMany.mockResolvedValueOnce([]);
      await service.findAll(userAdminA);
      expect(planoFindMany).toHaveBeenCalledWith({
        where: {
          OR: [
            { cooperativaId: 'coop-A' },
            { cooperativaId: null },
          ],
        },
        orderBy: { createdAt: 'desc' },
      });
    });

    it('findAll() sem reqUser retorna vitrine pública (globais ativos públicos)', async () => {
      planoFindMany.mockResolvedValueOnce([]);
      await service.findAll(undefined);
      expect(planoFindMany).toHaveBeenCalledWith({
        where: { cooperativaId: null, publico: true, ativo: true },
        orderBy: { createdAt: 'desc' },
      });
    });
  });

  describe('findOne() — cross-tenant guard', () => {
    it('Test 3: ADMIN findOne() de plano de outro parceiro lança ForbiddenException', async () => {
      planoFindUnique.mockResolvedValueOnce({
        id: 'plano-coop-B',
        cooperativaId: 'coop-B',
        ativo: true,
        publico: true,
      });
      await expect(service.findOne('plano-coop-B', userAdminA)).rejects.toThrow(ForbiddenException);
    });

    it('Test 4: ADMIN findOne() de plano global é permitido', async () => {
      planoFindUnique.mockResolvedValueOnce({
        id: 'plano-global',
        cooperativaId: null,
        ativo: true,
        publico: true,
      });
      const r = await service.findOne('plano-global', userAdminA);
      expect(r.id).toBe('plano-global');
    });

    it('SUPER_ADMIN findOne() de qualquer plano é permitido', async () => {
      planoFindUnique.mockResolvedValueOnce({
        id: 'plano-coop-B',
        cooperativaId: 'coop-B',
        ativo: true,
        publico: true,
      });
      const r = await service.findOne('plano-coop-B', userSuper);
      expect(r.id).toBe('plano-coop-B');
    });

    it('ADMIN findOne() de plano do próprio tenant é permitido', async () => {
      planoFindUnique.mockResolvedValueOnce({
        id: 'plano-A',
        cooperativaId: 'coop-A',
        ativo: true,
        publico: true,
      });
      const r = await service.findOne('plano-A', userAdminA);
      expect(r.id).toBe('plano-A');
    });
  });

  describe('create() — força tenant em ADMIN, livre em SUPER_ADMIN', () => {
    it('Test 5: ADMIN create() ignora cooperativaId do DTO e força próprio tenant', async () => {
      planoCreate.mockResolvedValueOnce({ id: 'novo' });
      await service.create({ ...dtoMinimo, cooperativaId: 'coop-B' /* tenta cross-tenant */ }, userAdminA);
      const data = planoCreate.mock.calls[0][0].data;
      expect(data.cooperativaId).toBe('coop-A'); // forçou própria
      expect(data.cooperativaId).not.toBe('coop-B'); // ignorou DTO
    });

    it('Test 6: SUPER_ADMIN create() com cooperativaId=null cria plano global', async () => {
      planoCreate.mockResolvedValueOnce({ id: 'global' });
      await service.create({ ...dtoMinimo, cooperativaId: null }, userSuper);
      expect(planoCreate.mock.calls[0][0].data.cooperativaId).toBeNull();
    });

    it('Test 6b: SUPER_ADMIN create() sem cooperativaId no DTO também cria global', async () => {
      planoCreate.mockResolvedValueOnce({ id: 'global' });
      await service.create({ ...dtoMinimo }, userSuper);
      expect(planoCreate.mock.calls[0][0].data.cooperativaId).toBeNull();
    });

    it('Test 7: SUPER_ADMIN create() com cooperativaId="X" cria pra parceiro X', async () => {
      planoCreate.mockResolvedValueOnce({ id: 'plano-X' });
      await service.create({ ...dtoMinimo, cooperativaId: 'coop-X' }, userSuper);
      expect(planoCreate.mock.calls[0][0].data.cooperativaId).toBe('coop-X');
    });

    it('ADMIN sem cooperativaId vinculada lança ForbiddenException', async () => {
      const adminOrfao = { perfil: PerfilUsuario.ADMIN, cooperativaId: null };
      await expect(service.create(dtoMinimo, adminOrfao)).rejects.toThrow(ForbiddenException);
    });
  });

  describe('update() — cross-tenant guard + bloqueio mudança escopo', () => {
    it('Test 8: ADMIN update() de plano de outro parceiro lança ForbiddenException', async () => {
      planoFindUnique.mockResolvedValueOnce({
        id: 'plano-B',
        cooperativaId: 'coop-B',
        ativo: true,
        publico: true,
      });
      await expect(service.update('plano-B', { nome: 'novo' }, userAdminA)).rejects.toThrow(ForbiddenException);
    });

    it('ADMIN update() bloqueia tentativa de alterar cooperativaId', async () => {
      planoFindUnique.mockResolvedValueOnce({
        id: 'plano-A',
        cooperativaId: 'coop-A',
        ativo: true,
        publico: true,
      });
      await expect(
        service.update('plano-A', { cooperativaId: 'coop-B' }, userAdminA),
      ).rejects.toThrow(ForbiddenException);
    });

    it('SUPER_ADMIN update() pode alterar cooperativaId', async () => {
      planoFindUnique.mockResolvedValueOnce({
        id: 'plano-A',
        cooperativaId: 'coop-A',
        ativo: true,
        publico: true,
      });
      planoUpdate.mockResolvedValueOnce({ id: 'plano-A', cooperativaId: 'coop-B' });
      await service.update('plano-A', { cooperativaId: 'coop-B' }, userSuper);
      const data = planoUpdate.mock.calls[0][0].data;
      expect(data.cooperativaId).toBe('coop-B');
    });
  });

  describe('remove() — cross-tenant guard + count tenant-scoped', () => {
    it('Test 9: ADMIN remove() de plano de outro parceiro lança ForbiddenException', async () => {
      planoFindUnique.mockResolvedValueOnce({
        id: 'plano-B',
        cooperativaId: 'coop-B',
        ativo: true,
        publico: true,
      });
      await expect(service.remove('plano-B', userAdminA)).rejects.toThrow(ForbiddenException);
    });

    it('ADMIN remove() conta contratos filtrando pelo próprio tenant', async () => {
      planoFindUnique.mockResolvedValueOnce({
        id: 'plano-A',
        cooperativaId: 'coop-A',
        ativo: true,
        publico: true,
      });
      contratoCount.mockResolvedValueOnce(0);
      planoDelete.mockResolvedValueOnce({});
      await service.remove('plano-A', userAdminA);
      expect(contratoCount).toHaveBeenCalledWith({
        where: {
          planoId: 'plano-A',
          status: { in: ['ATIVO', 'PENDENTE_ATIVACAO'] },
          cooperativaId: 'coop-A',
        },
      });
    });

    it('SUPER_ADMIN remove() conta contratos sem filtro de tenant', async () => {
      planoFindUnique.mockResolvedValueOnce({
        id: 'plano-A',
        cooperativaId: 'coop-A',
        ativo: true,
        publico: true,
      });
      contratoCount.mockResolvedValueOnce(0);
      planoDelete.mockResolvedValueOnce({});
      await service.remove('plano-A', userSuper);
      expect(contratoCount).toHaveBeenCalledWith({
        where: {
          planoId: 'plano-A',
          status: { in: ['ATIVO', 'PENDENTE_ATIVACAO'] },
        },
      });
    });
  });

  describe('onModuleInit() — seed', () => {
    it('Test 10: Seed onModuleInit cria FIXO_MENSAL (não COMPENSADOS) quando banco vazio', async () => {
      planoCount.mockResolvedValueOnce(0);
      planoCreate.mockResolvedValueOnce({ id: 'seed' });
      await service.onModuleInit();
      const data = planoCreate.mock.calls[0][0].data;
      expect(data.modeloCobranca).toBe(ModeloCobranca.FIXO_MENSAL);
      expect(data.modeloCobranca).not.toBe(ModeloCobranca.CREDITOS_COMPENSADOS);
      expect(data.descontoBase).toBe(20);
      expect(data.publico).toBe(true);
      expect(data.ativo).toBe(true);
      expect(data.tipoCampanha).toBe(TipoCampanha.PADRAO);
    });

    it('onModuleInit() não cria plano se banco já tem registros', async () => {
      planoCount.mockResolvedValueOnce(5);
      await service.onModuleInit();
      expect(planoCreate).not.toHaveBeenCalled();
    });
  });
});
