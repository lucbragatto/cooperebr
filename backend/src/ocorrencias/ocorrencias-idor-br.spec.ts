import { NotFoundException } from '@nestjs/common';
import { OcorrenciasService } from './ocorrencias.service';

/**
 * D-novo-BR F0.3 AA5+AA6+MA2 (31/05/2026).
 */
describe('OcorrenciasService — F0.3 IDOR isolamento', () => {
  const ocoFindFirst = jest.fn();
  const ocoCreate = jest.fn();
  const ocoUpdate = jest.fn();
  const ocoDelete = jest.fn();
  const coopFindFirst = jest.fn();

  const prismaMock = {
    ocorrencia: {
      findFirst: ocoFindFirst,
      create: ocoCreate,
      update: ocoUpdate,
      delete: ocoDelete,
    },
    cooperado: { findFirst: coopFindFirst },
  } as any;

  let service: OcorrenciasService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new OcorrenciasService(prismaMock);
    ocoCreate.mockResolvedValue({ id: 'o1' });
    ocoUpdate.mockResolvedValue({ id: 'o1' });
    ocoDelete.mockResolvedValue({ id: 'o1' });
  });

  describe('update (AA5)', () => {
    it('ADMIN tenant B → NotFoundException', async () => {
      ocoFindFirst.mockResolvedValueOnce(null);
      await expect(service.update('o1', { descricao: 'x' }, 'coop-B')).rejects.toThrow(NotFoundException);
      expect(ocoUpdate).not.toHaveBeenCalled();
    });
    it('ADMIN tenant A → sucesso', async () => {
      ocoFindFirst.mockResolvedValueOnce({ id: 'o1' });
      await service.update('o1', { descricao: 'x' }, 'coop-A');
      expect(ocoUpdate).toHaveBeenCalled();
    });
  });

  describe('remove (AA6)', () => {
    it('ADMIN tenant B → NotFoundException', async () => {
      ocoFindFirst.mockResolvedValueOnce(null);
      await expect(service.remove('o1', 'coop-B')).rejects.toThrow(NotFoundException);
      expect(ocoDelete).not.toHaveBeenCalled();
    });
  });

  describe('create (MA2)', () => {
    it('COOPERADO/ADMIN A tentando criar ocorrência pra cooperado B → NotFound', async () => {
      coopFindFirst.mockResolvedValueOnce(null);
      await expect(
        service.create({ cooperadoId: 'c-B', tipo: 'OUTROS', descricao: 'x', prioridade: 'BAIXA' }, 'coop-A'),
      ).rejects.toThrow(NotFoundException);
      expect(ocoCreate).not.toHaveBeenCalled();
    });

    it('ADMIN A cria pra cooperado próprio → sucesso (cooperativaId injetado)', async () => {
      coopFindFirst.mockResolvedValueOnce({ id: 'c-A' });
      await service.create({ cooperadoId: 'c-A', tipo: 'OUTROS', descricao: 'x', prioridade: 'BAIXA' }, 'coop-A');
      expect(ocoCreate).toHaveBeenCalledWith({
        data: expect.objectContaining({ cooperadoId: 'c-A', cooperativaId: 'coop-A' }),
      });
    });
  });
});
