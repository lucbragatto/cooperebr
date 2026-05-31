import { BadRequestException } from '@nestjs/common';
import { AsaasService } from './asaas.service';

/**
 * D-novo-BR F0.5 CRITICO (31/05/2026) — asaas.cancelarCobranca exige posse
 * via cooperado.cooperativaId. AsaasCobranca não tem coluna direta.
 *
 * NOTA: smoke não chama API Asaas real — apenas valida guard antes do client.
 */
describe('AsaasService.cancelarCobranca — F0.5 CRITICO', () => {
  const asaasFindFirst = jest.fn();
  const asaasUpdateMany = jest.fn();
  const getApiClient = jest.fn();

  const prismaMock = {
    asaasCobranca: { findFirst: asaasFindFirst, updateMany: asaasUpdateMany },
  } as any;

  let service: AsaasService;

  beforeEach(() => {
    jest.clearAllMocks();
    process.env.ASAAS_ENCRYPTION_KEY = '0'.repeat(64);
    service = new AsaasService(prismaMock, { onEvent: jest.fn() } as any, { encrypt: (s: string) => s, decrypt: (s: string) => s } as any);
    // intercepta getApiClient pra não chamar API real
    (service as any).getApiClient = getApiClient;
    getApiClient.mockResolvedValue({ delete: jest.fn().mockResolvedValue({}) });
    asaasUpdateMany.mockResolvedValue({ count: 1 });
  });

  it('ADMIN tenant B tentando cancelar cobrança tenant A → BadRequestException ANTES do client externo', async () => {
    asaasFindFirst.mockResolvedValueOnce(null);
    await expect(service.cancelarCobranca('pay_abc', 'coop-B')).rejects.toThrow(BadRequestException);
    expect(getApiClient).not.toHaveBeenCalled();
    expect(asaasUpdateMany).not.toHaveBeenCalled();
  });

  it('ADMIN tenant A cancelando própria → guard passa e chama client', async () => {
    asaasFindFirst.mockResolvedValueOnce({ id: 'c1', cooperado: { cooperativaId: 'coop-A' } });
    const r = await service.cancelarCobranca('pay_abc', 'coop-A');
    expect(r.message).toContain('sucesso');
    expect(getApiClient).toHaveBeenCalledWith('coop-A');
  });

  it('SUPER_ADMIN (null) → descobre tenant da cobrança e chama client', async () => {
    asaasFindFirst.mockResolvedValueOnce({ id: 'c1', cooperado: { cooperativaId: 'coop-X' } });
    const r = await service.cancelarCobranca('pay_abc', null);
    expect(r.message).toContain('sucesso');
    expect(getApiClient).toHaveBeenCalledWith('coop-X');
  });
});
