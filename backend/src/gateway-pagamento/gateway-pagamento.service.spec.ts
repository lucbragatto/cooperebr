import { GatewayPagamentoService } from './gateway-pagamento.service';
import { AsaasAdapter } from './adapters/asaas.adapter';
import { BadRequestException } from '@nestjs/common';

/**
 * Sprint 7 — Testes do orquestrador de gateways.
 *
 * Cobre: resolução de adapter, emissão com persistência em CobrancaGateway,
 * cancelamento, exceção quando sem config, e testar conexão.
 */
describe('GatewayPagamentoService', () => {
  const configGatewayFindFirst = jest.fn();
  const cobrancaGatewayCreate = jest.fn();
  const cobrancaGatewayUpdateMany = jest.fn();

  const prismaMock = {
    configGateway: { findFirst: configGatewayFindFirst },
    cobrancaGateway: { create: cobrancaGatewayCreate, updateMany: cobrancaGatewayUpdateMany },
  } as any;

  const asaasAdapterMock = {
    criarCustomer: jest.fn(),
    emitirCobranca: jest.fn(),
    cancelarCobranca: jest.fn(),
    processarWebhook: jest.fn(),
    testarConexao: jest.fn(),
  } as unknown as AsaasAdapter;

  let service: GatewayPagamentoService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new GatewayPagamentoService(prismaMock, asaasAdapterMock);
  });

  it('criarCustomer: resolve Asaas adapter e delega', async () => {
    configGatewayFindFirst.mockResolvedValue({ gateway: 'ASAAS', ativo: true });
    (asaasAdapterMock.criarCustomer as jest.Mock).mockResolvedValue({ gatewayCustomerId: 'cus_123' });

    const r = await service.criarCustomer('coop-1', 'cooperativa-1');

    expect(r.gatewayCustomerId).toBe('cus_123');
    expect(asaasAdapterMock.criarCustomer).toHaveBeenCalledWith('coop-1', 'cooperativa-1');
  });

  it('emitirCobranca: emite via adapter + persiste CobrancaGateway', async () => {
    configGatewayFindFirst.mockResolvedValue({ gateway: 'ASAAS', ativo: true });
    (asaasAdapterMock.emitirCobranca as jest.Mock).mockResolvedValue({
      gatewayId: 'pay_456',
      status: 'PENDING',
      linkPagamento: 'https://asaas.com/pay',
      pixCopiaECola: 'pix123',
    });
    cobrancaGatewayCreate.mockResolvedValue({ id: 'cg-1' });

    const r = await service.emitirCobranca('coop-1', 'cooperativa-1', {
      valor: 100,
      vencimento: '2026-05-10',
      descricao: 'Teste',
      formaPagamento: 'PIX',
      cobrancaId: 'cobranca-local-1',
    });

    expect(r.gatewayId).toBe('pay_456');
    expect(r.gateway).toBe('ASAAS');
    expect(cobrancaGatewayCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          gateway: 'ASAAS',
          gatewayId: 'pay_456',
          cooperadoId: 'coop-1',
          cobrancaId: 'cobranca-local-1',
          formaPagamento: 'PIX',
        }),
      }),
    );
  });

  it('cancelarCobranca: cancela no adapter + atualiza status local', async () => {
    configGatewayFindFirst.mockResolvedValue({ gateway: 'ASAAS', ativo: true });
    (asaasAdapterMock.cancelarCobranca as jest.Mock).mockResolvedValue(undefined);
    cobrancaGatewayUpdateMany.mockResolvedValue({ count: 1 });

    await service.cancelarCobranca('pay_456', 'cooperativa-1');

    expect(asaasAdapterMock.cancelarCobranca).toHaveBeenCalledWith('pay_456', 'cooperativa-1');
    expect(cobrancaGatewayUpdateMany).toHaveBeenCalledWith({
      where: { gatewayId: 'pay_456' },
      data: { status: 'CANCELLED' },
    });
  });

  it('sem ConfigGateway ativa: lança BadRequestException', async () => {
    configGatewayFindFirst.mockResolvedValue(null);

    await expect(
      service.criarCustomer('coop-1', 'cooperativa-sem-config'),
    ).rejects.toThrow(BadRequestException);

    await expect(
      service.criarCustomer('coop-1', 'cooperativa-sem-config'),
    ).rejects.toThrow(/Nenhum gateway de pagamento configurado/);
  });

  it('testarConexao: delega pro adapter', async () => {
    configGatewayFindFirst.mockResolvedValue({ gateway: 'ASAAS', ativo: true });
    (asaasAdapterMock.testarConexao as jest.Mock).mockResolvedValue({ ok: true, totalCustomers: 61 });

    const r = await service.testarConexao('cooperativa-1');

    expect(r.ok).toBe(true);
    expect(r.totalCustomers).toBe(61);
  });

  it('gateway não suportado: lança BadRequestException', async () => {
    configGatewayFindFirst.mockResolvedValue({ gateway: 'ITAU', ativo: true });

    await expect(
      service.criarCustomer('coop-1', 'cooperativa-1'),
    ).rejects.toThrow(/não suportado/);
  });
});
