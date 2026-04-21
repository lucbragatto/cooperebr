import { EmailMonitorService } from './email-monitor.service';

/**
 * Sprint 5 T5 — hotfix uc.numeroUC → uc.numero no email-monitor.
 *
 * Garante que identificarPorOcr e identificarCooperado buscam pelo
 * campo canônico `uc.numero` (unique), não pelo legado `uc.numeroUC`
 * (nullable, sempre retornava null).
 */
describe('EmailMonitorService — T5 hotfix campo UC', () => {
  it('T5: identificarPorOcr busca UC pelo campo canônico `numero`', async () => {
    const ucFindFirst = jest.fn().mockResolvedValue({
      id: 'uc-1',
      cooperado: { id: 'coop-1', nomeCompleto: 'João', cooperativaId: 'coop-id' },
    });
    const prismaMock = { uc: { findFirst: ucFindFirst } } as any;
    const empty = {} as any;

    const service = new EmailMonitorService(prismaMock, empty, empty);

    await (service as any).identificarPorOcr(
      { numeroUC: '12345678' },
      'coop-id',
    );

    // ASSERT CRÍTICO: busca pelo campo `numero`, NÃO `numeroUC`
    expect(ucFindFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          numero: '12345678',
          cooperado: { cooperativaId: 'coop-id' },
        }),
      }),
    );

    // Bug de regressão: se algum dia alguém voltar pra numeroUC, falha
    const callArgs = ucFindFirst.mock.calls[0][0];
    expect(callArgs.where).not.toHaveProperty('numeroUC');
  });

  it('T5: identificarCooperado busca UC pelo campo canônico `numero`', async () => {
    const ucFindFirst = jest.fn().mockResolvedValue({
      id: 'uc-2',
      cooperado: { id: 'coop-2', nomeCompleto: 'Maria', cooperativaId: 'coop-id' },
    });
    const cooperadoFindFirst = jest.fn().mockResolvedValue(null);
    const prismaMock = {
      uc: { findFirst: ucFindFirst },
      cooperado: { findFirst: cooperadoFindFirst },
    } as any;
    const empty = {} as any;

    const service = new EmailMonitorService(prismaMock, empty, empty);
    // Mock de extrairNumerosUC pra retornar um número conhecido
    (service as any).extrairNumerosUC = jest.fn().mockReturnValue(['99887766']);

    await (service as any).identificarCooperado(
      { remetente: '', textoCorpo: 'teste 99887766', assunto: '' },
      'coop-id',
    );

    expect(ucFindFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          numero: '99887766',
          cooperado: { cooperativaId: 'coop-id' },
        }),
      }),
    );

    const callArgs = ucFindFirst.mock.calls[0][0];
    expect(callArgs.where).not.toHaveProperty('numeroUC');
  });
});
