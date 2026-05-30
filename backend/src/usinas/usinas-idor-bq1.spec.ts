import { NotFoundException } from '@nestjs/common';
import { UsinasService } from './usinas.service';

/**
 * D-novo-BQ.1 C2 + A3 (30/05/2026) — Isolamento multi-tenant
 * em PUT /usinas/:id e DELETE /usinas/:id.
 */
describe('UsinasService.update/remove — BQ.1 IDOR isolamento', () => {
  const usinaFindFirst = jest.fn();
  const usinaFindUnique = jest.fn();
  const usinaUpdate = jest.fn();
  const usinaDelete = jest.fn();
  const contratoCount = jest.fn();

  const prismaMock = {
    usina: {
      findFirst: usinaFindFirst,
      findUnique: usinaFindUnique,
      update: usinaUpdate,
      delete: usinaDelete,
    },
    contrato: { count: contratoCount },
  } as any;

  let service: UsinasService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new UsinasService(prismaMock);
    usinaUpdate.mockResolvedValue({ id: 'u1' });
    usinaDelete.mockResolvedValue({ id: 'u1' });
    contratoCount.mockResolvedValue(0);
  });

  describe('update()', () => {
    it('ADMIN tenant B → NotFoundException', async () => {
      usinaFindFirst.mockResolvedValueOnce(null);
      await expect(service.update('u1', { nome: 'X' } as any, 'coop-B')).rejects.toThrow(
        NotFoundException,
      );
      expect(usinaUpdate).not.toHaveBeenCalled();
    });

    it('ADMIN tenant A → sucesso', async () => {
      usinaFindFirst.mockResolvedValueOnce({ id: 'u1', cooperativaId: 'coop-A' });
      const r = await service.update('u1', { nome: 'X' } as any, 'coop-A');
      expect(r.id).toBe('u1');
      expect(usinaFindFirst).toHaveBeenCalledWith({
        where: { id: 'u1', cooperativaId: 'coop-A' },
      });
    });

    it('SUPER_ADMIN (null) → bypass via findUnique', async () => {
      usinaFindUnique.mockResolvedValueOnce({ id: 'u1' });
      const r = await service.update('u1', { nome: 'X' } as any, null);
      expect(r.id).toBe('u1');
      expect(usinaFindFirst).not.toHaveBeenCalled();
      expect(usinaFindUnique).toHaveBeenCalled();
    });
  });

  describe('remove()', () => {
    it('ADMIN tenant B → NotFoundException', async () => {
      usinaFindFirst.mockResolvedValueOnce(null);
      await expect(service.remove('u1', 'coop-B')).rejects.toThrow(NotFoundException);
      expect(usinaDelete).not.toHaveBeenCalled();
    });

    it('ADMIN tenant A → sucesso', async () => {
      usinaFindFirst.mockResolvedValueOnce({ id: 'u1' });
      const r = await service.remove('u1', 'coop-A');
      expect(r.id).toBe('u1');
    });

    it('SUPER_ADMIN (null) → bypass (sem findFirst)', async () => {
      const r = await service.remove('u1', null);
      expect(r.id).toBe('u1');
      expect(usinaFindFirst).not.toHaveBeenCalled();
    });
  });
});
