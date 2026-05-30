import { NotFoundException } from '@nestjs/common';
import { UcsService } from './ucs.service';

/**
 * D-novo-BQ.1 C3 + A4 (30/05/2026) — Isolamento multi-tenant
 * em PUT /ucs/:id e DELETE /ucs/:id.
 */
describe('UcsService.update/remove — BQ.1 IDOR isolamento', () => {
  const ucFindFirst = jest.fn();
  const ucUpdate = jest.fn();
  const ucDelete = jest.fn();
  const contratoCount = jest.fn();

  const prismaMock = {
    uc: {
      findFirst: ucFindFirst,
      update: ucUpdate,
      delete: ucDelete,
    },
    contrato: { count: contratoCount },
  } as any;

  let service: UcsService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new UcsService(prismaMock);
    ucUpdate.mockResolvedValue({ id: 'uc1' });
    ucDelete.mockResolvedValue({ id: 'uc1' });
    contratoCount.mockResolvedValue(0);
  });

  describe('update()', () => {
    it('ADMIN tenant B → NotFoundException', async () => {
      ucFindFirst.mockResolvedValueOnce(null);
      await expect(service.update('uc1', { endereco: 'X' } as any, 'coop-B')).rejects.toThrow(
        NotFoundException,
      );
      expect(ucUpdate).not.toHaveBeenCalled();
    });

    it('ADMIN tenant A → sucesso', async () => {
      ucFindFirst.mockResolvedValueOnce({ id: 'uc1' });
      const r = await service.update('uc1', { endereco: 'X' } as any, 'coop-A');
      expect(r.id).toBe('uc1');
      expect(ucFindFirst).toHaveBeenCalledWith({
        where: { id: 'uc1', cooperativaId: 'coop-A' },
        select: { id: true },
      });
    });

    it('SUPER_ADMIN (null) → bypass (sem findFirst)', async () => {
      const r = await service.update('uc1', { endereco: 'X' } as any, null);
      expect(r.id).toBe('uc1');
      expect(ucFindFirst).not.toHaveBeenCalled();
    });
  });

  describe('remove()', () => {
    it('ADMIN tenant B → NotFoundException', async () => {
      ucFindFirst.mockResolvedValueOnce(null);
      await expect(service.remove('uc1', 'coop-B')).rejects.toThrow(NotFoundException);
      expect(ucDelete).not.toHaveBeenCalled();
    });

    it('ADMIN tenant A → sucesso', async () => {
      ucFindFirst.mockResolvedValueOnce({ id: 'uc1' });
      const r = await service.remove('uc1', 'coop-A');
      expect(r.id).toBe('uc1');
    });

    it('SUPER_ADMIN (null) → bypass (sem findFirst)', async () => {
      const r = await service.remove('uc1', null);
      expect(r.id).toBe('uc1');
      expect(ucFindFirst).not.toHaveBeenCalled();
    });
  });
});
