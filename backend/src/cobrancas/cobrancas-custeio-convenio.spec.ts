import { BadRequestException } from '@nestjs/common';
import { CobrancasService } from './cobrancas.service';

/**
 * D-FISCAL-2.4.2 (01/06/2026 noite) — Specs do guard de custeio por convênio.
 *
 * Cobre:
 *  (1) GUARD #2 em `CobrancasService.create` — plano custeado por convênio
 *      lança BadRequestException ANTES de criar Cobranca (Caso 1: empresa
 *      paga total).
 *  (2) Regressão — plano normal (não-custeado) passa pelo guard sem erro.
 *
 * Não cobre o motor inteiro de create (depende de Asaas, CooperToken,
 * CT.3, WhatsApp, etc) — só o ponto de bloqueio. O caminho feliz é
 * coberto pelos specs existentes do CobrancasService.
 */
describe('CobrancasService — D-FISCAL-2.4.2 (guard custeio por convênio)', () => {
  const findFirstCobranca = jest.fn();
  const findUniqueContrato = jest.fn();
  const createCobranca = jest.fn();

  const prismaMock = {
    cobranca: {
      findFirst: findFirstCobranca,
      create: createCobranca,
    },
    contrato: {
      findUnique: findUniqueContrato,
    },
  } as any;

  // Mocks de dependências (não usados nos casos cobertos aqui)
  const noopAsync = jest.fn().mockResolvedValue(undefined);
  const eventEmitterMock = { emit: jest.fn() } as any;
  const gatewayMock = { criarCobranca: noopAsync } as any;
  const clubeMock = { registrarEvento: noopAsync } as any;
  const waCicloMock = { onCobrancaCriada: noopAsync } as any;
  const waSenderMock = { enviarTexto: noopAsync } as any;
  const emailMock = { enviarEmail: noopAsync } as any;
  const cooperTokenMock = { registrarCredito: noopAsync } as any;
  const tokenContabilMock = { contabilizar: noopAsync } as any;
  const multaJurosMock = { calcular: noopAsync } as any;

  let service: CobrancasService;

  const baseData = {
    contratoId: 'contrato-1',
    mesReferencia: 6,
    anoReferencia: 2026,
    valorBruto: 250,
    dataVencimento: '2026-06-30',
  };

  beforeEach(() => {
    jest.resetAllMocks();
    noopAsync.mockResolvedValue(undefined);
    service = new CobrancasService(
      prismaMock,
      eventEmitterMock,
      gatewayMock,
      clubeMock,
      waCicloMock,
      waSenderMock,
      emailMock,
      cooperTokenMock,
      tokenContabilMock,
      multaJurosMock,
    );
  });

  it('plano custeado por convênio → BadRequestException + NÃO cria Cobranca', async () => {
    findFirstCobranca.mockResolvedValue(null); // não há duplicata
    findUniqueContrato.mockResolvedValue({
      id: 'contrato-1',
      numero: 'CT-2026-0042',
      cooperativaId: 'coop-A',
      percentualDesconto: 20,
      cooperado: { id: 'coop-mem-1', modoRemuneracao: 'DESCONTO' },
      plano: {
        id: 'plano-custeado',
        nome: 'Custeado por convênio',
        custeadoPorConvenio: true,
        cooperTokenAtivo: false,
      },
    });

    let capturado: unknown = null;
    try {
      await service.create(baseData);
    } catch (err) {
      capturado = err;
    }

    expect(capturado).toBeInstanceOf(BadRequestException);
    expect((capturado as Error).message).toMatch(/custeado por convênio/i);

    // Nada criado
    expect(createCobranca).not.toHaveBeenCalled();
  });

  it('plano normal (não-custeado) → passa pelo guard e chega no prisma.cobranca.create', async () => {
    findFirstCobranca.mockResolvedValue(null);
    findUniqueContrato.mockResolvedValue({
      id: 'contrato-1',
      numero: 'CT-2026-0001',
      cooperativaId: 'coop-A',
      percentualDesconto: 20,
      cooperado: { id: 'coop-mem-2', modoRemuneracao: 'DESCONTO' },
      plano: {
        id: 'plano-padrao',
        nome: 'Plano Básico',
        custeadoPorConvenio: false,
        cooperTokenAtivo: false,
      },
    });
    createCobranca.mockResolvedValue({
      id: 'cob-1',
      ...baseData,
      cooperativaId: 'coop-A',
      percentualDesconto: 20,
      valorDesconto: 50,
      valorLiquido: 200,
    });

    // Pode falhar adiante (Asaas/WA/etc), mas o guard de custeio deve
    // ter deixado a execução chegar até prisma.cobranca.create.
    await service.create(baseData).catch(() => undefined);

    expect(createCobranca).toHaveBeenCalledTimes(1);
    const arg = createCobranca.mock.calls[0][0];
    expect(arg.data.contratoId).toBe('contrato-1');
    expect(arg.data.valorBruto).toBe(250);
    expect(arg.data.percentualDesconto).toBe(20);
    expect(arg.data.valorLiquido).toBe(200); // 250 - 20% = 200
  });

  it('plano ausente (contrato sem plano vinculado) → passa pelo guard (não bloqueia)', async () => {
    findFirstCobranca.mockResolvedValue(null);
    findUniqueContrato.mockResolvedValue({
      id: 'contrato-1',
      numero: 'CT-2026-LEGADO',
      cooperativaId: 'coop-A',
      percentualDesconto: 0,
      cooperado: { id: 'coop-mem-3', modoRemuneracao: 'DESCONTO' },
      plano: null,
    });
    createCobranca.mockResolvedValue({
      id: 'cob-2',
      ...baseData,
      cooperativaId: 'coop-A',
    });

    await service.create(baseData).catch(() => undefined);

    // Sem plano = sem custeadoPorConvenio = guard deixa passar
    expect(createCobranca).toHaveBeenCalledTimes(1);
  });
});
