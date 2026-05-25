import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';
import { GatewaysPagamentoConfigService } from './gateways-pagamento-config.service';
import { CredentialsEncryptor } from './credentials-encryptor.service';
import * as crypto from 'node:crypto';

describe('GatewaysPagamentoConfigService', () => {
  let service: GatewaysPagamentoConfigService;
  let prismaMock: any;
  let encryptor: CredentialsEncryptor;
  let gatewayPagamentoMock: any;

  const envOriginal = { ...process.env };

  beforeEach(() => {
    jest.clearAllMocks();
    process.env = {
      ...envOriginal,
      GATEWAY_ENCRYPT_KEY: crypto.randomBytes(32).toString('base64'),
    };

    prismaMock = {
      configGateway: {
        findMany: jest.fn(),
        findFirst: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
        delete: jest.fn(),
      },
    };
    encryptor = new CredentialsEncryptor();
    gatewayPagamentoMock = {
      testarConexao: jest.fn(),
    };

    service = new GatewaysPagamentoConfigService(prismaMock, encryptor, gatewayPagamentoMock);
  });

  afterAll(() => {
    process.env = envOriginal;
  });

  // ─── listarTiposSuportados ────────────────────────────────

  describe('listarTiposSuportados()', () => {
    it('retorna ASAAS + BANESTES com descriptors publicos', () => {
      const tipos = service.listarTiposSuportados();
      expect(tipos.map((t) => t.tipo).sort()).toEqual(['ASAAS', 'BANESTES']);
      const asaas = tipos.find((t) => t.tipo === 'ASAAS');
      expect(asaas!.campos.some((c) => c.nome === 'apiKey' && c.secret)).toBe(true);
    });
  });

  // ─── listar ───────────────────────────────────────────────

  describe('listar(cooperativaId)', () => {
    it('multi-tenant: filtra por cooperativaId', async () => {
      prismaMock.configGateway.findMany.mockResolvedValue([]);
      await service.listar('coop-A');
      expect(prismaMock.configGateway.findMany).toHaveBeenCalledWith({
        where: { cooperativaId: 'coop-A' },
        orderBy: { createdAt: 'asc' },
      });
    });

    it('throw quando cooperativaId vazio', async () => {
      await expect(service.listar('')).rejects.toThrow(BadRequestException);
    });

    it('mascarariza secrets antes de retornar', async () => {
      const cipher = encryptor.encrypt('chave-real-secreta');
      prismaMock.configGateway.findMany.mockResolvedValue([
        {
          id: 'g1',
          cooperativaId: 'coop-A',
          gateway: 'ASAAS',
          ambiente: 'SANDBOX',
          ativo: true,
          webhookToken: 'wt-x',
          credenciais: { __enc: { apiKey: cipher }, webhookToken: 'wt-x-meta' },
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ]);
      const r = await service.listar('coop-A');
      expect(r[0].credenciais.apiKey).toMatch(/^\*\*\*\*/);
      expect(r[0].credenciais.apiKey).not.toContain('chave-real-secreta');
      expect(r[0].webhookToken).toBe('(definido)');
    });
  });

  // ─── buscarPorId ──────────────────────────────────────────

  describe('buscarPorId(id, cooperativaId)', () => {
    it('multi-tenant: where inclui {id, cooperativaId}', async () => {
      prismaMock.configGateway.findFirst.mockResolvedValue(null);
      await expect(service.buscarPorId('g1', 'coop-A')).rejects.toThrow(NotFoundException);
      expect(prismaMock.configGateway.findFirst).toHaveBeenCalledWith({
        where: { id: 'g1', cooperativaId: 'coop-A' },
      });
    });

    it('throw NotFoundException quando registro pertence a outro tenant (defesa IDOR)', async () => {
      // Simula: existe ConfigGateway com esse id mas cooperativaId diferente
      // findFirst com {id, cooperativaId: outro} retorna null
      prismaMock.configGateway.findFirst.mockResolvedValue(null);
      await expect(service.buscarPorId('g1', 'coop-B')).rejects.toThrow(NotFoundException);
    });
  });

  // ─── buscarAtivoPorTipo ───────────────────────────────────

  describe('buscarAtivoPorTipo(cooperativaId, tipo)', () => {
    it('busca apenas ativo=true do tipo solicitado no tenant', async () => {
      prismaMock.configGateway.findFirst.mockResolvedValue({
        id: 'g1',
        cooperativaId: 'coop-A',
        gateway: 'ASAAS',
        ambiente: 'SANDBOX',
        ativo: true,
        webhookToken: null,
        credenciais: { __enc: {} },
        createdAt: new Date(),
        updatedAt: new Date(),
      });
      await service.buscarAtivoPorTipo('coop-A', 'ASAAS');
      expect(prismaMock.configGateway.findFirst).toHaveBeenCalledWith({
        where: { cooperativaId: 'coop-A', gateway: 'ASAAS', ativo: true },
      });
    });

    it('retorna null quando nao tem ativo', async () => {
      prismaMock.configGateway.findFirst.mockResolvedValue(null);
      const r = await service.buscarAtivoPorTipo('coop-A', 'BANESTES');
      expect(r).toBeNull();
    });

    it('throw quando tipo nao suportado', async () => {
      await expect(service.buscarAtivoPorTipo('coop-A', 'SICOOB')).rejects.toThrow(BadRequestException);
    });
  });

  // ─── criar ────────────────────────────────────────────────

  describe('criar(dto, cooperativaIdJwt, ehSuperAdmin)', () => {
    const dtoAsaas: any = {
      tipo: 'ASAAS',
      ambiente: 'SANDBOX',
      credenciais: { apiKey: 'a-very-long-asaas-api-key-1234567890' },
    };

    it('encripta apiKey antes de persistir', async () => {
      prismaMock.configGateway.create.mockResolvedValue({
        id: 'g1',
        cooperativaId: 'coop-A',
        gateway: 'ASAAS',
        ambiente: 'SANDBOX',
        ativo: true,
        webhookToken: null,
        credenciais: { __enc: { apiKey: 'mock-cipher' } },
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      await service.criar(dtoAsaas, 'coop-A', false);

      const callArg = prismaMock.configGateway.create.mock.calls[0][0];
      expect(callArg.data.cooperativaId).toBe('coop-A');
      expect(callArg.data.gateway).toBe('ASAAS');
      // apiKey nao deve aparecer em texto puro
      const credCaller = callArg.data.credenciais;
      expect(JSON.stringify(credCaller)).not.toContain('a-very-long-asaas-api-key-1234567890');
      // Deve ter __enc com apiKey
      expect(credCaller.__enc.apiKey).toMatch(/^[^:]+:[^:]+:[^:]+$/); // formato iv:cipher:tag
    });

    it('rejeita credenciais que falham Zod (apiKey curta)', async () => {
      const dtoInvalido = {
        ...dtoAsaas,
        credenciais: { apiKey: 'short' },
      };
      await expect(service.criar(dtoInvalido, 'coop-A', false)).rejects.toThrow(BadRequestException);
    });

    it('rejeita tipo nao-suportado', async () => {
      const dtoSicoob = {
        ...dtoAsaas,
        tipo: 'SICOOB',
      };
      await expect(service.criar(dtoSicoob, 'coop-A', false)).rejects.toThrow(BadRequestException);
    });

    it('@@unique violation -> ConflictException', async () => {
      prismaMock.configGateway.create.mockRejectedValue({ code: 'P2002' });
      await expect(service.criar(dtoAsaas, 'coop-A', false)).rejects.toThrow(ConflictException);
    });

    it('ADMIN: cooperativaId do JWT prevalece quando body NAO envia', async () => {
      prismaMock.configGateway.create.mockResolvedValue({
        id: 'g1', cooperativaId: 'coop-A', gateway: 'ASAAS', ambiente: 'SANDBOX',
        ativo: true, webhookToken: null, credenciais: { __enc: {} },
        createdAt: new Date(), updatedAt: new Date(),
      });
      await service.criar(dtoAsaas, 'coop-A', false);
      const callArg = prismaMock.configGateway.create.mock.calls[0][0];
      expect(callArg.data.cooperativaId).toBe('coop-A');
    });

    it('ADMIN: aceita body cooperativaId IGUAL ao JWT (idempotente)', async () => {
      prismaMock.configGateway.create.mockResolvedValue({
        id: 'g1', cooperativaId: 'coop-A', gateway: 'ASAAS', ambiente: 'SANDBOX',
        ativo: true, webhookToken: null, credenciais: { __enc: {} },
        createdAt: new Date(), updatedAt: new Date(),
      });
      await service.criar({ ...dtoAsaas, cooperativaId: 'coop-A' }, 'coop-A', false);
      const callArg = prismaMock.configGateway.create.mock.calls[0][0];
      expect(callArg.data.cooperativaId).toBe('coop-A');
    });

    it('ADMIN rejeita quando body cooperativaId diverge do JWT', async () => {
      await expect(
        service.criar({ ...dtoAsaas, cooperativaId: 'coop-X' }, 'coop-A', false),
      ).rejects.toThrow(BadRequestException);
    });

    it('SUPER_ADMIN pode usar cooperativaId do body pra atuar como tenant alheio', async () => {
      prismaMock.configGateway.create.mockResolvedValue({
        id: 'g1', cooperativaId: 'coop-target', gateway: 'ASAAS', ambiente: 'SANDBOX',
        ativo: true, webhookToken: null, credenciais: { __enc: {} },
        createdAt: new Date(), updatedAt: new Date(),
      });
      await service.criar({ ...dtoAsaas, cooperativaId: 'coop-target' }, undefined, true);
      const callArg = prismaMock.configGateway.create.mock.calls[0][0];
      expect(callArg.data.cooperativaId).toBe('coop-target');
    });

    it('SUPER_ADMIN sem cooperativaId no body nem JWT -> erro', async () => {
      await expect(service.criar(dtoAsaas, undefined, true)).rejects.toThrow(BadRequestException);
    });
  });

  // ─── atualizar ────────────────────────────────────────────

  describe('atualizar(id, dto, cooperativaId)', () => {
    const rowAtual = {
      id: 'g1',
      cooperativaId: 'coop-A',
      gateway: 'ASAAS',
      ambiente: 'SANDBOX',
      ativo: true,
      webhookToken: null,
      credenciais: { __enc: { apiKey: 'cipher-velho' } },
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    it('throw NotFoundException quando id nao pertence ao tenant', async () => {
      prismaMock.configGateway.findFirst.mockResolvedValue(null);
      await expect(
        service.atualizar('g1', { ativo: false }, 'coop-B'),
      ).rejects.toThrow(NotFoundException);
    });

    it('atualiza ambiente sem recriptar credenciais', async () => {
      prismaMock.configGateway.findFirst.mockResolvedValue(rowAtual);
      prismaMock.configGateway.update.mockResolvedValue({ ...rowAtual, ambiente: 'PRODUCAO' });

      await service.atualizar('g1', { ambiente: 'PRODUCAO' }, 'coop-A');
      const callArg = prismaMock.configGateway.update.mock.calls[0][0];
      expect(callArg.data).toEqual({ ambiente: 'PRODUCAO' });
      expect(callArg.data.credenciais).toBeUndefined();
    });

    it('substitui credenciais inteiramente quando body envia (nao merge)', async () => {
      prismaMock.configGateway.findFirst.mockResolvedValue(rowAtual);
      prismaMock.configGateway.update.mockResolvedValue(rowAtual);

      await service.atualizar(
        'g1',
        { credenciais: { apiKey: 'nova-key-com-tamanho-decente-12345' } },
        'coop-A',
      );
      const callArg = prismaMock.configGateway.update.mock.calls[0][0];
      const credAtualizada = callArg.data.credenciais;
      expect(credAtualizada.__enc.apiKey).toBeDefined();
      expect(JSON.stringify(credAtualizada)).not.toContain('nova-key-com-tamanho-decente');
    });

    it('rejeita credenciais novas que falham Zod', async () => {
      prismaMock.configGateway.findFirst.mockResolvedValue(rowAtual);
      await expect(
        service.atualizar('g1', { credenciais: { apiKey: 'x' } }, 'coop-A'),
      ).rejects.toThrow(BadRequestException);
    });
  });

  // ─── remover ──────────────────────────────────────────────

  describe('remover(id, cooperativaId)', () => {
    it('multi-tenant: delete so se pertence ao tenant', async () => {
      prismaMock.configGateway.findFirst.mockResolvedValue({
        id: 'g1', cooperativaId: 'coop-A', gateway: 'ASAAS', ambiente: 'SANDBOX',
        ativo: true, webhookToken: null, credenciais: { __enc: {} },
        createdAt: new Date(), updatedAt: new Date(),
      });
      prismaMock.configGateway.delete.mockResolvedValue({});
      const r = await service.remover('g1', 'coop-A');
      expect(prismaMock.configGateway.delete).toHaveBeenCalledWith({ where: { id: 'g1' } });
      expect(r).toEqual({ removido: true, id: 'g1', gateway: 'ASAAS' });
    });

    it('throw NotFoundException quando id nao pertence ao tenant', async () => {
      prismaMock.configGateway.findFirst.mockResolvedValue(null);
      await expect(service.remover('g1', 'coop-B')).rejects.toThrow(NotFoundException);
      expect(prismaMock.configGateway.delete).not.toHaveBeenCalled();
    });
  });

  // ─── encryptarSecrets / decriptarParaAdapter ─────────────

  describe('decriptarParaAdapter()', () => {
    it('reverte encryption + preserva campos nao-secretos', () => {
      const original = {
        apiKey: 'token-secreto-original',
        webhookToken: 'wt-publico',
      };
      const cred = (service as any).encriptarSecrets(original, ['apiKey']);
      const decriptado = service.decriptarParaAdapter(cred);
      expect(decriptado.apiKey).toBe('token-secreto-original');
      expect(decriptado.webhookToken).toBe('wt-publico');
    });
  });

  // ─── testarConexao ───────────────────────────────────────

  describe('testarConexao(id, cooperativaId)', () => {
    it('throw NotFoundException quando id nao pertence ao tenant', async () => {
      prismaMock.configGateway.findFirst.mockResolvedValue(null);
      await expect(service.testarConexao('g1', 'coop-A')).rejects.toThrow(NotFoundException);
    });

    it('retorna ok=false quando ConfigGateway esta inativa', async () => {
      prismaMock.configGateway.findFirst.mockResolvedValue({
        id: 'g1', cooperativaId: 'coop-A', gateway: 'ASAAS', ambiente: 'SANDBOX',
        ativo: false, webhookToken: null, credenciais: { __enc: {} },
        createdAt: new Date(), updatedAt: new Date(),
      });
      const r = await service.testarConexao('g1', 'coop-A');
      expect(r.ok).toBe(false);
      expect(r.erro).toMatch(/inativa/);
    });

    it('delega pro GatewayPagamentoService.testarConexao quando ativo', async () => {
      prismaMock.configGateway.findFirst.mockResolvedValue({
        id: 'g1', cooperativaId: 'coop-A', gateway: 'ASAAS', ambiente: 'SANDBOX',
        ativo: true, webhookToken: null, credenciais: { __enc: {} },
        createdAt: new Date(), updatedAt: new Date(),
      });
      gatewayPagamentoMock.testarConexao.mockResolvedValue({ ok: true, totalCustomers: 5 });

      const r = await service.testarConexao('g1', 'coop-A');
      expect(gatewayPagamentoMock.testarConexao).toHaveBeenCalledWith('coop-A');
      expect(r).toEqual({ ok: true, totalCustomers: 5 });
    });

    it('captura exception do adapter como ok=false (UX)', async () => {
      prismaMock.configGateway.findFirst.mockResolvedValue({
        id: 'g1', cooperativaId: 'coop-A', gateway: 'BANESTES', ambiente: 'SANDBOX',
        ativo: true, webhookToken: null, credenciais: { __enc: {} },
        createdAt: new Date(), updatedAt: new Date(),
      });
      gatewayPagamentoMock.testarConexao.mockRejectedValue(new Error('mTLS handshake failed'));

      const r = await service.testarConexao('g1', 'coop-A');
      expect(r.ok).toBe(false);
      expect(r.erro).toMatch(/mTLS handshake failed/);
    });
  });
});
