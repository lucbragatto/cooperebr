import { BadRequestException } from '@nestjs/common';
import { CooperadosService } from './cooperados.service';

/**
 * Sprint 11 Bloco 2 Fase D — guard de ativação.
 *
 * `update()` bloqueia transição para status=ATIVO se o cooperado tiver UC
 * sem `numeroUC` preenchido (necessário para listas B2B EDP), exceto quando
 * `cooperado.ambienteTeste = true` (bypass para dados de teste).
 */
describe('CooperadosService — guard de ativação (Fase D)', () => {
  let service: CooperadosService;
  let prisma: any;

  beforeEach(() => {
    prisma = {
      cooperado: {
        findUnique: jest.fn(),
        update: jest.fn().mockResolvedValue({ id: 'coop-1', nomeCompleto: 'Teste', status: 'ATIVO', cooperativaId: 'coop-X' }),
      },
      uc: {
        findMany: jest.fn(),
      },
      contrato: {
        updateMany: jest.fn().mockResolvedValue({ count: 0 }),
        findMany: jest.fn().mockResolvedValue([]),
      },
      historicoStatusCooperado: {
        create: jest.fn().mockResolvedValue({}),
      },
      indicacao: {
        findMany: jest.fn().mockResolvedValue([]),
        updateMany: jest.fn().mockResolvedValue({ count: 0 }),
      },
      $transaction: jest.fn(async (cb: any) => cb(prisma)),
    };

    service = Object.create(CooperadosService.prototype);
    (service as any).prisma = prisma;
    (service as any).notificacoes = { criar: jest.fn().mockResolvedValue({}) };
    (service as any).whatsappCicloVida = {
      notificarConcessionariaAprovada: jest.fn().mockResolvedValue({}),
    };
  });

  it('cooperado com UC e numeroUC preenchido → ativa OK', async () => {
    prisma.cooperado.findUnique.mockResolvedValue({ status: 'PENDENTE_DOCUMENTOS', ambienteTeste: false });
    prisma.uc.findMany.mockResolvedValue([
      { id: 'uc-1', numero: '0400702214', numeroUC: '160085263' },
    ]);

    await expect(service.update('coop-1', { status: 'ATIVO' as any })).resolves.toBeDefined();
    expect(prisma.uc.findMany).toHaveBeenCalledWith({
      where: { cooperadoId: 'coop-1' },
      select: { id: true, numero: true, numeroUC: true },
    });
    expect(prisma.cooperado.update).toHaveBeenCalled();
  });

  it('cooperado sem nenhuma UC → bloqueia com mensagem clara', async () => {
    prisma.cooperado.findUnique.mockResolvedValue({ status: 'PENDENTE_DOCUMENTOS', ambienteTeste: false });
    prisma.uc.findMany.mockResolvedValue([]);

    await expect(service.update('coop-1', { status: 'ATIVO' as any }))
      .rejects.toThrow(/nenhuma UC cadastrada/);
    expect(prisma.cooperado.update).not.toHaveBeenCalled();
  });

  it('cooperado com UC sem numeroUC → bloqueia listando UC problemática', async () => {
    prisma.cooperado.findUnique.mockResolvedValue({ status: 'PENDENTE_DOCUMENTOS', ambienteTeste: false });
    prisma.uc.findMany.mockResolvedValue([
      { id: 'uc-sem-uc', numero: '0400702214', numeroUC: null },
    ]);

    const promise = service.update('coop-1', { status: 'ATIVO' as any });
    await expect(promise).rejects.toThrow(BadRequestException);
    await expect(promise).rejects.toThrow(/uc-sem-uc/);
    await expect(promise).rejects.toThrow(/Sprint 12/);
    expect(prisma.cooperado.update).not.toHaveBeenCalled();
  });

  it('múltiplas UCs, uma sem numeroUC → bloqueia listando só a problemática', async () => {
    prisma.cooperado.findUnique.mockResolvedValue({ status: 'PENDENTE_DOCUMENTOS', ambienteTeste: false });
    prisma.uc.findMany.mockResolvedValue([
      { id: 'uc-ok', numero: '0400702214', numeroUC: '160085263' },
      { id: 'uc-falta', numero: '0500000000', numeroUC: '' },  // string vazia também conta
      { id: 'uc-ok-2', numero: '0600000000', numeroUC: '999888777' },
    ]);

    await expect(service.update('coop-1', { status: 'ATIVO' as any }))
      .rejects.toThrow(/uc-falta/);
    // Não menciona as UCs OK
    try {
      await service.update('coop-1', { status: 'ATIVO' as any });
    } catch (err: any) {
      expect(err.message).not.toContain('uc-ok');
    }
  });

  it('cooperado em ambienteTeste=true → bypass, ativa mesmo sem numeroUC', async () => {
    prisma.cooperado.findUnique.mockResolvedValue({ status: 'PENDENTE_DOCUMENTOS', ambienteTeste: true });
    prisma.uc.findMany.mockResolvedValue([]);  // nem precisa de UC

    await expect(service.update('coop-teste', { status: 'ATIVO' as any })).resolves.toBeDefined();
    // Quando bypass aciona, nem busca UCs (otimização)
    expect(prisma.uc.findMany).not.toHaveBeenCalled();
    expect(prisma.cooperado.update).toHaveBeenCalled();
  });

  it('mudança de status que NÃO é ATIVO → guard não roda', async () => {
    prisma.cooperado.findUnique.mockResolvedValue({ status: 'ATIVO', ambienteTeste: false });
    prisma.uc.findMany.mockResolvedValue([]);

    await expect(service.update('coop-1', { status: 'SUSPENSO' as any })).resolves.toBeDefined();
    expect(prisma.uc.findMany).not.toHaveBeenCalled();
  });

  it('update sem alterar status → guard não roda', async () => {
    prisma.cooperado.findUnique.mockResolvedValue({ status: 'ATIVO', ambienteTeste: false });

    await service.update('coop-1', { nomeCompleto: 'Novo Nome' });
    expect(prisma.uc.findMany).not.toHaveBeenCalled();
  });

  it('preserva escopo de tenant: where usa cooperadoId direto (não vaza UCs de outros)', async () => {
    prisma.cooperado.findUnique.mockResolvedValue({ status: 'PENDENTE_DOCUMENTOS', ambienteTeste: false });
    prisma.uc.findMany.mockResolvedValue([
      { id: 'uc-1', numero: '0400702214', numeroUC: '160085263' },
    ]);

    await service.update('coop-X', { status: 'ATIVO' as any });
    const call = prisma.uc.findMany.mock.calls[0][0];
    expect(call.where).toEqual({ cooperadoId: 'coop-X' });
    // Não introduz nem remove escopo extra — o caller é quem garante que `id`
    // pertence à cooperativa do admin (multi-tenant verificado em camada superior)
  });
});
