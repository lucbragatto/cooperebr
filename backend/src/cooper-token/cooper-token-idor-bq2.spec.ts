import { ForbiddenException, NotFoundException, BadRequestException } from '@nestjs/common';
import { CooperTokenService } from './cooper-token.service';

/**
 * D-novo-BQ.2 A6 (30/05/2026) — IMPACTO FINANCEIRO.
 * confirmarCompraParceiro verifica que compra.cooperativaId === req.user.cooperativaId.
 * Saldo NÃO é creditado em cross-tenant; ForbiddenException antes de qualquer credit.
 */
describe('CooperTokenService.confirmarCompraParceiro — BQ.2 A6 posse financeira', () => {
  const compraFindUnique = jest.fn();
  const compraUpdate = jest.fn();
  const txnMock = jest.fn();
  const eventEmit = jest.fn();

  // saldo "creditado" rastreado pela chamada do método interno
  let saldosCreditados: Array<{ cooperativaId: string; quantidade: number }> = [];

  const prismaMock = {
    cooperTokenCompra: {
      findUnique: compraFindUnique,
      update: compraUpdate,
    },
    $transaction: txnMock,
  } as any;

  const eventMock = { emit: eventEmit } as any;

  let service: CooperTokenService;

  beforeEach(() => {
    jest.clearAllMocks();
    saldosCreditados = [];
    service = new CooperTokenService(prismaMock, eventMock);
    // Espia creditarSaldoParceiro pra confirmar (não) crédito sem precisar mockar tx interna
    (service as any).creditarSaldoParceiro = jest.fn(
      async (cooperativaId: string, quantidade: number) => {
        saldosCreditados.push({ cooperativaId, quantidade });
        return { saldoTotal: quantidade };
      },
    );
    compraUpdate.mockResolvedValue({ id: 'compra1', status: 'PAGO' });
  });

  it('ADMIN tenant A confirmando compra do tenant B → ForbiddenException + saldo B NÃO creditado', async () => {
    compraFindUnique.mockResolvedValueOnce({
      id: 'compra1',
      cooperativaId: 'coop-B',
      quantidade: 1000,
      status: 'AGUARDANDO_PAGAMENTO',
      valorTotal: 100,
    });

    await expect(service.confirmarCompraParceiro('compra1', 'coop-A')).rejects.toThrow(
      ForbiddenException,
    );

    expect(saldosCreditados).toHaveLength(0); // CRÍTICO — nenhum credito
    expect(compraUpdate).not.toHaveBeenCalled();
    expect(eventEmit).not.toHaveBeenCalled();
  });

  it('ADMIN tenant A confirmando própria compra → sucesso + saldo creditado', async () => {
    compraFindUnique.mockResolvedValueOnce({
      id: 'compra2',
      cooperativaId: 'coop-A',
      quantidade: 500,
      status: 'AGUARDANDO_PAGAMENTO',
      valorTotal: 50,
    });

    const r = await service.confirmarCompraParceiro('compra2', 'coop-A');

    expect(r.sucesso).toBe(true);
    expect(saldosCreditados).toEqual([{ cooperativaId: 'coop-A', quantidade: 500 }]);
    expect(compraUpdate).toHaveBeenCalled();
    expect(eventEmit).toHaveBeenCalled();
  });

  it('SUPER_ADMIN (null) confirmando compra de qualquer tenant → bypass + saldo creditado', async () => {
    compraFindUnique.mockResolvedValueOnce({
      id: 'compra3',
      cooperativaId: 'coop-B',
      quantidade: 300,
      status: 'AGUARDANDO_PAGAMENTO',
      valorTotal: 30,
    });

    const r = await service.confirmarCompraParceiro('compra3', null);

    expect(r.sucesso).toBe(true);
    expect(saldosCreditados).toEqual([{ cooperativaId: 'coop-B', quantidade: 300 }]);
  });

  it('compra inexistente → NotFoundException', async () => {
    compraFindUnique.mockResolvedValueOnce(null);
    await expect(service.confirmarCompraParceiro('inex', 'coop-A')).rejects.toThrow(
      NotFoundException,
    );
  });

  it('compra já paga + cross-tenant → ForbiddenException ANTES de BadRequest (guard primeiro)', async () => {
    compraFindUnique.mockResolvedValueOnce({
      id: 'compra4',
      cooperativaId: 'coop-B',
      quantidade: 100,
      status: 'PAGO',
      valorTotal: 10,
    });
    // Guard de posse deve disparar antes do guard de status — sinaliza vazamento prevenido.
    await expect(service.confirmarCompraParceiro('compra4', 'coop-A')).rejects.toThrow(
      ForbiddenException,
    );
    expect(saldosCreditados).toHaveLength(0);
  });

  it('compra já paga (mesmo tenant) → BadRequestException (idempotência)', async () => {
    compraFindUnique.mockResolvedValueOnce({
      id: 'compra5',
      cooperativaId: 'coop-A',
      quantidade: 100,
      status: 'PAGO',
      valorTotal: 10,
    });
    await expect(service.confirmarCompraParceiro('compra5', 'coop-A')).rejects.toThrow(
      BadRequestException,
    );
    expect(saldosCreditados).toHaveLength(0);
  });
});
