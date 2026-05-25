import { AsaasService } from './asaas.service';
import { CredentialsEncryptor } from '../gateways-pagamento-config/credentials-encryptor.service';
import * as crypto from 'node:crypto';

/**
 * Sub-Sprint Gateways de Pagamento Fatia F2 (M29, 2026-05-26).
 *
 * Cobre exclusivamente o dual-write introduzido em
 * AsaasService.salvarConfig: grava em AsaasConfig (legado) E em
 * ConfigGateway (novo) na MESMA transacao atomica.
 *
 * Coexistencia planejada: 30 dias. Sprint proprio futuro vai
 * descontinuar AsaasConfig depois.
 */
describe('AsaasService.salvarConfig — dual-write F2', () => {
  let service: AsaasService;
  let prismaMock: any;
  let encryptor: CredentialsEncryptor;
  const envOriginal = { ...process.env };

  beforeEach(() => {
    jest.clearAllMocks();
    process.env = {
      ...envOriginal,
      ASAAS_ENCRYPT_KEY: 'asaas-key-fake-pra-testes-32-bytes-min',
      GATEWAY_ENCRYPT_KEY: crypto.randomBytes(32).toString('base64'),
    };

    // Mock do $transaction — invoca o callback com tx que reusa os mesmos mocks
    const txOps = {
      asaasConfig: {
        upsert: jest.fn(),
      },
      configGateway: {
        upsert: jest.fn(),
      },
    };

    prismaMock = {
      $transaction: jest.fn().mockImplementation(async (cb: any) => cb(txOps)),
      __tx: txOps, // facilita assertions
    };

    encryptor = new CredentialsEncryptor();

    service = new AsaasService(prismaMock, { emit: jest.fn() } as any, encryptor);
  });

  afterAll(() => {
    process.env = envOriginal;
  });

  it('grava em AsaasConfig legado E ConfigGateway novo na mesma transacao', async () => {
    prismaMock.__tx.asaasConfig.upsert.mockResolvedValue({
      id: 'a1',
      cooperativaId: 'coop-A',
      apiKey: '<encrypted>',
      ambiente: 'SANDBOX',
      webhookToken: 'wt-x',
    });
    prismaMock.__tx.configGateway.upsert.mockResolvedValue({
      id: 'cg1',
      cooperativaId: 'coop-A',
      gateway: 'ASAAS',
    });

    await service.salvarConfig('coop-A', {
      apiKey: '$aact_chave_real_super_secreta_1234567890',
      ambiente: 'SANDBOX',
      webhookToken: 'wt-x',
    });

    expect(prismaMock.$transaction).toHaveBeenCalledTimes(1);
    expect(prismaMock.__tx.asaasConfig.upsert).toHaveBeenCalledTimes(1);
    expect(prismaMock.__tx.configGateway.upsert).toHaveBeenCalledTimes(1);
  });

  it('encrypta apiKey COM CHAVES DIFERENTES nos dois caminhos (legado SHA256 / novo AES-256-GCM puro)', async () => {
    prismaMock.__tx.asaasConfig.upsert.mockResolvedValue({});
    prismaMock.__tx.configGateway.upsert.mockResolvedValue({});

    const plainApiKey = '$aact_chave_real_unica_1234567890';
    await service.salvarConfig('coop-A', {
      apiKey: plainApiKey,
      ambiente: 'PRODUCAO',
    });

    const asaasCallArg = prismaMock.__tx.asaasConfig.upsert.mock.calls[0][0];
    const gatewayCallArg = prismaMock.__tx.configGateway.upsert.mock.calls[0][0];

    // 1. Nenhuma chamada vaza a chave em texto puro
    const asaasStr = JSON.stringify(asaasCallArg);
    const gatewayStr = JSON.stringify(gatewayCallArg);
    expect(asaasStr).not.toContain(plainApiKey);
    expect(gatewayStr).not.toContain(plainApiKey);

    // 2. As 2 versoes encryptadas sao DIFERENTES (formatos diferentes)
    const legadoCipher = asaasCallArg.update.apiKey;
    const novoCipher = (gatewayCallArg.update.credenciaisCriptografadas as any).apiKey;
    expect(legadoCipher).toBeTruthy();
    expect(novoCipher).toBeTruthy();
    expect(legadoCipher).not.toEqual(novoCipher);

    // 3. Novo cipher tem formato iv:cipher:tag em base64 (AES-256-GCM puro)
    expect(novoCipher).toMatch(/^[^:]+:[^:]+:[^:]+$/);
  });

  it('mascara apiKey nos metadados (apiKeyMasked = ****<sufixo>)', async () => {
    prismaMock.__tx.asaasConfig.upsert.mockResolvedValue({});
    prismaMock.__tx.configGateway.upsert.mockResolvedValue({});

    await service.salvarConfig('coop-A', {
      apiKey: '$aact_chave_real_super_secreta_1234567890dfe8',
      ambiente: 'SANDBOX',
    });

    const gatewayCallArg = prismaMock.__tx.configGateway.upsert.mock.calls[0][0];
    const metadados = gatewayCallArg.update.metadados as any;
    expect(metadados.apiKeyMasked).toBe('****dfe8');
  });

  it('passa webhookTokenDefinido = true em metadados quando token presente', async () => {
    prismaMock.__tx.asaasConfig.upsert.mockResolvedValue({});
    prismaMock.__tx.configGateway.upsert.mockResolvedValue({});

    await service.salvarConfig('coop-A', {
      apiKey: '$aact_x_1234567890123456789',
      ambiente: 'SANDBOX',
      webhookToken: 'wt-segredo',
    });

    const gatewayCallArg = prismaMock.__tx.configGateway.upsert.mock.calls[0][0];
    expect((gatewayCallArg.update.metadados as any).webhookTokenDefinido).toBe(true);
    expect(gatewayCallArg.update.webhookToken).toBe('wt-segredo');
  });

  it('passa webhookTokenDefinido = false quando ausente', async () => {
    prismaMock.__tx.asaasConfig.upsert.mockResolvedValue({});
    prismaMock.__tx.configGateway.upsert.mockResolvedValue({});

    await service.salvarConfig('coop-A', {
      apiKey: '$aact_x_1234567890123456789',
      ambiente: 'SANDBOX',
    });

    const gatewayCallArg = prismaMock.__tx.configGateway.upsert.mock.calls[0][0];
    expect((gatewayCallArg.update.metadados as any).webhookTokenDefinido).toBe(false);
    expect(gatewayCallArg.update.webhookToken).toBeNull();
  });

  it('rollback ambos quando ConfigGateway upsert falha (transacao atomica)', async () => {
    prismaMock.__tx.asaasConfig.upsert.mockResolvedValue({});
    prismaMock.__tx.configGateway.upsert.mockRejectedValue(new Error('DB error'));

    // O $transaction deve propagar o erro (callback throw -> rollback automatico Prisma)
    await expect(
      service.salvarConfig('coop-A', {
        apiKey: '$aact_x_1234567890123456789',
        ambiente: 'SANDBOX',
      }),
    ).rejects.toThrow('DB error');

    // Em transacao Prisma real, asaasConfig upsert e revertido. Mock apenas
    // confirma que ambas foram chamadas e a transacao falhou
    expect(prismaMock.__tx.asaasConfig.upsert).toHaveBeenCalledTimes(1);
    expect(prismaMock.__tx.configGateway.upsert).toHaveBeenCalledTimes(1);
  });

  it('usa multi-tenant key composto cooperativaId_gateway no upsert ConfigGateway', async () => {
    prismaMock.__tx.asaasConfig.upsert.mockResolvedValue({});
    prismaMock.__tx.configGateway.upsert.mockResolvedValue({});

    await service.salvarConfig('coop-XYZ', {
      apiKey: '$aact_x_1234567890123456789',
      ambiente: 'PRODUCAO',
    });

    const gatewayCallArg = prismaMock.__tx.configGateway.upsert.mock.calls[0][0];
    expect(gatewayCallArg.where).toEqual({
      cooperativaId_gateway: { cooperativaId: 'coop-XYZ', gateway: 'ASAAS' },
    });
  });
});
