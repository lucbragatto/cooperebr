import { EmailService } from './email.service';

/**
 * D-novo-BR F1.5 M7 (31/05/2026) — buscarLogs filtra por tenant.
 */
describe('EmailService.buscarLogs — F1.5 M7 IDOR', () => {
  const emailLogFindMany = jest.fn();
  const emailLogCount = jest.fn();
  const prismaMock = {
    emailLog: { findMany: emailLogFindMany, count: emailLogCount },
  } as any;

  let service: EmailService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new EmailService(prismaMock, {} as any);
    emailLogFindMany.mockResolvedValue([]);
    emailLogCount.mockResolvedValue(0);
  });

  it('ADMIN tenant A → filtra por cooperativaId', async () => {
    await service.buscarLogs(1, 20, 'coop-A');
    expect(emailLogFindMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { cooperativaId: 'coop-A' } }),
    );
    expect(emailLogCount).toHaveBeenCalledWith(
      expect.objectContaining({ where: { cooperativaId: 'coop-A' } }),
    );
  });

  it('SUPER_ADMIN (null) → vê tudo (where vazio)', async () => {
    await service.buscarLogs(1, 20, null);
    expect(emailLogFindMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: {} }),
    );
  });

  it('Sem cooperativaId (compat legacy) → vê tudo', async () => {
    await service.buscarLogs();
    expect(emailLogFindMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: {} }),
    );
  });
});
