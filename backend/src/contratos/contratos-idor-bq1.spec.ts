import { NotFoundException } from '@nestjs/common';
import { ContratosService } from './contratos.service';

/**
 * D-novo-BQ.1 C1 (30/05/2026) — Isolamento multi-tenant em PUT /contratos/:id.
 *
 * Cenários:
 *   - ADMIN tenant B tentando update de contrato tenant A → NotFoundException
 *   - ADMIN tenant A update do próprio contrato → sucesso
 *   - SUPER_ADMIN (cooperativaId null) update qualquer → sucesso (bypass)
 */
describe('ContratosService.update — BQ.1 IDOR isolamento', () => {
  const contratoFindFirst = jest.fn();
  const contratoUpdate = jest.fn();

  const prismaMock = {
    contrato: {
      findFirst: contratoFindFirst,
      findUnique: jest.fn(),
      update: contratoUpdate,
    },
  } as any;

  let service: ContratosService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new ContratosService(prismaMock, {} as any, {} as any);
    contratoUpdate.mockResolvedValue({ id: 'c1', status: 'ATIVO' });
  });

  it('ADMIN tenant B tentando update de contrato tenant A → NotFoundException', async () => {
    contratoFindFirst.mockResolvedValueOnce(null); // posse negada

    await expect(
      service.update('c1', { status: 'ENCERRADO' } as any, 'coop-B'),
    ).rejects.toThrow(NotFoundException);
    expect(contratoUpdate).not.toHaveBeenCalled();
    expect(contratoFindFirst).toHaveBeenCalledWith({
      where: { id: 'c1', cooperativaId: 'coop-B' },
      select: { id: true },
    });
  });

  it('ADMIN tenant A update do próprio contrato → sucesso', async () => {
    contratoFindFirst.mockResolvedValueOnce({ id: 'c1' });

    const r = await service.update('c1', { status: 'ENCERRADO' } as any, 'coop-A');

    expect(r.id).toBe('c1');
    expect(contratoFindFirst).toHaveBeenCalledWith({
      where: { id: 'c1', cooperativaId: 'coop-A' },
      select: { id: true },
    });
    expect(contratoUpdate).toHaveBeenCalled();
  });

  it('SUPER_ADMIN (cooperativaId null) → bypass tenant guard (sem findFirst)', async () => {
    const r = await service.update('c1', { status: 'ATIVO' } as any, null);

    expect(r.id).toBe('c1');
    expect(contratoFindFirst).not.toHaveBeenCalled(); // guard bypassed
    expect(contratoUpdate).toHaveBeenCalled();
  });
});
