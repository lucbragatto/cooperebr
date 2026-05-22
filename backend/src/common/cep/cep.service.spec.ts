import { CepService, CepResultado } from './cep.service';

describe('CepService', () => {
  let service: CepService;
  let fetchMock: jest.SpyInstance;

  beforeEach(() => {
    service = new CepService();
  });

  afterEach(() => {
    fetchMock?.mockRestore();
  });

  // ============================================================
  // Validacao de entrada
  // ============================================================
  describe('CEP invalido (validacao local, sem chamar ViaCEP)', () => {
    it('CEP com menos de 8 digitos retorna CEP_INVALIDO', async () => {
      fetchMock = jest.spyOn(global, 'fetch' as any);
      const r = await service.consultar('1234567');
      expect(r.status).toBe('CEP_INVALIDO');
      expect(fetchMock).not.toHaveBeenCalled();
    });

    it('CEP com letras retorna CEP_INVALIDO', async () => {
      fetchMock = jest.spyOn(global, 'fetch' as any);
      const r = await service.consultar('abcdefgh');
      expect(r.status).toBe('CEP_INVALIDO');
      expect(fetchMock).not.toHaveBeenCalled();
    });

    it('String vazia retorna CEP_INVALIDO', async () => {
      fetchMock = jest.spyOn(global, 'fetch' as any);
      const r = await service.consultar('');
      expect(r.status).toBe('CEP_INVALIDO');
      expect(fetchMock).not.toHaveBeenCalled();
    });

    it('CEP com mascara mas 8 digitos limpos eh aceito (normaliza)', async () => {
      fetchMock = jest.spyOn(global, 'fetch' as any).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          cep: '01310-100',
          logradouro: 'Avenida Paulista',
          bairro: 'Bela Vista',
          localidade: 'Sao Paulo',
          uf: 'SP',
        }),
      } as Response);

      const r = await service.consultar('01310-100');
      expect(r.status).toBe('ENCONTRADO');
      // Confirma que normalizou pra digitos antes de chamar
      expect(fetchMock).toHaveBeenCalledWith(
        expect.stringContaining('01310100'),
        expect.any(Object),
      );
    });
  });

  // ============================================================
  // ViaCEP encontrou
  // ============================================================
  describe('CEP encontrado', () => {
    it('CEP valido encontrado retorna endereco completo', async () => {
      fetchMock = jest.spyOn(global, 'fetch' as any).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          cep: '01310-100',
          logradouro: 'Avenida Paulista',
          bairro: 'Bela Vista',
          localidade: 'Sao Paulo',
          uf: 'SP',
        }),
      } as Response);

      const r = await service.consultar('01310100');
      expect(r).toEqual<CepResultado>({
        status: 'ENCONTRADO',
        endereco: {
          cep: '01310-100',
          logradouro: 'Avenida Paulista',
          bairro: 'Bela Vista',
          cidade: 'Sao Paulo',
          estado: 'SP',
        },
      });
    });

    it('CEP encontrado com campos vazios mantem strings vazias', async () => {
      // Alguns CEPs de cidade nao tem logradouro/bairro
      fetchMock = jest.spyOn(global, 'fetch' as any).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          cep: '29900-000',
          logradouro: '',
          bairro: '',
          localidade: 'Linhares',
          uf: 'ES',
        }),
      } as Response);

      const r = await service.consultar('29900000');
      expect(r.status).toBe('ENCONTRADO');
      if (r.status === 'ENCONTRADO') {
        expect(r.endereco.cidade).toBe('Linhares');
        expect(r.endereco.estado).toBe('ES');
        expect(r.endereco.logradouro).toBe('');
        expect(r.endereco.bairro).toBe('');
      }
    });
  });

  // ============================================================
  // ViaCEP nao encontrou
  // ============================================================
  describe('CEP nao encontrado', () => {
    it('ViaCEP retorna { erro: true } -> status NAO_ENCONTRADO', async () => {
      fetchMock = jest.spyOn(global, 'fetch' as any).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ erro: true }),
      } as Response);

      const r = await service.consultar('00000000');
      expect(r.status).toBe('NAO_ENCONTRADO');
    });
  });

  // ============================================================
  // ViaCEP fora do ar / erros de rede / timeout
  // ============================================================
  describe('ViaCEP fora do ar (degradacao graciosa)', () => {
    it('Erro de rede (fetch rejeita) -> status FORA_DO_AR', async () => {
      fetchMock = jest
        .spyOn(global, 'fetch' as any)
        .mockRejectedValueOnce(new Error('ENOTFOUND viacep.com.br'));

      const r = await service.consultar('01310100');
      expect(r.status).toBe('FORA_DO_AR');
    });

    it('Response nao-OK (500) -> status FORA_DO_AR', async () => {
      fetchMock = jest.spyOn(global, 'fetch' as any).mockResolvedValueOnce({
        ok: false,
        status: 500,
        json: async () => ({}),
      } as Response);

      const r = await service.consultar('01310100');
      expect(r.status).toBe('FORA_DO_AR');
    });

    it('JSON invalido na resposta -> status FORA_DO_AR', async () => {
      fetchMock = jest.spyOn(global, 'fetch' as any).mockResolvedValueOnce({
        ok: true,
        json: async () => {
          throw new Error('Unexpected token in JSON');
        },
      } as Response);

      const r = await service.consultar('01310100');
      expect(r.status).toBe('FORA_DO_AR');
    });

    it('AbortError (timeout) -> status FORA_DO_AR', async () => {
      fetchMock = jest
        .spyOn(global, 'fetch' as any)
        .mockRejectedValueOnce(
          Object.assign(new Error('aborted'), { name: 'AbortError' }),
        );

      const r = await service.consultar('01310100');
      expect(r.status).toBe('FORA_DO_AR');
    });
  });

  // ============================================================
  // URL chamada
  // ============================================================
  describe('URL chamada', () => {
    it('Chama viacep.com.br com cep limpo + sufixo /json/', async () => {
      fetchMock = jest.spyOn(global, 'fetch' as any).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ erro: true }),
      } as Response);

      await service.consultar('01310-100');

      expect(fetchMock).toHaveBeenCalledWith(
        'https://viacep.com.br/ws/01310100/json/',
        expect.any(Object),
      );
    });

    it('Passa AbortSignal pra controle de timeout', async () => {
      fetchMock = jest.spyOn(global, 'fetch' as any).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ erro: true }),
      } as Response);

      await service.consultar('01310100');

      const opts = fetchMock.mock.calls[0][1];
      expect(opts).toHaveProperty('signal');
      expect(opts.signal).toBeInstanceOf(AbortSignal);
    });
  });
});
