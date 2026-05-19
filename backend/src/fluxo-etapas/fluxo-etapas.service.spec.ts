import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { FluxoEtapasService } from './fluxo-etapas.service';

describe('FluxoEtapasService — isolamento multi-tenant', () => {
  let service: FluxoEtapasService;
  const etapaFindMany = jest.fn();
  const etapaFindUnique = jest.fn();
  const etapaCreate = jest.fn();
  const etapaUpdate = jest.fn();
  const etapaDelete = jest.fn();
  const modeloFindMany = jest.fn();

  const prismaMock: any = {
    fluxoEtapa: {
      findMany: etapaFindMany,
      findUnique: etapaFindUnique,
      create: etapaCreate,
      update: etapaUpdate,
      delete: etapaDelete,
    },
    modeloMensagem: {
      findMany: modeloFindMany,
    },
  };

  beforeEach(() => {
    jest.clearAllMocks();
    service = new FluxoEtapasService(prismaMock);
  });

  describe('findAll()', () => {
    it('SUPER_ADMIN não filtra por cooperativaId', async () => {
      etapaFindMany.mockResolvedValueOnce([]);
      await service.findAll(undefined);
      const arg = etapaFindMany.mock.calls[0][0];
      expect(arg.where).not.toHaveProperty('cooperativaId');
      expect(arg.where).not.toHaveProperty('OR');
    });

    it('Tenant filtra por OR [próprio + globais]', async () => {
      etapaFindMany.mockResolvedValueOnce([]);
      await service.findAll('coop-A');
      const arg = etapaFindMany.mock.calls[0][0];
      expect(arg.where).toMatchObject({
        OR: [{ cooperativaId: 'coop-A' }, { cooperativaId: null }],
      });
    });

    it('Lead anônimo (null) só vê etapas globais', async () => {
      etapaFindMany.mockResolvedValueOnce([]);
      await service.findAll(null);
      const arg = etapaFindMany.mock.calls[0][0];
      expect(arg.where).toMatchObject({ cooperativaId: null });
    });

    it('Hidratação de modelo respeita escopo (não vaza modelo de outro tenant)', async () => {
      etapaFindMany.mockResolvedValueOnce([
        { id: 'e1', modeloMensagemId: 'm1', cooperativaId: 'coop-A' },
      ]);
      modeloFindMany.mockResolvedValueOnce([]);
      await service.findAll('coop-A');
      const modeloArg = modeloFindMany.mock.calls[0][0];
      expect(modeloArg.where).toMatchObject({
        id: { in: ['m1'] },
        OR: [{ cooperativaId: 'coop-A' }, { cooperativaId: null }],
      });
    });
  });

  describe('findOne() / update() / delete()', () => {
    it('findOne bloqueia acesso a etapa de outro tenant', async () => {
      etapaFindUnique.mockResolvedValueOnce({ id: 'e1', cooperativaId: 'coop-B' });
      await expect(service.findOne('e1', 'coop-A')).rejects.toBeInstanceOf(
        ForbiddenException,
      );
    });

    it('update bloqueia se etapa pertence a outro tenant', async () => {
      etapaFindUnique.mockResolvedValueOnce({ id: 'e1', cooperativaId: 'coop-B' });
      await expect(
        service.update('e1', { nome: 'novo' }, 'coop-A'),
      ).rejects.toBeInstanceOf(ForbiddenException);
      expect(etapaUpdate).not.toHaveBeenCalled();
    });

    it('delete bloqueia se etapa pertence a outro tenant', async () => {
      etapaFindUnique.mockResolvedValueOnce({ id: 'e1', cooperativaId: 'coop-B' });
      await expect(service.delete('e1', 'coop-A')).rejects.toBeInstanceOf(
        ForbiddenException,
      );
      expect(etapaDelete).not.toHaveBeenCalled();
    });

    it('findOne 404 quando etapa não existe', async () => {
      etapaFindUnique.mockResolvedValueOnce(null);
      await expect(service.findOne('nope', 'coop-A')).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });
  });

  describe('create()', () => {
    it('Admin de tenant força cooperativaId mesmo se body tentar burlar', async () => {
      etapaCreate.mockResolvedValueOnce({});
      await service.create(
        {
          cooperativaId: 'coop-B',
          nome: 'x',
          ordem: 1,
          estado: 'X',
          gatilhos: [],
        },
        'coop-A',
      );
      expect(etapaCreate).toHaveBeenCalledWith({
        data: expect.objectContaining({ cooperativaId: 'coop-A' }),
      });
    });
  });
});
