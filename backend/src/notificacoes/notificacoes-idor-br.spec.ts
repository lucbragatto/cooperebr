import { NotificacoesService } from './notificacoes.service';

/**
 * D-novo-BR F0.5 CRITICO (31/05/2026) — marcarComoLida usa buildWhere
 * pra confirmar posse antes de atualizar.
 */
describe('NotificacoesService.marcarComoLida — F0.5 CRITICO', () => {
  const notifFindFirst = jest.fn();
  const notifUpdate = jest.fn();

  const prismaMock = {
    notificacao: { findFirst: notifFindFirst, update: notifUpdate },
    cooperado: { findUnique: jest.fn() },
  } as any;

  let service: NotificacoesService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new NotificacoesService(prismaMock);
    notifUpdate.mockResolvedValue({ id: 'n1', lida: true });
  });

  it('ADMIN tenant B → posse negada, no-op silencioso (não vaza existência)', async () => {
    notifFindFirst.mockResolvedValueOnce(null);
    const user: any = { id: 'u1', email: 'a@a.com', perfil: 'ADMIN', cooperativaId: 'coop-B' };
    const r = await service.marcarComoLida('n1', user);
    expect(notifUpdate).not.toHaveBeenCalled();
    expect(r).toEqual({ id: 'n1', lida: true });
  });

  it('ADMIN tenant A próprio → update executa', async () => {
    notifFindFirst.mockResolvedValueOnce({ id: 'n1' });
    const user: any = { id: 'u1', email: 'a@a.com', perfil: 'ADMIN', cooperativaId: 'coop-A' };
    await service.marcarComoLida('n1', user);
    expect(notifUpdate).toHaveBeenCalled();
  });

  it('sem user (caller interno legacy) → mantém comportamento antigo (update direto)', async () => {
    await service.marcarComoLida('n1');
    expect(notifUpdate).toHaveBeenCalled();
    expect(notifFindFirst).not.toHaveBeenCalled();
  });
});
