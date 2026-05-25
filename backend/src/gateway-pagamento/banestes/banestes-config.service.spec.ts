import { BanestesConfigService } from './banestes-config.service';
import { GatewayError } from '../errors/gateway-error';
import { CredentialsEncryptor } from '../../gateways-pagamento-config/credentials-encryptor.service';
import axios from 'axios';
import * as fs from 'node:fs';
import * as crypto from 'node:crypto';

jest.mock('axios');
jest.mock('node:fs');

const mockedAxios = axios as jest.Mocked<typeof axios>;
const mockedFs = fs as jest.Mocked<typeof fs>;

describe('BanestesConfigService (multi-tenant F3)', () => {
  let service: BanestesConfigService;
  let prismaMock: any;
  let encryptor: CredentialsEncryptor;
  let postMock: jest.Mock;
  const envOriginal = { ...process.env };

  const fakePfxBuffer = Buffer.from('FAKE-PFX-CONTENT-NOT-REAL');

  function buildConfigGatewayRow(overrides: Partial<any> = {}) {
    const credenciais = {
      __enc: {
        pfxSenha: encryptor.encrypt('senha-pfx-fake'),
        clientId: encryptor.encrypt('client-id-fake'),
        clientSecret: encryptor.encrypt('client-secret-fake'),
        chavePix: encryptor.encrypt('12345678901'),
      },
      pfxPath: '/fake/path/cert.pfx',
    };
    return {
      id: 'cfg-banestes-coop-A',
      cooperativaId: 'coop-A',
      gateway: 'BANESTES',
      ambiente: 'SANDBOX',
      ativo: true,
      webhookToken: null,
      credenciais,
      createdAt: new Date(),
      updatedAt: new Date(),
      ...overrides,
    };
  }

  beforeEach(() => {
    jest.clearAllMocks();

    process.env = {
      ...envOriginal,
      GATEWAY_ENCRYPT_KEY: crypto.randomBytes(32).toString('base64'),
      BANESTES_TIMEOUT_MS: '10000',
    };

    prismaMock = {
      configGateway: {
        findFirst: jest.fn(),
      },
    };
    encryptor = new CredentialsEncryptor();

    postMock = jest.fn();
    mockedAxios.create.mockReturnValue({ post: postMock } as any);
    mockedFs.readFileSync.mockReturnValue(fakePfxBuffer);

    service = new BanestesConfigService(prismaMock, encryptor);
  });

  afterAll(() => {
    process.env = envOriginal;
  });

  // ─── carregarConfig ─────────────────────────────────────

  describe('carregarConfig(cooperativaId)', () => {
    it('busca ConfigGateway BANESTES ativa do tenant + decripta secrets', async () => {
      prismaMock.configGateway.findFirst.mockResolvedValue(buildConfigGatewayRow());

      const cfg = await service.carregarConfig('coop-A');

      expect(prismaMock.configGateway.findFirst).toHaveBeenCalledWith({
        where: { cooperativaId: 'coop-A', gateway: 'BANESTES', ativo: true },
      });
      expect(cfg.pfxPath).toBe('/fake/path/cert.pfx');
      expect(cfg.pfxSenha).toBe('senha-pfx-fake');
      expect(cfg.clientId).toBe('client-id-fake');
      expect(cfg.clientSecret).toBe('client-secret-fake');
      expect(cfg.chavePix).toBe('12345678901');
      expect(cfg.ambiente).toBe('sandbox');
      expect(cfg.baseUrl).toBe('https://api-pix-sandbox.banestes.b.br');
      expect(cfg.timeoutMs).toBe(10000);
      expect(cfg.authorizationBasic).toBe(
        Buffer.from('client-id-fake:client-secret-fake').toString('base64'),
      );
    });

    it('deriva baseUrl pra producao quando ambiente=PRODUCAO', async () => {
      prismaMock.configGateway.findFirst.mockResolvedValue(
        buildConfigGatewayRow({ ambiente: 'PRODUCAO' }),
      );

      const cfg = await service.carregarConfig('coop-A');
      expect(cfg.ambiente).toBe('producao');
      expect(cfg.baseUrl).toBe('https://api-pix.banestes.b.br');
    });

    it('throw GatewayError quando cooperativaId vazio', async () => {
      let caught: GatewayError | null = null;
      try {
        await service.carregarConfig('');
      } catch (e) {
        caught = e as GatewayError;
      }
      expect(caught).toBeInstanceOf(GatewayError);
      expect(caught!.code).toBe('CREDENCIAIS_INVALIDAS');
    });

    it('throw GatewayError quando ConfigGateway BANESTES ausente no tenant', async () => {
      prismaMock.configGateway.findFirst.mockResolvedValue(null);

      let caught: GatewayError | null = null;
      try {
        await service.carregarConfig('coop-A');
      } catch (e) {
        caught = e as GatewayError;
      }
      expect(caught).toBeInstanceOf(GatewayError);
      expect(caught!.code).toBe('CREDENCIAIS_INVALIDAS');
      expect(caught!.message).toMatch(/ConfigGateway BANESTES|sem ConfigGateway/i);
    });

    it('throw GatewayError quando campos secretos faltando apos decrypt', async () => {
      const row = buildConfigGatewayRow({
        credenciais: {
          __enc: {
            clientSecret: encryptor.encrypt('cs'),
            chavePix: encryptor.encrypt('chave'),
          },
          pfxPath: '/fake/x.pfx',
        },
      });
      prismaMock.configGateway.findFirst.mockResolvedValue(row);

      let caught: GatewayError | null = null;
      try {
        await service.carregarConfig('coop-A');
      } catch (e) {
        caught = e as GatewayError;
      }
      expect(caught).toBeInstanceOf(GatewayError);
      expect(caught!.message).toMatch(/incompleta|Campos faltando/);
    });

    it('throw GatewayError quando decrypt falha (GATEWAY_ENCRYPT_KEY rotacionada)', async () => {
      const row = buildConfigGatewayRow();
      row.credenciais.__enc.pfxSenha = 'iv-fake:cipher-fake:tag-fake';
      prismaMock.configGateway.findFirst.mockResolvedValue(row);

      let caught: GatewayError | null = null;
      try {
        await service.carregarConfig('coop-A');
      } catch (e) {
        caught = e as GatewayError;
      }
      expect(caught).toBeInstanceOf(GatewayError);
      expect(caught!.message).toMatch(/decifrar|rotacionada|invalido/i);
    });
  });

  // ─── getHttpsAgent ──────────────────────────────────────

  describe('getHttpsAgent(cooperativaId)', () => {
    it('le .pfx do disco apenas uma vez por tenant (cache hit no 2o getHttpsAgent)', async () => {
      prismaMock.configGateway.findFirst.mockResolvedValue(buildConfigGatewayRow());

      const a1 = await service.getHttpsAgent('coop-A');
      const a2 = await service.getHttpsAgent('coop-A');

      expect(a1).toBe(a2);
      expect(mockedFs.readFileSync).toHaveBeenCalledTimes(1);
    });

    it('cache segregado por tenant: coop-A nao reusa Agent de coop-B', async () => {
      prismaMock.configGateway.findFirst.mockImplementation(async ({ where }: any) => {
        return buildConfigGatewayRow({ cooperativaId: where.cooperativaId });
      });

      const a1 = await service.getHttpsAgent('coop-A');
      const a2 = await service.getHttpsAgent('coop-B');

      expect(a1).not.toBe(a2);
      expect(mockedFs.readFileSync).toHaveBeenCalledTimes(2);
    });

    it('throw GatewayError quando .pfx ilegivel', async () => {
      prismaMock.configGateway.findFirst.mockResolvedValue(buildConfigGatewayRow());
      mockedFs.readFileSync.mockImplementation(() => {
        throw new Error('ENOENT');
      });

      let caught: GatewayError | null = null;
      try {
        await service.getHttpsAgent('coop-A');
      } catch (e) {
        caught = e as GatewayError;
      }
      expect(caught).toBeInstanceOf(GatewayError);
      expect(caught!.code).toBe('CREDENCIAIS_INVALIDAS');
      expect(caught!.message).toMatch(/Nao foi possivel ler.+\.pfx/);
    });
  });

  // ─── getAccessToken ────────────────────────────────────

  describe('getAccessToken(cooperativaId)', () => {
    it('cache miss: faz POST OAuth + grava no cache', async () => {
      prismaMock.configGateway.findFirst.mockResolvedValue(buildConfigGatewayRow());
      postMock.mockResolvedValueOnce({
        status: 200,
        data: { access_token: 'tok-fresh-1', expires_in: 3600 },
      });

      const tok = await service.getAccessToken('coop-A');
      expect(tok).toBe('tok-fresh-1');
      expect(postMock).toHaveBeenCalledTimes(1);
    });

    it('cache hit dentro do TTL: nao chama API de novo', async () => {
      prismaMock.configGateway.findFirst.mockResolvedValue(buildConfigGatewayRow());
      postMock.mockResolvedValueOnce({
        status: 200,
        data: { access_token: 'tok-A', expires_in: 3600 },
      });

      await service.getAccessToken('coop-A');
      await service.getAccessToken('coop-A');
      await service.getAccessToken('coop-A');

      expect(postMock).toHaveBeenCalledTimes(1);
    });

    it('cache segregado por tenant: coop-A nao reusa token de coop-B', async () => {
      prismaMock.configGateway.findFirst.mockImplementation(async ({ where }: any) => {
        return buildConfigGatewayRow({ cooperativaId: where.cooperativaId });
      });
      postMock
        .mockResolvedValueOnce({ status: 200, data: { access_token: 'tok-A', expires_in: 3600 } })
        .mockResolvedValueOnce({ status: 200, data: { access_token: 'tok-B', expires_in: 3600 } });

      const tA = await service.getAccessToken('coop-A');
      const tB = await service.getAccessToken('coop-B');

      expect(tA).toBe('tok-A');
      expect(tB).toBe('tok-B');
      expect(postMock).toHaveBeenCalledTimes(2);
    });

    it('HTTP 401 da Banestes -> GatewayError CREDENCIAIS_INVALIDAS retryable=false', async () => {
      prismaMock.configGateway.findFirst.mockResolvedValue(buildConfigGatewayRow());
      postMock.mockResolvedValueOnce({ status: 401, data: { detail: 'invalid_client' } });

      let caught: GatewayError | null = null;
      try {
        await service.getAccessToken('coop-A');
      } catch (e) {
        caught = e as GatewayError;
      }
      expect(caught).toBeInstanceOf(GatewayError);
      expect(caught!.code).toBe('CREDENCIAIS_INVALIDAS');
      expect(caught!.retryable).toBe(false);
    });

    it('HTTP 500 da Banestes -> GatewayError GATEWAY_INDISPONIVEL retryable=true', async () => {
      prismaMock.configGateway.findFirst.mockResolvedValue(buildConfigGatewayRow());
      postMock.mockResolvedValueOnce({ status: 500, data: {} });

      let caught: GatewayError | null = null;
      try {
        await service.getAccessToken('coop-A');
      } catch (e) {
        caught = e as GatewayError;
      }
      expect(caught).toBeInstanceOf(GatewayError);
      expect(caught!.code).toBe('GATEWAY_INDISPONIVEL');
      expect(caught!.retryable).toBe(true);
    });

    it('ECONNREFUSED -> GatewayError GATEWAY_INDISPONIVEL retryable=true', async () => {
      prismaMock.configGateway.findFirst.mockResolvedValue(buildConfigGatewayRow());
      const err: any = new Error('connect ECONNREFUSED');
      err.code = 'ECONNREFUSED';
      postMock.mockRejectedValueOnce(err);

      let caught: GatewayError | null = null;
      try {
        await service.getAccessToken('coop-A');
      } catch (e) {
        caught = e as GatewayError;
      }
      expect(caught).toBeInstanceOf(GatewayError);
      expect(caught!.code).toBe('GATEWAY_INDISPONIVEL');
      expect(caught!.retryable).toBe(true);
    });
  });

  // ─── Invalidacao de cache ───────────────────────────────

  describe('invalidarTokenCache(cooperativaId)', () => {
    it('limpa cache de UM tenant apenas — outros mantem', async () => {
      prismaMock.configGateway.findFirst.mockImplementation(async ({ where }: any) => {
        return buildConfigGatewayRow({ cooperativaId: where.cooperativaId });
      });
      postMock
        .mockResolvedValueOnce({ status: 200, data: { access_token: 'tok-A-1', expires_in: 3600 } })
        .mockResolvedValueOnce({ status: 200, data: { access_token: 'tok-B-1', expires_in: 3600 } })
        .mockResolvedValueOnce({ status: 200, data: { access_token: 'tok-A-2', expires_in: 3600 } });

      await service.getAccessToken('coop-A');
      await service.getAccessToken('coop-B');

      service.invalidarTokenCache('coop-A');

      const tA = await service.getAccessToken('coop-A');
      const tB = await service.getAccessToken('coop-B');

      expect(tA).toBe('tok-A-2');
      expect(tB).toBe('tok-B-1');
      expect(postMock).toHaveBeenCalledTimes(3);
    });
  });

  describe('invalidarCacheTenant(cooperativaId)', () => {
    it('limpa Agent + token do tenant especifico', async () => {
      prismaMock.configGateway.findFirst.mockResolvedValue(buildConfigGatewayRow());
      postMock.mockResolvedValue({ status: 200, data: { access_token: 'tok', expires_in: 3600 } });

      await service.getAccessToken('coop-A');
      await service.getHttpsAgent('coop-A');

      service.invalidarCacheTenant('coop-A');

      await service.getHttpsAgent('coop-A');
      await service.getAccessToken('coop-A');

      expect(mockedFs.readFileSync).toHaveBeenCalledTimes(2);
      expect(postMock).toHaveBeenCalledTimes(2);
    });
  });

  describe('resetCache()', () => {
    it('limpa todos os caches de todos tenants', async () => {
      prismaMock.configGateway.findFirst.mockImplementation(async ({ where }: any) => {
        return buildConfigGatewayRow({ cooperativaId: where.cooperativaId });
      });
      postMock.mockResolvedValue({ status: 200, data: { access_token: 'tok', expires_in: 3600 } });

      await service.getHttpsAgent('coop-A');
      await service.getHttpsAgent('coop-B');
      await service.getAccessToken('coop-A');
      await service.getAccessToken('coop-B');

      service.resetCache();

      await service.getHttpsAgent('coop-A');
      await service.getHttpsAgent('coop-B');

      expect(mockedFs.readFileSync).toHaveBeenCalledTimes(4);
    });
  });
});
