import { NotFoundException } from '@nestjs/common';
import { CooperadosService } from './cooperados.service';

/**
 * D-novo-BQ.3 A2 + M1 (30/05/2026) — cooperado precisa pertencer ao tenant
 * em registrarFaturaMensal e alocarUsina. SUPER_ADMIN (null) bypassa.
 */
describe('CooperadosService — BQ.3 A2 + M1 IDOR isolamento', () => {
  const coopFindFirst = jest.fn();
  const coopFindUnique = jest.fn();
  const usinaFindUnique = jest.fn();
  const contratoAggregate = jest.fn();
  const fatFindFirst = jest.fn();

  const prismaMock = {
    cooperado: { findFirst: coopFindFirst, findUnique: coopFindUnique },
    usina: { findUnique: usinaFindUnique },
    contrato: { aggregate: contratoAggregate },
    faturaProcessada: { findFirst: fatFindFirst },
  } as any;

  let service: CooperadosService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new CooperadosService(
      prismaMock,
      {} as any, {} as any, {} as any, {} as any, {} as any, {} as any,
    );
  });

  describe('registrarFaturaMensal (A2)', () => {
    it('ADMIN tenant B → NotFoundException', async () => {
      coopFindFirst.mockResolvedValueOnce(null);
      await expect(
        service.registrarFaturaMensal('coop1', { mesReferencia: 5, anoReferencia: 2026, dadosOcr: {} } as any, 'coop-B'),
      ).rejects.toThrow(NotFoundException);
      expect(coopFindFirst).toHaveBeenCalledWith({
        where: { id: 'coop1', cooperativaId: 'coop-B' },
      });
    });

    it('SUPER_ADMIN (null) → bypass via findUnique', async () => {
      coopFindUnique.mockResolvedValueOnce(null);
      await expect(
        service.registrarFaturaMensal('coop1', { mesReferencia: 5, anoReferencia: 2026, dadosOcr: {} } as any, null),
      ).rejects.toThrow(NotFoundException);
      expect(coopFindFirst).not.toHaveBeenCalled();
      expect(coopFindUnique).toHaveBeenCalled();
    });
  });

  describe('alocarUsina (M1)', () => {
    it('ADMIN tenant B → NotFoundException (não vaza nome/UC/consumo)', async () => {
      coopFindFirst.mockResolvedValueOnce(null);
      await expect(service.alocarUsina('coop1', 'u1', 'coop-B')).rejects.toThrow(NotFoundException);
      expect(coopFindFirst).toHaveBeenCalledWith({
        where: { id: 'coop1', cooperativaId: 'coop-B' },
        include: expect.any(Object),
      });
    });

    it('SUPER_ADMIN (null) → bypass via findUnique', async () => {
      coopFindUnique.mockResolvedValueOnce(null);
      await expect(service.alocarUsina('coop1', 'u1', null)).rejects.toThrow(NotFoundException);
      expect(coopFindFirst).not.toHaveBeenCalled();
      expect(coopFindUnique).toHaveBeenCalled();
    });
  });
});
