/**
 * Sprint Funil M48 (22/06/2026) — Camada 1 Fatia E.
 *
 * Specs do LeadExpansaoService.converter:
 *  - Caminho feliz: cria Cooperado + atualiza lead.status=CONVERTIDO atômico.
 *  - Multi-tenant: lead em outro tenant → 404 NotFoundException.
 *  - Idempotência: lead já CONVERTIDO → rejeita.
 *  - Normalização: cpf sem mascara, email lowercase.
 *  - lead.telefone usado se body.telefone omitido.
 */
import { LeadExpansaoService } from './lead-expansao.service';

describe('LeadExpansaoService.converter — Sprint Funil M48 Camada 1 Fatia E', () => {
  const leadFindFirst = jest.fn();
  const leadUpdate = jest.fn();
  const cooperadoCreate = jest.fn();
  const transaction = jest.fn();

  const prismaMock = {
    leadExpansao: { findFirst: leadFindFirst, update: leadUpdate },
    cooperado: { create: cooperadoCreate },
    $transaction: transaction,
  } as any;

  const service = new LeadExpansaoService(prismaMock);

  beforeEach(() => {
    jest.clearAllMocks();
    leadFindFirst.mockResolvedValue({
      id: 'lead-1',
      telefone: '5527999998888',
      status: 'AGUARDANDO',
      distribuidora: 'EDP_ES',
      cooperativaId: 'tenant-A',
    });
    cooperadoCreate.mockResolvedValue({ id: 'coop-novo' });
    leadUpdate.mockResolvedValue({});
    // Frente 2 (01/07/2026) P1: findFirst agora roda DENTRO da tx Serializable.
    // Mock do tx precisa expor leadExpansao.findFirst também.
    transaction.mockImplementation(async (fn: any, _opts?: any) =>
      fn({
        cooperado: { create: cooperadoCreate },
        leadExpansao: { update: leadUpdate, findFirst: leadFindFirst },
      }),
    );
  });

  const dadosBase = {
    nomeCompleto: 'Fulano de Tal',
    cpf: '123.456.789-00',
    email: '  Fulano@Example.COM  ',
  };

  it('caminho feliz: cria Cooperado + lead.status=CONVERTIDO atômico', async () => {
    const r = await service.converter('lead-1', 'tenant-A', dadosBase);

    expect(leadFindFirst).toHaveBeenCalledWith({
      where: { id: 'lead-1', cooperativaId: 'tenant-A' },
      select: expect.any(Object),
    });
    expect(transaction).toHaveBeenCalledTimes(1);
    expect(cooperadoCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({
        nomeCompleto: 'Fulano de Tal',
        cpf: '12345678900', // normalizado
        email: 'fulano@example.com', // lowercase + trim
        telefone: '5527999998888', // do lead (body não passou)
        status: 'PENDENTE',
        cooperativaId: 'tenant-A',
      }),
    });
    // P2 multitenant 22/06: defense-in-depth — cooperativaId no where.
    expect(leadUpdate).toHaveBeenCalledWith({
      where: { id: 'lead-1', cooperativaId: 'tenant-A' },
      data: { status: 'CONVERTIDO' },
    });
    expect(r).toEqual({ cooperadoId: 'coop-novo', leadId: 'lead-1' });
  });

  it('multi-tenant: lead em outro tenant → "não encontrado"', async () => {
    leadFindFirst.mockResolvedValue(null);
    await expect(
      service.converter('lead-1', 'tenant-A', dadosBase),
    ).rejects.toThrow(/não encontrado/);
  });

  it('idempotência: lead já CONVERTIDO → rejeita (dentro da tx Serializable)', async () => {
    leadFindFirst.mockResolvedValue({
      id: 'lead-1',
      telefone: '5527999998888',
      status: 'CONVERTIDO',
      distribuidora: 'EDP_ES',
      cooperativaId: 'tenant-A',
    });
    await expect(
      service.converter('lead-1', 'tenant-A', dadosBase),
    ).rejects.toThrow(/já foi convertido/);
    // Frente 2 (01/07/2026) P1: check acontece DENTRO da tx agora — a tx é
    // iniciada mas cooperadoCreate/leadUpdate NÃO são chamados.
    expect(cooperadoCreate).not.toHaveBeenCalled();
    expect(leadUpdate).not.toHaveBeenCalled();
  });

  it('body.telefone tem prioridade sobre lead.telefone se passado', async () => {
    await service.converter('lead-1', 'tenant-A', {
      ...dadosBase,
      telefone: '11999991111',
    });
    expect(cooperadoCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({ telefone: '11999991111' }),
    });
  });
});
