import { BanestesConfigService } from './banestes-config.service';
import { GatewayError } from '../errors/gateway-error';
import axios from 'axios';
import * as fs from 'node:fs';

jest.mock('axios');
jest.mock('node:fs');

const mockedAxios = axios as jest.Mocked<typeof axios>;
const mockedFs = fs as jest.Mocked<typeof fs>;

describe('BanestesConfigService', () => {
  let service: BanestesConfigService;
  let postMock: jest.Mock;
  const envOriginal = { ...process.env };

  // Buffer .pfx fake (conteudo nao importa nos specs — fs.readFileSync e axios mockados)
  const fakePfxBuffer = Buffer.from('FAKE-PFX-CONTENT-NOT-REAL');

  beforeEach(() => {
    jest.clearAllMocks();

    // Reset env pros testes
    process.env = {
      ...envOriginal,
      BANESTES_PFX_PATH: '/fake/path/cert.pfx',
      BANESTES_PFX_SENHA: 'fake-senha',
      BANESTES_CLIENT_ID: 'fake-client-id',
      BANESTES_CLIENT_SECRET: 'fake-client-secret',
      BANESTES_AMBIENTE: 'sandbox',
    };

    // readFileSync retorna buffer fake — Agent vai aceitar como pfx
    mockedFs.readFileSync.mockReturnValue(fakePfxBuffer as any);

    // Cria post mock retornavel pelos testes
    postMock = jest.fn();
    mockedAxios.create.mockReturnValue({ post: postMock } as any);

    service = new BanestesConfigService();
  });

  afterEach(() => {
    process.env = { ...envOriginal };
    service.onModuleDestroy();
  });

  describe('getConfig (indireto via getHttpsAgent/getAccessToken)', () => {
    it('Lanca GatewayError quando BANESTES_PFX_PATH ausente', () => {
      delete process.env.BANESTES_PFX_PATH;
      let caught: GatewayError | null = null;
      try {
        service.getHttpsAgent();
      } catch (e) {
        caught = e as GatewayError;
      }
      expect(caught).toBeInstanceOf(GatewayError);
      expect(caught!.code).toBe('CREDENCIAIS_INVALIDAS');
      expect(caught!.message).toMatch(/BANESTES_PFX_PATH/);
    });

    it('Lanca GatewayError listando TODAS as variaveis faltando', () => {
      delete process.env.BANESTES_PFX_PATH;
      delete process.env.BANESTES_CLIENT_ID;
      let caught: GatewayError | null = null;
      try {
        service.getHttpsAgent();
      } catch (e) {
        caught = e as GatewayError;
      }
      expect(caught).toBeInstanceOf(GatewayError);
      expect(caught!.message).toMatch(/BANESTES_PFX_PATH/);
      expect(caught!.message).toMatch(/BANESTES_CLIENT_ID/);
    });

    it('Default ambiente=sandbox quando BANESTES_AMBIENTE nao definido', () => {
      delete process.env.BANESTES_AMBIENTE;
      service.getHttpClient();
      const callArgs = mockedAxios.create.mock.calls[0][0];
      expect(callArgs?.baseURL).toBe('https://api-pix-sandbox.banestes.b.br');
    });

    it('ambiente=producao usa URL producao', () => {
      process.env.BANESTES_AMBIENTE = 'producao';
      service.getHttpClient();
      const callArgs = mockedAxios.create.mock.calls[0][0];
      expect(callArgs?.baseURL).toBe('https://api-pix.banestes.b.br');
    });

    it('BANESTES_BASE_URL override prevalece sobre ambiente', () => {
      process.env.BANESTES_BASE_URL = 'https://custom.banestes.test';
      service.getHttpClient();
      const callArgs = mockedAxios.create.mock.calls[0][0];
      expect(callArgs?.baseURL).toBe('https://custom.banestes.test');
    });

    it('BANESTES_TIMEOUT_MS default 10000', () => {
      service.getHttpClient();
      const callArgs = mockedAxios.create.mock.calls[0][0];
      expect(callArgs?.timeout).toBe(10000);
    });

    it('BANESTES_TIMEOUT_MS override respeitado', () => {
      process.env.BANESTES_TIMEOUT_MS = '5000';
      service.getHttpClient();
      const callArgs = mockedAxios.create.mock.calls[0][0];
      expect(callArgs?.timeout).toBe(5000);
    });
  });

  describe('getHttpsAgent', () => {
    it('Carrega .pfx do path configurado', () => {
      service.getHttpsAgent();
      expect(mockedFs.readFileSync).toHaveBeenCalledWith('/fake/path/cert.pfx');
    });

    it('Retorna o mesmo Agent em chamadas subsequentes (cache singleton)', () => {
      const agent1 = service.getHttpsAgent();
      const agent2 = service.getHttpsAgent();
      expect(agent1).toBe(agent2);
      expect(mockedFs.readFileSync).toHaveBeenCalledTimes(1);
    });

    it('Lanca GatewayError quando .pfx nao existe (ENOENT)', () => {
      mockedFs.readFileSync.mockImplementation(() => {
        const err = new Error('ENOENT: no such file or directory');
        (err as any).code = 'ENOENT';
        throw err;
      });

      let caught: GatewayError | null = null;
      try {
        service.getHttpsAgent();
      } catch (e) {
        caught = e as GatewayError;
      }
      expect(caught).toBeInstanceOf(GatewayError);
      expect(caught!.code).toBe('CREDENCIAIS_INVALIDAS');
      expect(caught!.message).toMatch(/Nao foi possivel ler/);
    });

    it('resetCache forca recarregar .pfx', () => {
      service.getHttpsAgent();
      service.resetCache();
      service.getHttpsAgent();
      expect(mockedFs.readFileSync).toHaveBeenCalledTimes(2);
    });
  });

  describe('getAccessToken', () => {
    it('POST /oauth/v1/access-token com Basic Auth + form-urlencoded', async () => {
      postMock.mockResolvedValueOnce({
        status: 200,
        data: { access_token: 'tok-fake-123', expires_in: 3600 },
      });

      const tok = await service.getAccessToken();
      expect(tok).toBe('tok-fake-123');

      expect(postMock).toHaveBeenCalledWith(
        '/oauth/v1/access-token',
        'grant_type=client_credentials',
        expect.objectContaining({
          headers: expect.objectContaining({
            'Content-Type': 'application/x-www-form-urlencoded',
            Authorization: expect.stringMatching(/^Basic /),
          }),
        }),
      );

      // Basic Auth = base64(client_id:client_secret)
      const authHeader = (postMock.mock.calls[0][2] as any).headers.Authorization as string;
      const decoded = Buffer.from(authHeader.replace('Basic ', ''), 'base64').toString('utf-8');
      expect(decoded).toBe('fake-client-id:fake-client-secret');
    });

    it('Cache token retorna mesmo valor em chamadas dentro do TTL', async () => {
      postMock.mockResolvedValueOnce({
        status: 200,
        data: { access_token: 'tok-cached', expires_in: 3600 },
      });

      const tok1 = await service.getAccessToken();
      const tok2 = await service.getAccessToken();
      expect(tok1).toBe('tok-cached');
      expect(tok2).toBe('tok-cached');
      expect(postMock).toHaveBeenCalledTimes(1);
    });

    it('invalidarTokenCache forca novo request', async () => {
      postMock
        .mockResolvedValueOnce({ status: 200, data: { access_token: 'tok-1', expires_in: 3600 } })
        .mockResolvedValueOnce({ status: 200, data: { access_token: 'tok-2', expires_in: 3600 } });

      const tok1 = await service.getAccessToken();
      service.invalidarTokenCache();
      const tok2 = await service.getAccessToken();

      expect(tok1).toBe('tok-1');
      expect(tok2).toBe('tok-2');
      expect(postMock).toHaveBeenCalledTimes(2);
    });

    it('Lanca GatewayError CREDENCIAIS_INVALIDAS em HTTP 401', async () => {
      postMock.mockResolvedValueOnce({ status: 401, data: { error: 'invalid_client' } });

      let caught: GatewayError | null = null;
      try {
        await service.getAccessToken();
      } catch (e) {
        caught = e as GatewayError;
      }
      expect(caught).toBeInstanceOf(GatewayError);
      expect(caught!.code).toBe('CREDENCIAIS_INVALIDAS');
      expect(caught!.retryable).toBe(false);
    });

    it('Lanca GatewayError GATEWAY_INDISPONIVEL em HTTP 500 (retryable=true)', async () => {
      postMock.mockResolvedValueOnce({ status: 500, data: { error: 'internal' } });

      let caught: GatewayError | null = null;
      try {
        await service.getAccessToken();
      } catch (e) {
        caught = e as GatewayError;
      }
      expect(caught).toBeInstanceOf(GatewayError);
      expect(caught!.code).toBe('GATEWAY_INDISPONIVEL');
      expect(caught!.retryable).toBe(true);
    });

    it('Lanca GatewayError DESCONHECIDO quando resposta sem access_token', async () => {
      postMock.mockResolvedValueOnce({
        status: 200,
        data: { expires_in: 3600 }, // sem access_token
      });

      let caught: GatewayError | null = null;
      try {
        await service.getAccessToken();
      } catch (e) {
        caught = e as GatewayError;
      }
      expect(caught).toBeInstanceOf(GatewayError);
      expect(caught!.code).toBe('DESCONHECIDO');
      expect(caught!.message).toMatch(/access_token/);
    });

    it('Lanca GatewayError GATEWAY_INDISPONIVEL em ECONNREFUSED', async () => {
      const netErr = new Error('connect ECONNREFUSED');
      (netErr as any).code = 'ECONNREFUSED';
      postMock.mockRejectedValueOnce(netErr);

      let caught: GatewayError | null = null;
      try {
        await service.getAccessToken();
      } catch (e) {
        caught = e as GatewayError;
      }
      expect(caught).toBeInstanceOf(GatewayError);
      expect(caught!.code).toBe('GATEWAY_INDISPONIVEL');
      expect(caught!.retryable).toBe(true);
    });

    it('TTL minimo de 1 minuto mesmo com expires_in muito curto', async () => {
      postMock.mockResolvedValueOnce({
        status: 200,
        data: { access_token: 'tok-curto', expires_in: 10 }, // 10 segundos
      });

      const tok1 = await service.getAccessToken();
      // Imediatamente em seguida, segundo call NAO deve disparar nova request
      // (TTL minimo de 60s protege contra mau OAuth)
      const tok2 = await service.getAccessToken();

      expect(tok1).toBe(tok2);
      expect(postMock).toHaveBeenCalledTimes(1);
    });
  });

  describe('onModuleDestroy', () => {
    it('Limpa cache de Agent e token', () => {
      service.getHttpsAgent();
      service.onModuleDestroy();
      // Re-carregar agora chama readFileSync novamente
      service.getHttpsAgent();
      expect(mockedFs.readFileSync).toHaveBeenCalledTimes(2);
    });
  });
});
