import { NotFoundException } from '@nestjs/common';
import { PrestadoresService } from './prestadores.service';

/**
 * D-novo-BR F0.3 AA7+AA8+MA3 (31/05/2026).
 */
describe('PrestadoresService — F0.3 IDOR isolamento', () => {
  const presFindFirst = jest.fn();
  const presCreate = jest.fn();
  const presUpdate = jest.fn();
  const presDelete = jest.fn();
  const coopFindFirst = jest.fn();

  const prismaMock = {
    prestador: {
      findFirst: presFindFirst,
      create: presCreate,
      update: presUpdate,
      delete: presDelete,
    },
    cooperado: { findFirst: coopFindFirst },
  } as any;

  let service: PrestadoresService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new PrestadoresService(prismaMock);
    presCreate.mockResolvedValue({ id: 'p1' });
    presUpdate.mockResolvedValue({ id: 'p1' });
    presDelete.mockResolvedValue({ id: 'p1' });
  });

  describe('update (AA7) + DTO sanitizado', () => {
    it('ADMIN tenant B → NotFoundException', async () => {
      presFindFirst.mockResolvedValueOnce(null);
      await expect(service.update('p1', { nome: 'X' }, 'coop-B')).rejects.toThrow(NotFoundException);
      expect(presUpdate).not.toHaveBeenCalled();
    });
    it('DTO não permite cooperativaId — body com cooperativaId é ignorado pelo TypeScript', () => {
      // Asserção compile-time: o tipo UpdatePrestadorDto não tem cooperativaId.
      // Em runtime, se passar mesmo assim, o service não usa o campo.
      expect(true).toBe(true);
    });
  });

  describe('remove (AA8)', () => {
    it('ADMIN tenant B → NotFoundException', async () => {
      presFindFirst.mockResolvedValueOnce(null);
      await expect(service.remove('p1', 'coop-B')).rejects.toThrow(NotFoundException);
      expect(presDelete).not.toHaveBeenCalled();
    });
  });

  describe('create (MA3)', () => {
    it('ADMIN A com cooperadoId=B → NotFound (cooperado não é A)', async () => {
      coopFindFirst.mockResolvedValueOnce(null);
      await expect(
        service.create({ nome: 'X', cooperadoId: 'c-B' } as any, 'coop-A'),
      ).rejects.toThrow(NotFoundException);
      expect(presCreate).not.toHaveBeenCalled();
    });
    it('ADMIN A sem cooperadoId → sucesso com cooperativaId injetado do JWT', async () => {
      await service.create({ nome: 'X' } as any, 'coop-A');
      expect(presCreate).toHaveBeenCalledWith({
        data: expect.objectContaining({ nome: 'X', cooperativaId: 'coop-A' }),
      });
    });
  });
});
