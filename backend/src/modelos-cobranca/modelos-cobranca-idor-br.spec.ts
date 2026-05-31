import { NotFoundException, ForbiddenException } from '@nestjs/common';
import { ModelosCobrancaService } from './modelos-cobranca.service';

/**
 * D-novo-BR F0.1 AA9+AA10+AA11 (31/05/2026):
 * - Tenant-scoped: ADMIN só toca o próprio; SA bypass.
 * - GLOBAL (cooperativaId null): SOMENTE SUPER_ADMIN pode alterar (impacto sistêmico).
 */
describe('ModelosCobrancaService — F0.1 IDOR + global-only-SA', () => {
  const modFindUnique = jest.fn();
  const modUpdate = jest.fn();

  const prismaMock = {
    modeloCobrancaConfig: {
      findUnique: modFindUnique,
      update: modUpdate,
    },
  } as any;

  let service: ModelosCobrancaService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new ModelosCobrancaService(prismaMock);
    modUpdate.mockResolvedValue({ id: 'mod1' });
  });

  it('update — modelo tenant-scoped, ADMIN B → NotFound', async () => {
    modFindUnique.mockResolvedValueOnce({ id: 'mod1', cooperativaId: 'coop-A' });
    await expect(service.update('mod1', { nome: 'X' }, 'coop-B', false)).rejects.toThrow(NotFoundException);
    expect(modUpdate).not.toHaveBeenCalled();
  });

  it('update — modelo tenant-scoped, ADMIN A próprio → sucesso', async () => {
    modFindUnique.mockResolvedValueOnce({ id: 'mod1', cooperativaId: 'coop-A' });
    const r = await service.update('mod1', { nome: 'X' }, 'coop-A', false);
    expect(r.id).toBe('mod1');
  });

  it('update — modelo GLOBAL (null), ADMIN A → ForbiddenException (impacto sistêmico)', async () => {
    modFindUnique.mockResolvedValueOnce({ id: 'mod1', cooperativaId: null });
    await expect(service.update('mod1', { nome: 'X' }, 'coop-A', false)).rejects.toThrow(ForbiddenException);
    expect(modUpdate).not.toHaveBeenCalled();
  });

  it('update — modelo GLOBAL (null), SUPER_ADMIN → sucesso (autorizado)', async () => {
    modFindUnique.mockResolvedValueOnce({ id: 'mod1', cooperativaId: null });
    const r = await service.update('mod1', { nome: 'X' }, null, true);
    expect(r.id).toBe('mod1');
  });

  it('desativar AA11 — modelo GLOBAL, ADMIN → ForbiddenException (não pode desativar global usado por TODOS)', async () => {
    modFindUnique.mockResolvedValueOnce({ id: 'mod1', cooperativaId: null });
    await expect(service.desativar('mod1', 'coop-A', false)).rejects.toThrow(ForbiddenException);
    expect(modUpdate).not.toHaveBeenCalled();
  });

  it('ativar AA10 — modelo de outro tenant, ADMIN → NotFound', async () => {
    modFindUnique.mockResolvedValueOnce({ id: 'mod1', cooperativaId: 'coop-A' });
    await expect(service.ativar('mod1', 'coop-B', false)).rejects.toThrow(NotFoundException);
  });

  it('ativar — modelo próprio → sucesso', async () => {
    modFindUnique.mockResolvedValueOnce({ id: 'mod1', cooperativaId: 'coop-A' });
    const r = await service.ativar('mod1', 'coop-A', false);
    expect(r.id).toBe('mod1');
    expect(modUpdate).toHaveBeenCalledWith({ where: { id: 'mod1' }, data: { ativo: true } });
  });

  it('desativar — modelo próprio → sucesso', async () => {
    modFindUnique.mockResolvedValueOnce({ id: 'mod1', cooperativaId: 'coop-A' });
    const r = await service.desativar('mod1', 'coop-A', false);
    expect(r.id).toBe('mod1');
  });
});
