/**
 * Sprint Convênio MIGRAÇÃO M47 (21/06/2026) — Fatia D.
 *
 * Specs do MigracaoExternaJob:
 *  - Detecção: query Prisma filtra tipo + statusMigracao + dataInicioMigracao < 30d.
 *  - Por linha: emit evento + AuditLog + WA admin (best-effort).
 *  - Cron @ '0 7 * * *' (diário 7h).
 */
import { MigracaoExternaJob, MigracaoPendenteTimeoutEvent } from './migracao-externa.job';

describe('MigracaoExternaJob — Sprint M47 Fatia D cron timeout 30d', () => {
  const migracaoFindMany = jest.fn();
  const auditLogCreate = jest.fn();
  const usuarioFindFirst = jest.fn();
  const waEnviarMensagem = jest.fn();
  const eventEmit = jest.fn();

  const prismaMock = {
    migracaoUsina: { findMany: migracaoFindMany },
    auditLog: { create: auditLogCreate },
    usuario: { findFirst: usuarioFindFirst },
  } as any;

  const waMock = { enviarMensagem: waEnviarMensagem } as any;
  const eventMock = { emit: eventEmit } as any;

  const job = new MigracaoExternaJob(prismaMock, waMock, eventMock);

  beforeEach(() => {
    jest.clearAllMocks();
    auditLogCreate.mockResolvedValue({});
    usuarioFindFirst.mockResolvedValue({
      telefone: '5527999998888', nome: 'Admin do Tenant',
    });
    waEnviarMensagem.mockResolvedValue({ enviado: true });
  });

  it('zero migrações > 30d → noop', async () => {
    migracaoFindMany.mockResolvedValue([]);

    const r = await job.verificarMigracoesPendentes();

    expect(r).toEqual({ detectadas: 0, alertasEnviados: 0 });
    expect(eventEmit).not.toHaveBeenCalled();
    expect(auditLogCreate).not.toHaveBeenCalled();
    expect(waEnviarMensagem).not.toHaveBeenCalled();
  });

  it('1 migração > 30d → emit + AuditLog + WA admin', async () => {
    const inicio = new Date();
    inicio.setDate(inicio.getDate() - 35);
    migracaoFindMany.mockResolvedValue([
      {
        id: 'mig-1',
        cooperadoId: 'coop-1',
        cooperativaId: 'tenant-A',
        distribuidoraOrigem: 'Concorrente X',
        dataInicioMigracao: inicio,
      },
    ]);

    const r = await job.verificarMigracoesPendentes();

    expect(r.detectadas).toBe(1);
    expect(r.alertasEnviados).toBe(1);

    // Filtro Prisma esperado
    expect(migracaoFindMany).toHaveBeenCalledWith({
      where: {
        tipo: 'DISTRIBUIDORA_EXTERNA',
        statusMigracao: 'PENDENTE',
        dataInicioMigracao: { lt: expect.any(Date) },
      },
      select: expect.any(Object),
    });

    // Evento
    expect(eventEmit).toHaveBeenCalledWith(
      'migracao-externa.pendente-timeout',
      expect.any(MigracaoPendenteTimeoutEvent),
    );

    // AuditLog
    expect(auditLogCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({
        usuarioId: 'SYSTEM_CRON',
        usuarioPerfil: 'SYSTEM',
        cooperativaId: 'tenant-A',
        acao: 'migracao.externa.timeout.detectado',
        recurso: 'MigracaoUsina',
        recursoId: 'mig-1',
      }),
    });

    // WA admin (P3 financeiro-token 21/06: orderBy createdAt asc determinístico)
    expect(usuarioFindFirst).toHaveBeenCalledWith({
      where: { cooperativaId: 'tenant-A', perfil: 'ADMIN', ativo: true },
      orderBy: { createdAt: 'asc' },
      select: { telefone: true, nome: true },
    });
    expect(waEnviarMensagem).toHaveBeenCalledTimes(1);
    const [telefone, texto, opcoes] = waEnviarMensagem.mock.calls[0];
    expect(telefone).toBe('5527999998888');
    expect(texto).toContain('Migração PENDENTE');
    expect(texto).toContain('Concorrente X');
    expect(opcoes).toMatchObject({
      tipoDisparo: 'MIGRACAO_PENDENTE_TIMEOUT_ADMIN',
      disparoId: 'mig-1',
      cooperativaId: 'tenant-A',
    });
  });

  it('admin sem telefone → WA pulado + log (sem derrubar fluxo)', async () => {
    const inicio = new Date();
    inicio.setDate(inicio.getDate() - 35);
    migracaoFindMany.mockResolvedValue([
      { id: 'mig-1', cooperadoId: 'coop-1', cooperativaId: 'tenant-A',
        distribuidoraOrigem: 'X', dataInicioMigracao: inicio },
    ]);
    usuarioFindFirst.mockResolvedValue({ telefone: null, nome: 'Admin' });

    const r = await job.verificarMigracoesPendentes();
    expect(r.alertasEnviados).toBe(1); // ainda "processado" (AuditLog ok)
    expect(waEnviarMensagem).not.toHaveBeenCalled();
    expect(auditLogCreate).toHaveBeenCalled();
  });

  it('falha de WA não derruba: log e segue', async () => {
    const inicio = new Date();
    inicio.setDate(inicio.getDate() - 35);
    migracaoFindMany.mockResolvedValue([
      { id: 'mig-1', cooperadoId: 'coop-1', cooperativaId: 'tenant-A',
        distribuidoraOrigem: 'X', dataInicioMigracao: inicio },
    ]);
    waEnviarMensagem.mockRejectedValue(new Error('WA offline'));

    const r = await job.verificarMigracoesPendentes();
    expect(r.alertasEnviados).toBe(1);
  });

  it('múltiplas migrações: cada uma processada independentemente (best-effort)', async () => {
    const inicio = new Date();
    inicio.setDate(inicio.getDate() - 40);
    migracaoFindMany.mockResolvedValue([
      { id: 'mig-1', cooperadoId: 'coop-1', cooperativaId: 'tenant-A',
        distribuidoraOrigem: 'X', dataInicioMigracao: inicio },
      { id: 'mig-2', cooperadoId: 'coop-2', cooperativaId: 'tenant-B',
        distribuidoraOrigem: 'Y', dataInicioMigracao: inicio },
    ]);

    const r = await job.verificarMigracoesPendentes();
    expect(r.detectadas).toBe(2);
    expect(r.alertasEnviados).toBe(2);
    expect(eventEmit).toHaveBeenCalledTimes(2);
  });
});
