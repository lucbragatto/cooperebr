import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { ModelosMensagemService } from './modelos-mensagem.service';

describe('ModelosMensagemService — isolamento multi-tenant', () => {
  let service: ModelosMensagemService;
  const findMany = jest.fn();
  const findUnique = jest.fn();
  const create = jest.fn();
  const update = jest.fn();
  const remove = jest.fn();

  const prismaMock: any = {
    modeloMensagem: {
      findMany,
      findUnique,
      create,
      update,
      delete: remove,
    },
  };

  beforeEach(() => {
    jest.clearAllMocks();
    service = new ModelosMensagemService(prismaMock);
  });

  describe('findAll()', () => {
    it('SUPER_ADMIN (escopo=undefined) não filtra por cooperativaId', async () => {
      findMany.mockResolvedValueOnce([]);
      await service.findAll(undefined, undefined);
      const arg = findMany.mock.calls[0][0];
      expect(arg.where).not.toHaveProperty('cooperativaId');
      expect(arg.where).not.toHaveProperty('OR');
    });

    it('Tenant (escopo="coop-A") filtra por OR [tenant + null]', async () => {
      findMany.mockResolvedValueOnce([]);
      await service.findAll(undefined, 'coop-A');
      const arg = findMany.mock.calls[0][0];
      expect(arg.where).toMatchObject({
        OR: [{ cooperativaId: 'coop-A' }, { cooperativaId: null }],
      });
    });

    it('Lead anônimo (escopo=null) vê APENAS templates globais', async () => {
      findMany.mockResolvedValueOnce([]);
      await service.findAll(undefined, null);
      const arg = findMany.mock.calls[0][0];
      expect(arg.where).toMatchObject({ cooperativaId: null });
      expect(arg.where).not.toHaveProperty('OR');
    });

    it('Filtro de categoria coexiste com filtro tenant', async () => {
      findMany.mockResolvedValueOnce([]);
      await service.findAll('COBRANCA', 'coop-A');
      const arg = findMany.mock.calls[0][0];
      expect(arg.where).toMatchObject({
        categoria: 'COBRANCA',
        OR: [{ cooperativaId: 'coop-A' }, { cooperativaId: null }],
      });
    });
  });

  describe('findOne()', () => {
    it('Admin do tenant A NÃO acessa modelo do tenant B', async () => {
      findUnique.mockResolvedValueOnce({ id: 'm1', cooperativaId: 'coop-B' });
      await expect(service.findOne('m1', 'coop-A')).rejects.toBeInstanceOf(
        ForbiddenException,
      );
    });

    it('Admin do tenant A acessa modelo global (cooperativaId=null)', async () => {
      findUnique.mockResolvedValueOnce({ id: 'm1', cooperativaId: null });
      await expect(service.findOne('m1', 'coop-A')).resolves.toBeDefined();
    });

    it('Admin do tenant A acessa modelo do próprio tenant', async () => {
      findUnique.mockResolvedValueOnce({ id: 'm1', cooperativaId: 'coop-A' });
      await expect(service.findOne('m1', 'coop-A')).resolves.toBeDefined();
    });

    it('SUPER_ADMIN acessa qualquer modelo', async () => {
      findUnique.mockResolvedValueOnce({ id: 'm1', cooperativaId: 'coop-B' });
      await expect(service.findOne('m1', undefined)).resolves.toBeDefined();
    });

    it('Lança 404 quando modelo não existe', async () => {
      findUnique.mockResolvedValueOnce(null);
      await expect(service.findOne('nao-existe', 'coop-A')).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });
  });

  describe('create()', () => {
    it('Admin de tenant força cooperativaId mesmo se body tentar burlar', async () => {
      create.mockResolvedValueOnce({});
      await service.create(
        { cooperativaId: 'coop-B', nome: 'x', categoria: 'BOT', conteudo: 'y' },
        'coop-A',
      );
      expect(create).toHaveBeenCalledWith({
        data: expect.objectContaining({ cooperativaId: 'coop-A' }),
      });
    });

    it('SUPER_ADMIN respeita cooperativaId do body (pode criar global ou em qualquer tenant)', async () => {
      create.mockResolvedValueOnce({});
      await service.create(
        { cooperativaId: null, nome: 'x', categoria: 'BOT', conteudo: 'y' },
        undefined,
      );
      expect(create).toHaveBeenCalledWith({
        data: expect.objectContaining({ cooperativaId: null }),
      });
    });
  });

  describe('update() / delete()', () => {
    it('update bloqueia se modelo é de outro tenant', async () => {
      findUnique.mockResolvedValueOnce({ id: 'm1', cooperativaId: 'coop-B' });
      await expect(
        service.update('m1', { nome: 'novo' }, 'coop-A'),
      ).rejects.toBeInstanceOf(ForbiddenException);
      expect(update).not.toHaveBeenCalled();
    });

    it('delete bloqueia se modelo é de outro tenant', async () => {
      findUnique.mockResolvedValueOnce({ id: 'm1', cooperativaId: 'coop-B' });
      await expect(service.delete('m1', 'coop-A')).rejects.toBeInstanceOf(
        ForbiddenException,
      );
      expect(remove).not.toHaveBeenCalled();
    });
  });
});
