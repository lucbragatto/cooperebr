/**
 * Sprint Clube P1 — Fase 2 Bloco 2 (11/06/2026).
 *
 * Specs do `comprarTokensCooperado` (empresa cooperada PJ compra tokens via
 * Asaas creditando no proprio CooperTokenSaldo). Cobre:
 *  - Guard multi-tenant: cooperado de outro tenant → NotFound.
 *  - Guard semantico: PF → Forbidden (so PJ compra neste caminho).
 *  - Guard status: PENDENTE / AGUARDANDO_CONCESSIONARIA → Forbidden.
 *  - Happy path: cria CooperTokenCompra, chama Asaas.emitirCobranca,
 *    linka bidirecionalmente, devolve payload com link/QR.
 *  - Fallback de valorTokenReais (config null → 0.45).
 *  - Falha do Asaas → marca compra como CANCELADO antes de propagar.
 */
import { BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { CooperTokenService } from './cooper-token.service';

const COOPERATIVA = 'coop-A';
const COOPERADO_PJ = 'pj-1';
const COOPERADO_PF = 'pf-1';

function buildPrisma(opts: {
  cooperado?: any;
  config?: any;
}) {
  const cooperTokenCompraCreate = jest.fn().mockResolvedValue({
    id: 'compra-1',
    cooperativaId: COOPERATIVA,
    compradorCooperadoId: COOPERADO_PJ,
  });
  const cooperTokenCompraUpdate = jest.fn().mockResolvedValue({
    id: 'compra-1',
    cooperativaId: COOPERATIVA,
    compradorCooperadoId: COOPERADO_PJ,
    asaasId: 'asaas-pay-1',
    asaasCobrancaId: 'asaas-cobr-1',
  });
  // Quando o catch faz update pra CANCELADO, o `.catch(()=>undefined)` engole erro.
  // Fix pos-review F2 (11/06/2026): link bidirecional usa updateMany +
  // findUnique (defesa multi-tenant via cooperativaId no where).
  const cooperTokenCompraUpdateMany = jest.fn().mockResolvedValue({ count: 1 });
  const cooperTokenCompraFindUnique = jest.fn().mockResolvedValue({
    id: 'compra-1',
    cooperativaId: COOPERATIVA,
    compradorCooperadoId: COOPERADO_PJ,
    asaasId: 'asaas-pay-1',
    asaasCobrancaId: 'asaas-cobr-1',
  });
  return {
    cooperado: {
      findFirst: jest.fn().mockResolvedValue(opts.cooperado ?? null),
    },
    configCooperToken: {
      findUnique: jest.fn().mockResolvedValue(opts.config ?? null),
    },
    cooperTokenCompra: {
      create: cooperTokenCompraCreate,
      update: cooperTokenCompraUpdate,
      updateMany: cooperTokenCompraUpdateMany,
      findUnique: cooperTokenCompraFindUnique,
    },
    __mocks: { cooperTokenCompraCreate, cooperTokenCompraUpdate, cooperTokenCompraUpdateMany },
  } as any;
}

function buildAsaas(emitirImpl?: jest.Mock) {
  return {
    emitirCobranca:
      emitirImpl ??
      jest.fn().mockResolvedValue({
        id: 'asaas-cobr-1',
        asaasId: 'asaas-pay-1',
        linkPagamento: 'https://asaas.com/i/asaas-pay-1',
        pixQrCode: 'base64-qr',
        pixCopiaECola: '00020126...',
      }),
  } as any;
}

function buildService(prismaMock: any, asaasMock?: any) {
  const eventMock = { emit: jest.fn() } as any;
  return new CooperTokenService(prismaMock, eventMock, asaasMock);
}

describe('CooperTokenService.comprarTokensCooperado — F2 Bloco 2', () => {
  describe('Guards', () => {
    it('quantidade <= 0 → BadRequestException', async () => {
      const prisma = buildPrisma({});
      const service = buildService(prisma, buildAsaas());
      await expect(
        service.comprarTokensCooperado({
          compradorCooperadoId: COOPERADO_PJ,
          cooperativaId: COOPERATIVA,
          quantidade: 0,
          formaPagamento: 'PIX',
        }),
      ).rejects.toBeInstanceOf(BadRequestException);
      expect(prisma.cooperado.findFirst).not.toHaveBeenCalled();
    });

    it('cooperado nao existe / outro tenant → NotFoundException (multi-tenant)', async () => {
      const prisma = buildPrisma({ cooperado: null });
      const service = buildService(prisma, buildAsaas());
      await expect(
        service.comprarTokensCooperado({
          compradorCooperadoId: COOPERADO_PJ,
          cooperativaId: COOPERATIVA,
          quantidade: 100,
          formaPagamento: 'PIX',
        }),
      ).rejects.toBeInstanceOf(NotFoundException);
      expect(prisma.cooperado.findFirst).toHaveBeenCalledWith({
        where: { id: COOPERADO_PJ, cooperativaId: COOPERATIVA },
        select: expect.objectContaining({ tipoPessoa: true, status: true }),
      });
      expect(prisma.cooperTokenCompra.create).not.toHaveBeenCalled();
    });

    it('cooperado PF → ForbiddenException (apenas PJ compra)', async () => {
      const prisma = buildPrisma({
        cooperado: { id: COOPERADO_PF, tipoPessoa: 'PF', status: 'ATIVO', nomeCompleto: 'Joao PF' },
      });
      const service = buildService(prisma, buildAsaas());
      await expect(
        service.comprarTokensCooperado({
          compradorCooperadoId: COOPERADO_PF,
          cooperativaId: COOPERATIVA,
          quantidade: 100,
          formaPagamento: 'PIX',
        }),
      ).rejects.toBeInstanceOf(ForbiddenException);
      expect(prisma.cooperTokenCompra.create).not.toHaveBeenCalled();
    });

    it('cooperado PJ com status PENDENTE → ForbiddenException', async () => {
      const prisma = buildPrisma({
        cooperado: { id: COOPERADO_PJ, tipoPessoa: 'PJ', status: 'PENDENTE', nomeCompleto: 'Santi' },
      });
      const service = buildService(prisma, buildAsaas());
      await expect(
        service.comprarTokensCooperado({
          compradorCooperadoId: COOPERADO_PJ,
          cooperativaId: COOPERATIVA,
          quantidade: 100,
          formaPagamento: 'PIX',
        }),
      ).rejects.toBeInstanceOf(ForbiddenException);
    });

    it('cooperado PJ AGUARDANDO_CONCESSIONARIA → ForbiddenException (v1 conservador)', async () => {
      const prisma = buildPrisma({
        cooperado: { id: COOPERADO_PJ, tipoPessoa: 'PJ', status: 'AGUARDANDO_CONCESSIONARIA', nomeCompleto: 'X' },
      });
      const service = buildService(prisma, buildAsaas());
      await expect(
        service.comprarTokensCooperado({
          compradorCooperadoId: COOPERADO_PJ,
          cooperativaId: COOPERATIVA,
          quantidade: 100,
          formaPagamento: 'PIX',
        }),
      ).rejects.toBeInstanceOf(ForbiddenException);
    });
  });

  describe('Happy path — PJ ATIVO compra PIX 100 tokens', () => {
    it('cria CooperTokenCompra com compradorCooperadoId + chama Asaas.emitirCobranca + linka bidirecionalmente', async () => {
      const prisma = buildPrisma({
        cooperado: { id: COOPERADO_PJ, tipoPessoa: 'PJ', status: 'ATIVO', nomeCompleto: 'Santi PJ' },
        config: { valorTokenReais: 0.45 },
      });
      const asaas = buildAsaas();
      const service = buildService(prisma, asaas);

      const r = await service.comprarTokensCooperado({
        compradorCooperadoId: COOPERADO_PJ,
        cooperativaId: COOPERATIVA,
        quantidade: 100,
        formaPagamento: 'PIX',
      });

      // 1. Cria CooperTokenCompra
      expect(prisma.cooperTokenCompra.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          cooperativaId: COOPERATIVA,
          compradorCooperadoId: COOPERADO_PJ,
          quantidade: 100,
          valorTokenReais: 0.45,
          valorTotal: 45,
          formaPagamento: 'PIX',
          status: 'AGUARDANDO_PAGAMENTO',
        }),
      });

      // 2. Chama Asaas com cooperadoId + cooperativaId + valor calculado
      expect(asaas.emitirCobranca).toHaveBeenCalledWith(
        COOPERADO_PJ,
        COOPERATIVA,
        expect.objectContaining({
          valor: 45,
          descricao: expect.stringContaining('100 CooperTokens'),
          formaPagamento: 'PIX',
        }),
      );

      // 3. Linka bidirecionalmente (defesa multi-tenant via cooperativaId)
      expect(prisma.cooperTokenCompra.updateMany).toHaveBeenCalledWith({
        where: { id: 'compra-1', cooperativaId: COOPERATIVA },
        data: { asaasId: 'asaas-pay-1', asaasCobrancaId: 'asaas-cobr-1' },
      });

      // 4. Devolve payload com link/QR
      expect(r).toEqual(
        expect.objectContaining({
          compraId: 'compra-1',
          quantidade: 100,
          valorTotal: 45,
          formaPagamento: 'PIX',
          status: 'AGUARDANDO_PAGAMENTO',
          asaasId: 'asaas-pay-1',
          linkPagamento: 'https://asaas.com/i/asaas-pay-1',
          pixQrCode: 'base64-qr',
          pixCopiaECola: '00020126...',
        }),
      );
    });

    it('fallback config null → valorTokenReais=0.45 (preserva default schema)', async () => {
      const prisma = buildPrisma({
        cooperado: { id: COOPERADO_PJ, tipoPessoa: 'PJ', status: 'ATIVO', nomeCompleto: 'X' },
        config: null,
      });
      const asaas = buildAsaas();
      const service = buildService(prisma, asaas);

      const r = await service.comprarTokensCooperado({
        compradorCooperadoId: COOPERADO_PJ,
        cooperativaId: COOPERATIVA,
        quantidade: 200,
        formaPagamento: 'BOLETO',
      });

      expect(r.valorTokenReais).toBe(0.45);
      expect(r.valorTotal).toBe(90); // 200 * 0.45
      expect(asaas.emitirCobranca).toHaveBeenCalledWith(
        COOPERADO_PJ,
        COOPERATIVA,
        expect.objectContaining({ valor: 90, formaPagamento: 'BOLETO' }),
      );
    });

    it('valorTokenReais custom = 1.00 → valorTotal = quantidade × 1.00', async () => {
      const prisma = buildPrisma({
        cooperado: { id: COOPERADO_PJ, tipoPessoa: 'PJ', status: 'ATIVO_RECEBENDO_CREDITOS', nomeCompleto: 'X' },
        config: { valorTokenReais: 1.0 },
      });
      const service = buildService(prisma, buildAsaas());

      const r = await service.comprarTokensCooperado({
        compradorCooperadoId: COOPERADO_PJ,
        cooperativaId: COOPERATIVA,
        quantidade: 333,
        formaPagamento: 'PIX',
      });

      expect(r.valorTotal).toBe(333);
    });
  });

  describe('Falha do Asaas — compensa CooperTokenCompra → CANCELADO', () => {
    it('asaas.emitirCobranca lanca → marca compra CANCELADO + propaga erro', async () => {
      const prisma = buildPrisma({
        cooperado: { id: COOPERADO_PJ, tipoPessoa: 'PJ', status: 'ATIVO', nomeCompleto: 'X' },
        config: { valorTokenReais: 0.5 },
      });
      const erroAsaas = new Error('Asaas API 500');
      const asaas = buildAsaas(jest.fn().mockRejectedValue(erroAsaas));
      const service = buildService(prisma, asaas);

      await expect(
        service.comprarTokensCooperado({
          compradorCooperadoId: COOPERADO_PJ,
          cooperativaId: COOPERATIVA,
          quantidade: 100,
          formaPagamento: 'PIX',
        }),
      ).rejects.toThrow('Asaas API 500');

      // Compra criada e depois marcada como CANCELADO
      expect(prisma.cooperTokenCompra.create).toHaveBeenCalled();
      expect(prisma.cooperTokenCompra.update).toHaveBeenCalledWith({
        where: { id: 'compra-1' },
        data: { status: 'CANCELADO' },
      });
    });
  });

  describe('AsaasService nao injetado (defesa)', () => {
    it('service sem asaasService → BadRequestException antes de criar CooperTokenCompra? NAO — cria primeiro e lanca depois', async () => {
      const prisma = buildPrisma({
        cooperado: { id: COOPERADO_PJ, tipoPessoa: 'PJ', status: 'ATIVO', nomeCompleto: 'X' },
        config: { valorTokenReais: 0.45 },
      });
      const service = buildService(prisma, undefined); // sem Asaas

      await expect(
        service.comprarTokensCooperado({
          compradorCooperadoId: COOPERADO_PJ,
          cooperativaId: COOPERATIVA,
          quantidade: 100,
          formaPagamento: 'PIX',
        }),
      ).rejects.toBeInstanceOf(BadRequestException);

      // Compra eh criada antes (idempotencia: pode ser reusada manualmente).
      // Em runtime real o DI sempre injeta — guard eh so defensivo.
      expect(prisma.cooperTokenCompra.create).toHaveBeenCalled();
    });
  });
});
