import { NotFoundException } from '@nestjs/common';
import { MotorPropostaService } from './motor-proposta.service';

/**
 * D-novo-BQ.3 A7 + A8 (30/05/2026).
 * A7 — enviarAprovacao verifica posse via cooperado (previne sequestro de tokenAprovacao).
 * A8 — uploadModelo controller-side (testado em outro spec) — aqui só A7.
 */
describe('MotorPropostaService.enviarAprovacao — BQ.3 A7 IDOR', () => {
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
      {} as any, {} as any, {} as any, {} as any, {} as any, {} as any, {} as any, {} as any, {} as any,
      {} as any, // D-FISCAL-2.4.3: ConveniosMembrosService
    );
    propUpdate.mockResolvedValue({ id: 'p1' });
  });

  it('ADMIN tenant B tentando enviar aprovação de proposta A → NotFoundException', async () => {
    propFindFirst.mockResolvedValueOnce(null);
    await expect(
      service.enviarAprovacao('p1', 'whatsapp', '5527981341348', 'coop-B'),
    ).rejects.toThrow(NotFoundException);
    expect(propUpdate).not.toHaveBeenCalled();
    expect(propFindFirst).toHaveBeenCalledWith({
      where: { id: 'p1', cooperado: { cooperativaId: 'coop-B' } },
      include: expect.any(Object),
    });
  });

  it('ADMIN tenant A enviando aprovação própria → sucesso (token gerado)', async () => {
    propFindFirst.mockResolvedValueOnce({
      id: 'p1',
      cooperado: { nomeCompleto: 'X' },
    });
    const r = await service.enviarAprovacao('p1', 'whatsapp', '5527981341348', 'coop-A');
    expect(r.sucesso).toBe(true);
    expect(r.token).toBeDefined();
    expect(propUpdate).toHaveBeenCalled();
  });

  it('SUPER_ADMIN (null) → bypass via findUnique', async () => {
    propFindUnique.mockResolvedValueOnce({
      id: 'p1',
      cooperado: { nomeCompleto: 'X' },
    });
    const r = await service.enviarAprovacao('p1', 'email', 'lucbragatto@gmail.com', null);
    expect(r.sucesso).toBe(true);
    expect(propFindFirst).not.toHaveBeenCalled();
    expect(propFindUnique).toHaveBeenCalled();
  });
});
