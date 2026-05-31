import { BadRequestException } from '@nestjs/common';
import { ObservadorService } from './observador.service';

/**
 * D-novo-BR F0.4 AA12 (31/05/2026) — encerrar valida posse.
 */
describe('ObservadorService.encerrar — F0.4 AA12 IDOR', () => {
  const obsFindFirst = jest.fn();
  const obsFindUnique = jest.fn();
  const obsUpdate = jest.fn().mockResolvedValue({});
  const logCreate = jest.fn().mockResolvedValue({});
  const enviarMensagem = jest.fn().mockResolvedValue({});

  const prismaMock = {
    observacaoAtiva: { findFirst: obsFindFirst, findUnique: obsFindUnique, update: obsUpdate },
    logObservacao: { create: logCreate },
  } as any;

  const senderMock = { enviarMensagem } as any;

  let service: ObservadorService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new ObservadorService(prismaMock, senderMock);
  });

  it('ADMIN tenant B → BadRequestException (posse negada)', async () => {
    obsFindFirst.mockResolvedValueOnce(null);
    await expect(service.encerrar('o1', 'u1', 'coop-B')).rejects.toThrow(BadRequestException);
    expect(obsUpdate).not.toHaveBeenCalled();
  });

  it('ADMIN tenant A → encerra própria observação', async () => {
    obsFindFirst.mockResolvedValueOnce({ id: 'o1', cooperativaId: 'coop-A', observadorTelefone: '27', observadoTelefone: '28' });
    const r = await service.encerrar('o1', 'u1', 'coop-A');
    expect(r.ok).toBe(true);
    expect(obsUpdate).toHaveBeenCalled();
  });

  it('SUPER_ADMIN (null) → bypass via findUnique', async () => {
    obsFindUnique.mockResolvedValueOnce({ id: 'o1', cooperativaId: 'qq', observadorTelefone: '27', observadoTelefone: '28' });
    const r = await service.encerrar('o1', 'u1', null);
    expect(r.ok).toBe(true);
    expect(obsFindFirst).not.toHaveBeenCalled();
  });
});
