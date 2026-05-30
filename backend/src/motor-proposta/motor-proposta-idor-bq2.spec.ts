import { NotFoundException } from '@nestjs/common';
import { MotorPropostaService } from './motor-proposta.service';

/**
 * D-novo-BQ.2 C7 (30/05/2026) — aprovarPresencial verifica posse via cooperado.
 * SUPER_ADMIN (cooperativaId null) bypassa via findUnique.
 */
describe('MotorPropostaService.aprovarPresencial — BQ.2 IDOR posse via cooperado', () => {
  const propFindFirst = jest.fn();
  const propFindUnique = jest.fn();
  const propUpdate = jest.fn();

  const prismaMock = {
    propostaCooperado: {
      findFirst: propFindFirst,
      findUnique: propFindUnique,
      update: propUpdate,
    },
  } as any;

  let service: MotorPropostaService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new MotorPropostaService(
      prismaMock,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
    );
    propUpdate.mockResolvedValue({ id: 'p1', status: 'ACEITA' });
  });

  it('ADMIN tenant B aprovando proposta tenant A → NotFoundException', async () => {
    propFindFirst.mockResolvedValueOnce(null); // posse via cooperado.cooperativaId=B falha
    await expect(service.aprovarPresencial('p1', 'coop-B')).rejects.toThrow(NotFoundException);
    expect(propUpdate).not.toHaveBeenCalled();
    expect(propFindFirst).toHaveBeenCalledWith({
      where: { id: 'p1', cooperado: { cooperativaId: 'coop-B' } },
      select: { id: true },
    });
  });

  it('ADMIN tenant A aprovando própria → sucesso', async () => {
    propFindFirst.mockResolvedValueOnce({ id: 'p1' });
    const r = await service.aprovarPresencial('p1', 'coop-A');
    expect(r.sucesso).toBe(true);
    expect(r.status).toBe('ACEITA');
    expect(propUpdate).toHaveBeenCalled();
  });

  it('SUPER_ADMIN (null) → bypass via findUnique', async () => {
    propFindUnique.mockResolvedValueOnce({ id: 'p1' });
    const r = await service.aprovarPresencial('p1', null);
    expect(r.sucesso).toBe(true);
    expect(propFindFirst).not.toHaveBeenCalled();
    expect(propFindUnique).toHaveBeenCalled();
  });
});
