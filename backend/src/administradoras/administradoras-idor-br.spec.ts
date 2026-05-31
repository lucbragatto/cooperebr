import { NotFoundException } from '@nestjs/common';
import { AdministradorasService } from './administradoras.service';

/**
 * D-novo-BR F0.1 CA1+CA2 (31/05/2026) — posse antes de update/remove.
 */
describe('AdministradorasService.update/remove — F0.1 IDOR isolamento', () => {
  const admFindFirst = jest.fn();
  const admFindUnique = jest.fn();
  const admUpdate = jest.fn();

  const prismaMock = {
    administradora: {
      findFirst: admFindFirst,
      findUnique: admFindUnique,
      update: admUpdate,
    },
  } as any;

  let service: AdministradorasService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new AdministradorasService(prismaMock);
    admUpdate.mockResolvedValue({ id: 'adm1' });
  });

  describe('update (CA1)', () => {
    it('ADMIN tenant B → NotFoundException', async () => {
      admFindFirst.mockResolvedValueOnce(null);
      await expect(service.update('adm1', { nome: 'X' }, 'coop-B')).rejects.toThrow(NotFoundException);
      expect(admUpdate).not.toHaveBeenCalled();
      expect(admFindFirst).toHaveBeenCalledWith({ where: { id: 'adm1', cooperativaId: 'coop-B' } });
    });

    it('ADMIN tenant A → sucesso', async () => {
      admFindFirst.mockResolvedValueOnce({ id: 'adm1' });
      const r = await service.update('adm1', { nome: 'X' }, 'coop-A');
      expect(r.id).toBe('adm1');
    });

    it('SUPER_ADMIN (null) → bypass via findUnique', async () => {
      admFindUnique.mockResolvedValueOnce({ id: 'adm1' });
      const r = await service.update('adm1', { nome: 'X' }, null);
      expect(r.id).toBe('adm1');
      expect(admFindFirst).not.toHaveBeenCalled();
    });
  });

  describe('remove (CA2)', () => {
    it('ADMIN tenant B → NotFoundException', async () => {
      admFindFirst.mockResolvedValueOnce(null);
      await expect(service.remove('adm1', 'coop-B')).rejects.toThrow(NotFoundException);
      expect(admUpdate).not.toHaveBeenCalled();
    });

    it('ADMIN tenant A → soft-delete sucesso', async () => {
      admFindFirst.mockResolvedValueOnce({ id: 'adm1' });
      const r = await service.remove('adm1', 'coop-A');
      expect(r.id).toBe('adm1');
      expect(admUpdate).toHaveBeenCalledWith({ where: { id: 'adm1' }, data: { ativo: false } });
    });

    it('SUPER_ADMIN (null) → bypass', async () => {
      admFindUnique.mockResolvedValueOnce({ id: 'adm1' });
      const r = await service.remove('adm1', null);
      expect(r.id).toBe('adm1');
    });
  });
});
