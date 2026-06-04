/**
 * Sprint Financeiro F1 (04/06/2026) — Specs do cron retry de emissão da
 * cobrança consolidada no gateway.
 *
 * Cobre as 6 decisões travadas pelo Luciano:
 *  (1) Campo separado `statusEmissao` — só busca cobranças com
 *      convenioContabilCobrancaId != null (consolidadas).
 *  (2) Cap 5 + back-off 30min — filter `tentativasEmissao<5` + janela.
 *  (5) Dev (!isAmbienteReal) → short-circuit sem query.
 *  (4) Após 5ª falha → statusEmissao=FALHA_EMISSAO + notif admin in-app.
 *
 * Não cobre: o adapter Asaas em si (testado em gateway-pagamento/*.spec).
 */
import { ConveniosJob } from './convenios.job';

jest.mock('../common/safety/ambiente', () => ({
  isAmbienteReal: jest.fn(),
}));

import { isAmbienteReal } from '../common/safety/ambiente';

describe('ConveniosJob.retryEmissaoConsolidadas — F1.3', () => {
  const findManyCobranca = jest.fn();
  const findUniqueCobranca = jest.fn();
  const updateCobranca = jest.fn();
  const emitirNoGateway = jest.fn();
  const notificacoesCriar = jest.fn();

  const prismaMock: any = {
    cobranca: {
      findMany: findManyCobranca,
      findUnique: findUniqueCobranca,
      update: updateCobranca,
    },
  };

  const custeioMock: any = { emitirNoGateway };
  const notificacoesMock: any = { criar: notificacoesCriar };
  const progressaoMock: any = { recalcularTodos: jest.fn() };

  let job: ConveniosJob;

  beforeEach(() => {
    jest.clearAllMocks();
    (isAmbienteReal as jest.Mock).mockReturnValue(true);
    job = new ConveniosJob(
      progressaoMock,
      custeioMock,
      prismaMock,
      notificacoesMock,
    );
  });

  it('short-circuits quando !isAmbienteReal (dev fica AGUARDANDO permanente)', async () => {
    (isAmbienteReal as jest.Mock).mockReturnValue(false);

    await job.retryEmissaoConsolidadas();

    expect(findManyCobranca).not.toHaveBeenCalled();
    expect(emitirNoGateway).not.toHaveBeenCalled();
    expect(notificacoesCriar).not.toHaveBeenCalled();
  });

  it('não chama emitirNoGateway quando lista de pendentes está vazia', async () => {
    findManyCobranca.mockResolvedValueOnce([]);

    await job.retryEmissaoConsolidadas();

    expect(findManyCobranca).toHaveBeenCalledTimes(1);
    expect(emitirNoGateway).not.toHaveBeenCalled();
    expect(notificacoesCriar).not.toHaveBeenCalled();
  });

  it('filtra por convenioContabilCobrancaId != null + AGUARDANDO_EMISSAO + tentativas<5 + back-off 30min', async () => {
    findManyCobranca.mockResolvedValueOnce([]);

    await job.retryEmissaoConsolidadas();

    expect(findManyCobranca).toHaveBeenCalledTimes(1);
    const call = findManyCobranca.mock.calls[0][0];

    expect(call.where.convenioContabilCobrancaId).toEqual({ not: null });
    expect(call.where.statusEmissao).toBe('AGUARDANDO_EMISSAO');
    expect(call.where.tentativasEmissao).toEqual({ lt: 5 });
    expect(call.where.OR).toEqual([
      { ultimaTentativaEmissaoEm: null },
      { ultimaTentativaEmissaoEm: { lt: expect.any(Date) } },
    ]);

    // janela = now - 30min
    const limite = (call.where.OR[1].ultimaTentativaEmissaoEm as { lt: Date }).lt;
    const diffMin = (Date.now() - limite.getTime()) / 60000;
    expect(diffMin).toBeGreaterThanOrEqual(29);
    expect(diffMin).toBeLessThanOrEqual(31);
  });

  it('SUCESSO: emitirNoGateway transitou pra EMITIDO → conta como emitida, sem FALHA', async () => {
    findManyCobranca.mockResolvedValueOnce([
      {
        id: 'cob-1',
        valorLiquido: 1234.56,
        dataVencimento: new Date('2026-06-10'),
        cooperativaId: 'coop-1',
        mesReferencia: 5,
        anoReferencia: 2026,
        convenioContabilCobranca: {
          id: 'conv-1',
          empresaNome: 'Empresa Teste',
          cooperativaId: 'coop-1',
          pagadorCooperadoId: 'pag-1',
        },
      },
    ]);
    emitirNoGateway.mockResolvedValueOnce(undefined);
    findUniqueCobranca.mockResolvedValueOnce({
      statusEmissao: 'EMITIDO',
      tentativasEmissao: 1,
      ultimoErroEmissao: null,
    });

    await job.retryEmissaoConsolidadas();

    expect(emitirNoGateway).toHaveBeenCalledWith(
      'cob-1',
      'coop-1',
      'pag-1',
      1234.56,
      expect.any(Date),
      'Cobrança consolidada — Empresa Teste — 05/2026',
    );
    expect(updateCobranca).not.toHaveBeenCalled(); // só o marcarFalha atualizaria
    expect(notificacoesCriar).not.toHaveBeenCalled();
  });

  it('CAP atingido: 5ª falha → statusEmissao=FALHA_EMISSAO + notif admin in-app', async () => {
    findManyCobranca.mockResolvedValueOnce([
      {
        id: 'cob-2',
        valorLiquido: 999.99,
        dataVencimento: new Date('2026-06-10'),
        cooperativaId: 'coop-1',
        mesReferencia: 5,
        anoReferencia: 2026,
        convenioContabilCobranca: {
          id: 'conv-1',
          empresaNome: 'Empresa Falhou',
          cooperativaId: 'coop-1',
          pagadorCooperadoId: 'pag-1',
        },
      },
    ]);
    emitirNoGateway.mockResolvedValueOnce(undefined);
    findUniqueCobranca.mockResolvedValueOnce({
      statusEmissao: 'AGUARDANDO_EMISSAO',
      tentativasEmissao: 5,
      ultimoErroEmissao: 'HTTP 500: gateway timeout',
    });
    updateCobranca.mockResolvedValueOnce(undefined);
    notificacoesCriar.mockResolvedValueOnce(undefined);

    await job.retryEmissaoConsolidadas();

    expect(updateCobranca).toHaveBeenCalledWith({
      where: { id: 'cob-2' },
      data: { statusEmissao: 'FALHA_EMISSAO' },
    });
    expect(notificacoesCriar).toHaveBeenCalledTimes(1);
    const notif = notificacoesCriar.mock.calls[0][0];
    expect(notif.tipo).toBe('COBRANCA_EMISSAO_FALHOU');
    expect(notif.cooperativaId).toBe('coop-1');
    expect(notif.mensagem).toContain('Empresa Falhou');
    expect(notif.mensagem).toContain('5×');
    expect(notif.mensagem).toContain('HTTP 500: gateway timeout');
    expect(notif.link).toBe('/dashboard/convenios');
  });

  it('NÃO marca FALHA enquanto tentativasEmissao < 5 (ainda há tentativas)', async () => {
    findManyCobranca.mockResolvedValueOnce([
      {
        id: 'cob-3',
        valorLiquido: 100,
        dataVencimento: new Date('2026-06-10'),
        cooperativaId: 'coop-1',
        mesReferencia: 5,
        anoReferencia: 2026,
        convenioContabilCobranca: {
          id: 'conv-1',
          empresaNome: 'Empresa Em Retry',
          cooperativaId: 'coop-1',
          pagadorCooperadoId: 'pag-1',
        },
      },
    ]);
    emitirNoGateway.mockResolvedValueOnce(undefined);
    findUniqueCobranca.mockResolvedValueOnce({
      statusEmissao: 'AGUARDANDO_EMISSAO',
      tentativasEmissao: 3, // ainda dá margem
      ultimoErroEmissao: 'HTTP 500',
    });

    await job.retryEmissaoConsolidadas();

    expect(emitirNoGateway).toHaveBeenCalledTimes(1);
    expect(updateCobranca).not.toHaveBeenCalled();
    expect(notificacoesCriar).not.toHaveBeenCalled();
  });

  it('skip quando cobrança sem convenio/cooperativa/pagador resolvíveis', async () => {
    findManyCobranca.mockResolvedValueOnce([
      {
        id: 'cob-orfa',
        valorLiquido: 50,
        dataVencimento: new Date('2026-06-10'),
        cooperativaId: null,
        mesReferencia: 5,
        anoReferencia: 2026,
        convenioContabilCobranca: null,
      },
    ]);

    await job.retryEmissaoConsolidadas();

    expect(emitirNoGateway).not.toHaveBeenCalled();
    expect(updateCobranca).not.toHaveBeenCalled();
    expect(notificacoesCriar).not.toHaveBeenCalled();
  });

  it('exceção inesperada em emitirNoGateway não derruba o batch', async () => {
    findManyCobranca.mockResolvedValueOnce([
      {
        id: 'cob-a',
        valorLiquido: 10,
        dataVencimento: new Date('2026-06-10'),
        cooperativaId: 'coop-1',
        mesReferencia: 5,
        anoReferencia: 2026,
        convenioContabilCobranca: {
          id: 'conv-1',
          empresaNome: 'A',
          cooperativaId: 'coop-1',
          pagadorCooperadoId: 'pag-1',
        },
      },
      {
        id: 'cob-b',
        valorLiquido: 20,
        dataVencimento: new Date('2026-06-10'),
        cooperativaId: 'coop-1',
        mesReferencia: 5,
        anoReferencia: 2026,
        convenioContabilCobranca: {
          id: 'conv-2',
          empresaNome: 'B',
          cooperativaId: 'coop-1',
          pagadorCooperadoId: 'pag-2',
        },
      },
    ]);
    emitirNoGateway
      .mockRejectedValueOnce(new Error('boom inesperado'))
      .mockResolvedValueOnce(undefined);
    findUniqueCobranca
      .mockResolvedValueOnce({
        statusEmissao: 'AGUARDANDO_EMISSAO',
        tentativasEmissao: 1,
        ultimoErroEmissao: 'boom inesperado',
      })
      .mockResolvedValueOnce({
        statusEmissao: 'EMITIDO',
        tentativasEmissao: 1,
        ultimoErroEmissao: null,
      });

    await expect(job.retryEmissaoConsolidadas()).resolves.not.toThrow();

    expect(emitirNoGateway).toHaveBeenCalledTimes(2);
    // nenhuma marcação de FALHA — primeira tentativa ainda tem margem
    expect(updateCobranca).not.toHaveBeenCalled();
    expect(notificacoesCriar).not.toHaveBeenCalled();
  });
});
