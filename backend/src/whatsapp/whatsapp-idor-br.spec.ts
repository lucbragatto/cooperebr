import { NotFoundException, ForbiddenException } from '@nestjs/common';
import { ModeloMensagemService } from './modelo-mensagem.service';

/**
 * D-novo-BR F0.5 CRITICO (31/05/2026) — DELETE /whatsapp/modelos/:id:
 * modelo global (null) só SUPER_ADMIN; tenant-scoped só dono.
 */
describe('ModeloMensagemService.delete — F0.5 CRITICO', () => {
  const modFindUnique = jest.fn();
  const modDelete = jest.fn();

  const prismaMock = {
    modeloMensagem: { findUnique: modFindUnique, delete: modDelete },
  } as any;

  let service: ModeloMensagemService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new ModeloMensagemService(prismaMock);
    modDelete.mockResolvedValue({ id: 'm1' });
  });

  it('modelo GLOBAL (null) + ADMIN → ForbiddenException', async () => {
    modFindUnique.mockResolvedValueOnce({ id: 'm1', cooperativaId: null });
    await expect(service.delete('m1', 'coop-A', false)).rejects.toThrow(ForbiddenException);
    expect(modDelete).not.toHaveBeenCalled();
  });

  it('modelo GLOBAL + SUPER_ADMIN → autoriza delete', async () => {
    modFindUnique.mockResolvedValueOnce({ id: 'm1', cooperativaId: null });
    await service.delete('m1', null, true);
    expect(modDelete).toHaveBeenCalled();
  });

  it('modelo tenant-scoped + ADMIN B → NotFound', async () => {
    modFindUnique.mockResolvedValueOnce({ id: 'm1', cooperativaId: 'coop-A' });
    await expect(service.delete('m1', 'coop-B', false)).rejects.toThrow(NotFoundException);
  });

  it('modelo tenant-scoped + ADMIN dono → delete', async () => {
    modFindUnique.mockResolvedValueOnce({ id: 'm1', cooperativaId: 'coop-A' });
    await service.delete('m1', 'coop-A', false);
    expect(modDelete).toHaveBeenCalled();
  });

  it('modelo inexistente → NotFound', async () => {
    modFindUnique.mockResolvedValueOnce(null);
    await expect(service.delete('inex', 'coop-A', false)).rejects.toThrow(NotFoundException);
  });
});
