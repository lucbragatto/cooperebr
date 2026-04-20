import { BadRequestException } from '@nestjs/common';
import { FaturasService } from './faturas.service';
import { resolverUcPorNumero, normalizarNumeroUc } from './faturas.service';

describe('resolverUcPorNumero', () => {
  let mockFindMany: jest.Mock;
  let prisma: any;
  let logger: any;

  beforeEach(() => {
    mockFindMany = jest.fn();
    prisma = { uc: { findMany: mockFindMany } };
    logger = { warn: jest.fn() };
  });

  it('tenantId e numeroOCR válidos, UC existe no tenant → retorna UC', async () => {
    mockFindMany.mockResolvedValue([
      { id: 'uc-1', numero: '0.000.892.226.054-40' },
    ]);
    const result = await resolverUcPorNumero(prisma, 'coop-1', '0.000.892.226.054-40', logger);
    expect(result).toEqual({ id: 'uc-1', numero: '0.000.892.226.054-40' });
    expect(logger.warn).not.toHaveBeenCalled();
  });

  it('numeroOCR sem pontos, UC com pontos → match via normalização', async () => {
    mockFindMany.mockResolvedValue([
      { id: 'uc-1', numero: '0.000.892.226.054-40' },
    ]);
    const result = await resolverUcPorNumero(prisma, 'coop-1', '000089222605440', logger);
    expect(result).toEqual({ id: 'uc-1', numero: '0.000.892.226.054-40' });
  });

  it('numeroOCR OK mas UC só no tenant errado → null (blindagem)', async () => {
    // findMany retorna UCs do tenant solicitado — se a UC desejada está em outro,
    // ela simplesmente não aparece nos resultados
    mockFindMany.mockResolvedValue([
      { id: 'uc-2', numero: '0.001.204.302.054-94' },
    ]);
    const result = await resolverUcPorNumero(prisma, 'coop-1', '0.000.892.226.054-40', logger);
    expect(result).toBeNull();
    expect(logger.warn).toHaveBeenCalled();
  });

  it('numeroOCR null → null sem log', async () => {
    const result = await resolverUcPorNumero(prisma, 'coop-1', null, logger);
    expect(result).toBeNull();
    expect(mockFindMany).not.toHaveBeenCalled();
    expect(logger.warn).not.toHaveBeenCalled();
  });

  it('tenantId vazio → null sem log', async () => {
    const result = await resolverUcPorNumero(prisma, '', '0.000.892.226.054-40', logger);
    expect(result).toBeNull();
    expect(mockFindMany).not.toHaveBeenCalled();
  });
});

describe('FaturasService — criarFaturaProcessada', () => {
  let service: FaturasService;
  let mockCooperadoFindUnique: jest.Mock;
  let mockUcFindMany: jest.Mock;
  let mockUcFindUnique: jest.Mock;
  let mockFaturaCreate: jest.Mock;

  beforeEach(() => {
    service = Object.create(FaturasService.prototype);
    (service as any).logger = { warn: jest.fn(), error: jest.fn() };
    mockCooperadoFindUnique = jest.fn();
    mockUcFindMany = jest.fn().mockResolvedValue([]);
    mockUcFindUnique = jest.fn();
    mockFaturaCreate = jest.fn().mockResolvedValue({ id: 'fp-new' });
    (service as any).prisma = {
      cooperado: { findUnique: mockCooperadoFindUnique },
      uc: { findMany: mockUcFindMany, findUnique: mockUcFindUnique },
      faturaProcessada: { create: mockFaturaCreate },
    };
  });

  const baseArgs = {
    dadosExtraidos: { consumoAtualKwh: 100 },
    historicoConsumo: [],
    mesesUtilizados: 3,
    mesesDescartados: 0,
    mediaKwhCalculada: 100,
    thresholdUtilizado: 50,
  };

  it('cooperativaId + cooperadoId + ucId todos vindos → cria direto', async () => {
    await (service as any).criarFaturaProcessada({
      ...baseArgs,
      cooperativaId: 'coop-1',
      cooperadoId: 'coop-ado-1',
      ucId: 'uc-1',
    });
    expect(mockFaturaCreate).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        cooperativaId: 'coop-1',
        cooperadoId: 'coop-ado-1',
        ucId: 'uc-1',
      }),
    }));
  });

  it('só cooperadoId → resolve tenant via cooperado', async () => {
    mockCooperadoFindUnique.mockResolvedValue({ cooperativaId: 'coop-1' });
    await (service as any).criarFaturaProcessada({
      ...baseArgs,
      cooperadoId: 'coop-ado-1',
    });
    expect(mockCooperadoFindUnique).toHaveBeenCalledWith({
      where: { id: 'coop-ado-1' },
      select: { cooperativaId: true },
    });
    expect(mockFaturaCreate).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        cooperativaId: 'coop-1',
        cooperadoId: 'coop-ado-1',
      }),
    }));
  });

  it('cooperativaId + numeroUC no OCR → resolve ucId + deriva cooperadoId', async () => {
    mockUcFindMany.mockResolvedValue([
      { id: 'uc-1', numero: '0.000.892.226.054-40' },
    ]);
    mockUcFindUnique.mockResolvedValue({ cooperadoId: 'coop-ado-1' });

    await (service as any).criarFaturaProcessada({
      ...baseArgs,
      cooperativaId: 'coop-1',
      dadosExtraidos: { numeroUC: '000089222605440', consumoAtualKwh: 100 },
    });
    expect(mockFaturaCreate).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        cooperativaId: 'coop-1',
        ucId: 'uc-1',
        cooperadoId: 'coop-ado-1',
      }),
    }));
  });

  it('cooperativaId + numeroUC de OUTRO tenant → ucId null (blindagem)', async () => {
    // findMany retorna UCs do tenant — a UC desejada não está lá
    mockUcFindMany.mockResolvedValue([
      { id: 'uc-2', numero: '0.001.204.302.054-94' },
    ]);
    await (service as any).criarFaturaProcessada({
      ...baseArgs,
      cooperativaId: 'coop-1',
      dadosExtraidos: { numeroUC: '0.000.892.226.054-40' },
    });
    expect(mockFaturaCreate).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        ucId: null,
      }),
    }));
    expect((service as any).logger.warn).toHaveBeenCalled();
  });

  it('nenhum identificador → BadRequestException', async () => {
    mockCooperadoFindUnique.mockResolvedValue(null);
    await expect(
      (service as any).criarFaturaProcessada(baseArgs),
    ).rejects.toThrow(BadRequestException);
  });

  it('campos opcionais passados corretamente no create', async () => {
    await (service as any).criarFaturaProcessada({
      ...baseArgs,
      cooperativaId: 'coop-1',
      cooperadoId: 'coop-ado-1',
      ucId: 'uc-1',
      arquivoUrl: 'https://example.com/fatura.pdf',
      mesReferencia: '2026-04',
      statusRevisao: 'AUTO_APROVADO',
      status: 'PENDENTE',
      saldoKwhAnterior: 50,
      economiaGerada: 12.5,
    });
    const data = mockFaturaCreate.mock.calls[0][0].data;
    expect(data.arquivoUrl).toBe('https://example.com/fatura.pdf');
    expect(data.mesReferencia).toBe('2026-04');
    expect(data.statusRevisao).toBe('AUTO_APROVADO');
    expect(data.status).toBe('PENDENTE');
    expect(data.saldoKwhAnterior).toBe(50);
    expect(data.economiaGerada).toBe(12.5);
  });
});
