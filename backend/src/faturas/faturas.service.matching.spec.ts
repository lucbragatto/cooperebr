import { FaturasService } from './faturas.service';
import { normalizarNumeroUc } from './faturas.service';

describe('normalizarNumeroUc', () => {
  it('remove pontos e hífens', () => {
    expect(normalizarNumeroUc('0.000.892.226.054-40')).toBe('000089222605440');
  });

  it('sem separadores → mantém', () => {
    expect(normalizarNumeroUc('000156647505447')).toBe('000156647505447');
  });

  it('formato misto', () => {
    expect(normalizarNumeroUc('0001566475054-47')).toBe('000156647505447');
  });

  it('null → vazio', () => {
    expect(normalizarNumeroUc(null)).toBe('');
  });

  it('undefined → vazio', () => {
    expect(normalizarNumeroUc(undefined)).toBe('');
  });

  it('string vazia → vazia', () => {
    expect(normalizarNumeroUc('')).toBe('');
  });
});

describe('FaturasService — resolverUcDaFatura', () => {
  let service: FaturasService;
  let mockFindFirst: jest.Mock;
  let mockFindMany: jest.Mock;

  beforeEach(() => {
    service = Object.create(FaturasService.prototype);
    (service as any).logger = { warn: jest.fn(), error: jest.fn() };
    mockFindFirst = jest.fn();
    mockFindMany = jest.fn();
    (service as any).prisma = {
      uc: {
        findFirst: mockFindFirst,
        findMany: mockFindMany,
      },
    };
  });

  const resolver = (fatura: any) =>
    (service as any).resolverUcDaFatura(fatura);

  it('fatura.ucId válido, mesma cooperativa → retorna UC', async () => {
    mockFindFirst.mockResolvedValue({ id: 'uc-1', numero: '0.000.892.226.054-40' });
    const result = await resolver({
      id: 'fat-1',
      cooperativaId: 'coop-1',
      ucId: 'uc-1',
      dadosExtraidos: {},
    });
    expect(result).toEqual({ id: 'uc-1', numero: '0.000.892.226.054-40' });
    expect(mockFindFirst).toHaveBeenCalledWith({
      where: {
        id: 'uc-1',
        OR: [
          { cooperativaId: 'coop-1' },
          { cooperado: { cooperativaId: 'coop-1' } },
        ],
      },
      select: { id: true, numero: true },
    });
  });

  it('fatura.ucId válido, cooperativa diferente → null + warn', async () => {
    mockFindFirst.mockResolvedValue(null);
    const result = await resolver({
      id: 'fat-1',
      cooperativaId: 'coop-1',
      ucId: 'uc-outro',
      dadosExtraidos: {},
    });
    expect(result).toBeNull();
    expect((service as any).logger.warn).toHaveBeenCalled();
  });

  it('sem ucId, numeroUC OCR com pontos bate → retorna UC', async () => {
    mockFindMany.mockResolvedValue([
      { id: 'uc-1', numero: '0.000.892.226.054-40' },
      { id: 'uc-2', numero: '0.001.204.302.054-94' },
    ]);
    const result = await resolver({
      id: 'fat-1',
      cooperativaId: 'coop-1',
      ucId: null,
      dadosExtraidos: { numeroUC: '0.000.892.226.054-40' },
    });
    expect(result).toEqual({ id: 'uc-1', numero: '0.000.892.226.054-40' });
  });

  it('sem ucId, numeroUC OCR sem pontos bate com UC com pontos → retorna UC', async () => {
    mockFindMany.mockResolvedValue([
      { id: 'uc-1', numero: '0.000.892.226.054-40' },
    ]);
    const result = await resolver({
      id: 'fat-1',
      cooperativaId: 'coop-1',
      ucId: null,
      dadosExtraidos: { numeroUC: '000089222605440' },
    });
    expect(result).toEqual({ id: 'uc-1', numero: '0.000.892.226.054-40' });
  });

  it('sem ucId, numeroUC OCR não encontrada na cooperativa → null + warn', async () => {
    mockFindMany.mockResolvedValue([
      { id: 'uc-1', numero: '0.000.892.226.054-40' },
    ]);
    const result = await resolver({
      id: 'fat-1',
      cooperativaId: 'coop-1',
      ucId: null,
      dadosExtraidos: { numeroUC: '9.999.999.999.999-99' },
    });
    expect(result).toBeNull();
    expect((service as any).logger.warn).toHaveBeenCalled();
  });

  it('fatura sem cooperativaId → null + warn', async () => {
    const result = await resolver({
      id: 'fat-1',
      cooperativaId: null,
      cooperado: null,
      ucId: null,
      dadosExtraidos: { numeroUC: '0.000.892.226.054-40' },
    });
    expect(result).toBeNull();
    expect((service as any).logger.warn).toHaveBeenCalled();
  });

  it('fatura sem ucId e sem numeroUC → null silencioso', async () => {
    const result = await resolver({
      id: 'fat-1',
      cooperativaId: 'coop-1',
      ucId: null,
      dadosExtraidos: {},
    });
    expect(result).toBeNull();
    expect(mockFindFirst).not.toHaveBeenCalled();
    expect(mockFindMany).not.toHaveBeenCalled();
  });
});
