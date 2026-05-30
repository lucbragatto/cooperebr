import { BadRequestException } from '@nestjs/common';
import { FaturasService } from './faturas.service';

/**
 * D-novo-BQ.3 A1 (30/05/2026) — vincularFaturaManual exige fatura
 * pertencer ao tenant. SUPER_ADMIN (cooperativaId null) bypassa.
 */
describe('FaturasService.vincularFaturaManual — BQ.3 A1 IDOR', () => {
  const fatFindFirst = jest.fn();
  const fatFindUnique = jest.fn();
  const fatUpdate = jest.fn();
  const coopFindFirst = jest.fn();
  const coopUpdate = jest.fn();
  const ucFindFirst = jest.fn();

  const prismaMock = {
    faturaProcessada: { findFirst: fatFindFirst, findUnique: fatFindUnique, update: fatUpdate },
    cooperado: { findFirst: coopFindFirst, update: coopUpdate },
    uc: { findFirst: ucFindFirst },
  } as any;

  let service: FaturasService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new FaturasService(
      prismaMock,
      {} as any, {} as any, {} as any, {} as any, {} as any,
    );
    coopFindFirst.mockResolvedValue({ id: 'coop1', nomeCompleto: 'X' });
    ucFindFirst.mockResolvedValue(null);
    fatUpdate.mockResolvedValue({ id: 'fat1' });
    coopUpdate.mockResolvedValue({ id: 'coop1' });
  });

  it('ADMIN tenant B tentando vincular fatura tenant A → BadRequest', async () => {
    fatFindFirst.mockResolvedValueOnce(null);
    await expect(
      service.vincularFaturaManual('fat1', 'coop1', 'coop-B'),
    ).rejects.toThrow(BadRequestException);
    expect(fatFindFirst).toHaveBeenCalledWith({
      where: { id: 'fat1', cooperativaId: 'coop-B' },
    });
    expect(fatUpdate).not.toHaveBeenCalled();
  });

  it('ADMIN tenant A vinculando própria fatura → sucesso', async () => {
    fatFindFirst.mockResolvedValueOnce({ id: 'fat1', dadosExtraidos: {} });
    const r = await service.vincularFaturaManual('fat1', 'coop1', 'coop-A');
    expect(r.id).toBe('fat1');
    expect(fatUpdate).toHaveBeenCalled();
  });

  it('SUPER_ADMIN (null) → bypass via findUnique', async () => {
    fatFindUnique.mockResolvedValueOnce({ id: 'fat1', dadosExtraidos: {} });
    const r = await service.vincularFaturaManual('fat1', 'coop1', null);
    expect(r.id).toBe('fat1');
    expect(fatFindFirst).not.toHaveBeenCalled();
    expect(fatFindUnique).toHaveBeenCalled();
  });
});
