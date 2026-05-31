import { NotFoundException } from '@nestjs/common';
import { CondominiosService } from './condominios.service';

/**
 * D-novo-BR F0.4 BA1 (31/05/2026) — calcularRateio bloqueia leitura cross-tenant.
 */
describe('CondominiosService.calcularRateio — F0.4 BA1 IDOR', () => {
  const condFindFirst = jest.fn();
  const condFindUnique = jest.fn();

  const prismaMock = {
    condominio: { findFirst: condFindFirst, findUnique: condFindUnique },
  } as any;

  let service: CondominiosService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new CondominiosService(prismaMock);
  });

  it('ADMIN tenant B → NotFoundException (não vaza nomes/cotas)', async () => {
    condFindFirst.mockResolvedValueOnce(null);
    await expect(service.calcularRateio('c1', 100, 'coop-B')).rejects.toThrow(NotFoundException);
  });

  it('ADMIN tenant A → calcula rateio próprio', async () => {
    condFindFirst.mockResolvedValueOnce({
      modeloRateio: 'IGUALITARIO',
      unidades: [{ id: 'u1', numero: '1', cooperado: { id: 'c1', nomeCompleto: 'X', cotaKwhMensal: 100 } }],
    });
    const r = await service.calcularRateio('c1', 100, 'coop-A');
    expect(r).toHaveLength(1);
  });

  it('SUPER_ADMIN (null) → bypass via findUnique', async () => {
    condFindUnique.mockResolvedValueOnce({
      modeloRateio: 'IGUALITARIO',
      unidades: [{ id: 'u1', numero: '1', cooperado: null }],
    });
    const r = await service.calcularRateio('c1', 100, null);
    expect(condFindFirst).not.toHaveBeenCalled();
    expect(r).toHaveLength(1);
  });
});
