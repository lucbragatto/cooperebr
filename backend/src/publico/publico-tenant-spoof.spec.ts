/**
 * Sprint Hardening Tenant-Spoof (20/06/2026) —
 * D-novo-CADASTRO-PUBLICO-TENANT-SPOOF P1.
 *
 * Garante que os 3 endpoints públicos de cadastro/listagem NÃO aceitam
 * tenant arbitrário via body, e SEMPRE validam ?tenant=<cooperativaId>
 * contra Cooperativa existente + ativa:
 *
 * 1. POST /publico/cadastro-web (v2)
 * 2. POST /publico/cadastro-sem-uc
 * 3. GET  /publico/convenios-pagador-empresa
 */
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { PublicoController } from './publico.controller';

describe('PublicoController — D-novo-CADASTRO-PUBLICO-TENANT-SPOOF P1', () => {
  let controller: PublicoController;
  let prismaMock: {
    conviteConvenioMembro: { findUnique: jest.Mock };
    cooperativa: { findUnique: jest.Mock };
    contratoConvenio: { findMany: jest.Mock };
  };
  let cadastroWebV2Mock: jest.Mock;
  const originalEnv = process.env.CADASTRO_V2_ATIVO;

  beforeEach(() => {
    process.env.CADASTRO_V2_ATIVO = 'true';

    prismaMock = {
      conviteConvenioMembro: { findUnique: jest.fn() },
      cooperativa: { findUnique: jest.fn() },
      contratoConvenio: { findMany: jest.fn() },
    };

    controller = Object.create(PublicoController.prototype);
    (controller as any).prisma = prismaMock;
    (controller as any).logger = { log: jest.fn(), warn: jest.fn(), error: jest.fn() };

    cadastroWebV2Mock = jest.fn().mockResolvedValue({ ok: true });
    (controller as any).cadastroWebV2 = cadastroWebV2Mock;
  });

  afterEach(() => {
    process.env.CADASTRO_V2_ATIVO = originalEnv;
    jest.clearAllMocks();
  });

  // ═══ POST /publico/cadastro-web (v2 — sem convite) ═══════════════
  describe('cadastroWeb (v2 sem token de convite)', () => {
    const bodyBase = (overrides: Record<string, unknown> = {}) => ({
      nome: 'Fulano',
      cpf: '12345678901',
      email: 'f@example.com',
      telefone: '5527999999999',
      endereco: { cep: '29100000', logradouro: 'R', numero: '1', bairro: 'B', cidade: 'V', estado: 'ES' },
      instalacao: { numeroUC: '0001', distribuidora: 'EDP_ES', consumoMedioKwh: 200 },
      ...overrides,
    });

    it('body.cooperativaId IGNORADO — só ?tenant= validado conta', async () => {
      prismaMock.cooperativa.findUnique.mockResolvedValue({
        id: 'tenant-valido', ativo: true,
      });

      const body = bodyBase({ cooperativaId: 'tenant-spoof' });

      await controller.cadastroWeb(body as any, 'tenant-valido');

      expect(cadastroWebV2Mock).toHaveBeenCalledWith(body, 'tenant-valido');
      expect(cadastroWebV2Mock).not.toHaveBeenCalledWith(body, 'tenant-spoof');
    });

    it('?tenant= inexistente → NotFoundException', async () => {
      prismaMock.cooperativa.findUnique.mockResolvedValue(null);

      await expect(
        controller.cadastroWeb(bodyBase() as any, 'tenant-fake'),
      ).rejects.toThrow(NotFoundException);

      expect(cadastroWebV2Mock).not.toHaveBeenCalled();
    });

    it('?tenant= existe mas Cooperativa.ativo=false → NotFoundException', async () => {
      prismaMock.cooperativa.findUnique.mockResolvedValue({
        id: 'tenant-suspenso', ativo: false,
      });

      await expect(
        controller.cadastroWeb(bodyBase() as any, 'tenant-suspenso'),
      ).rejects.toThrow(NotFoundException);

      expect(cadastroWebV2Mock).not.toHaveBeenCalled();
    });
  });

  // ═══ POST /publico/cadastro-sem-uc ════════════════════════════════
  describe('cadastroSemUc', () => {
    const body = {
      nome: 'Indicador SemUc',
      cpf: '11122233344',
      email: 'sem-uc@example.com',
      tipoPessoa: 'PF' as const,
    };

    it('sem ?tenant= → BadRequestException', async () => {
      await expect(
        controller.cadastroSemUc(body, undefined),
      ).rejects.toThrow(BadRequestException);

      expect(prismaMock.cooperativa.findUnique).not.toHaveBeenCalled();
    });

    it('?tenant= inexistente → NotFoundException', async () => {
      prismaMock.cooperativa.findUnique.mockResolvedValue(null);

      await expect(
        controller.cadastroSemUc(body, 'tenant-fake'),
      ).rejects.toThrow(NotFoundException);
    });

    it('?tenant= válido + body.cooperativaId malicioso → tenant manda', async () => {
      prismaMock.cooperativa.findUnique.mockResolvedValue({
        id: 'tenant-valido', ativo: true,
      });
      // Stub no resto da função (precisa do `cooperado.findFirst` + create);
      // como nosso foco é só o guard de tenant, vamos interromper com erro
      // forçado depois do guard, e validar que findUnique foi chamado.
      const bodyComSpoof = { ...body, cooperativaId: 'tenant-spoof' };

      try {
        await controller.cadastroSemUc(bodyComSpoof as any, 'tenant-valido');
      } catch {
        // Esperado: erro depois do guard (mocks parciais). Nosso assert é só o guard.
      }

      expect(prismaMock.cooperativa.findUnique).toHaveBeenCalledWith({
        where: { id: 'tenant-valido' },
        select: { id: true, ativo: true },
      });
      expect(prismaMock.cooperativa.findUnique).not.toHaveBeenCalledWith({
        where: { id: 'tenant-spoof' },
        select: { id: true, ativo: true },
      });
    });
  });

  // ═══ GET /publico/convenios-pagador-empresa ══════════════════════
  describe('listarConveniosPagadorEmpresa', () => {
    it('sem ?tenant= → BadRequestException', async () => {
      await expect(
        controller.listarConveniosPagadorEmpresa(undefined),
      ).rejects.toThrow(BadRequestException);
    });

    it('?tenant= inexistente → NotFoundException (não vaza silencioso)', async () => {
      prismaMock.cooperativa.findUnique.mockResolvedValue(null);

      await expect(
        controller.listarConveniosPagadorEmpresa('tenant-fake'),
      ).rejects.toThrow(NotFoundException);

      expect(prismaMock.contratoConvenio.findMany).not.toHaveBeenCalled();
    });

    it('?tenant= válido → retorna convênios filtrados', async () => {
      prismaMock.cooperativa.findUnique.mockResolvedValue({
        id: 'tenant-valido', ativo: true,
      });
      prismaMock.contratoConvenio.findMany.mockResolvedValue([
        { id: 'conv-1', empresaNome: 'ACME' },
      ]);

      const res = await controller.listarConveniosPagadorEmpresa('tenant-valido');

      expect(res).toEqual([{ id: 'conv-1', empresaNome: 'ACME' }]);
      expect(prismaMock.contratoConvenio.findMany).toHaveBeenCalledWith({
        where: {
          cooperativaId: 'tenant-valido',
          status: 'ATIVO',
          pagador: 'EMPRESA',
        },
        select: { id: true, empresaNome: true },
        orderBy: { empresaNome: 'asc' },
      });
    });
  });
});
