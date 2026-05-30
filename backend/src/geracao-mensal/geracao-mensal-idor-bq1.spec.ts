import { NotFoundException } from '@nestjs/common';
import { GeracaoMensalService } from './geracao-mensal.service';

/**
 * D-novo-BQ.1 C4 + A5 (30/05/2026) — Isolamento multi-tenant
 * em PUT /geracao-mensal/:id e DELETE /geracao-mensal/:id.
 *
 * GeracaoMensal NÃO tem cooperativaId direto — posse via join
 * `usina: { cooperativaId }`.
 */
describe('GeracaoMensalService.update/remove — BQ.1 IDOR isolamento', () => {
  const gmFindFirst = jest.fn();
  const gmFindUnique = jest.fn();
  const gmUpdate = jest.fn();
  const gmDelete = jest.fn();

  const prismaMock = {
    geracaoMensal: {
      findFirst: gmFindFirst,
      findUnique: gmFindUnique,
      update: gmUpdate,
      delete: gmDelete,
    },
  } as any;

  let service: GeracaoMensalService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new GeracaoMensalService(prismaMock);
    gmUpdate.mockResolvedValue({ id: 'g1' });
    gmDelete.mockResolvedValue({ id: 'g1' });
  });

  describe('update()', () => {
    it('ADMIN tenant B → NotFoundException (posse via usina.cooperativaId)', async () => {
      gmFindFirst.mockResolvedValueOnce(null);
      await expect(service.update('g1', { kwhGerado: 100 } as any, 'coop-B')).rejects.toThrow(
        NotFoundException,
      );
      expect(gmUpdate).not.toHaveBeenCalled();
      expect(gmFindFirst).toHaveBeenCalledWith({
        where: { id: 'g1', usina: { cooperativaId: 'coop-B' } },
        select: { id: true },
      });
    });

    it('ADMIN tenant A → sucesso (join via usina.cooperativaId)', async () => {
      gmFindFirst.mockResolvedValueOnce({ id: 'g1' });
      const r = await service.update('g1', { kwhGerado: 100 } as any, 'coop-A');
      expect(r.id).toBe('g1');
    });

    it('SUPER_ADMIN (null) → bypass via findOne legado (findUnique)', async () => {
      gmFindUnique.mockResolvedValueOnce({ id: 'g1' });
      const r = await service.update('g1', { kwhGerado: 100 } as any, null);
      expect(r.id).toBe('g1');
      expect(gmFindFirst).not.toHaveBeenCalled();
      expect(gmFindUnique).toHaveBeenCalled();
    });
  });

  describe('remove()', () => {
    it('ADMIN tenant B → NotFoundException', async () => {
      gmFindFirst.mockResolvedValueOnce(null);
      await expect(service.remove('g1', 'coop-B')).rejects.toThrow(NotFoundException);
      expect(gmDelete).not.toHaveBeenCalled();
    });

    it('ADMIN tenant A → sucesso', async () => {
      gmFindFirst.mockResolvedValueOnce({ id: 'g1' });
      const r = await service.remove('g1', 'coop-A');
      expect(r.id).toBe('g1');
    });

    it('SUPER_ADMIN (null) → bypass', async () => {
      gmFindUnique.mockResolvedValueOnce({ id: 'g1' });
      const r = await service.remove('g1', null);
      expect(r.id).toBe('g1');
      expect(gmFindFirst).not.toHaveBeenCalled();
    });
  });
});
