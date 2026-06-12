/**
 * Sprint Clube P1 — F6 Bloco A (12/06/2026).
 *
 * Specs do helper AsaasPixOutService extraído do pix-excedente.
 * Cobertura:
 *
 *   Validações universais (cooperativaId, pixChave, pixTipo, valor)
 *   Ambiente NÃO-real → SIMULATED sem chamar Asaas
 *   Ambiente real → POST /transfers + asaasTransferId + status PENDING/DONE
 *   Asaas erro → status ERROR + raw response preservado
 *   pixTipoMap correto (CPF/CNPJ/EMAIL/TELEFONE→PHONE/ALEATORIA→EVP)
 */
import { BadRequestException } from '@nestjs/common';
import {
  AsaasPixOutService,
  AsaasPixOutTransferirParams,
} from './asaas-pix-out.service';
import * as ambiente from '../common/safety/ambiente';

function setup(opts: { ambienteReal?: boolean; postResponse?: any; postLanca?: Error } = {}) {
  jest
    .spyOn(ambiente, 'isAmbienteReal')
    .mockReturnValue(opts.ambienteReal ?? false);

  const post = opts.postLanca
    ? jest.fn().mockRejectedValue(opts.postLanca)
    : jest.fn().mockResolvedValue({
        data: opts.postResponse ?? { id: 'tx-asaas-001', status: 'PENDING' },
      });
  const apiClient: any = { post };
  const asaasService = {
    getApiClient: jest.fn().mockResolvedValue(apiClient),
  };

  const service = new AsaasPixOutService(asaasService as any);
  return { service, asaasService, post };
}

const baseParams = (over: Partial<AsaasPixOutTransferirParams> = {}): AsaasPixOutTransferirParams => ({
  cooperativaId: 'coop-A',
  pixChave: 'lucbragatto@gmail.com',
  pixTipo: 'EMAIL',
  valor: 100,
  descricao: 'F6 smoke test',
  ...over,
});

afterEach(() => jest.restoreAllMocks());

describe('AsaasPixOutService — validações universais', () => {
  it('cooperativaId vazio → BadRequest', async () => {
    const { service } = setup();
    await expect(
      service.transferir(baseParams({ cooperativaId: '' })),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('pixChave vazia → BadRequest com mensagem anti-fraude', async () => {
    const { service } = setup();
    await expect(
      service.transferir(baseParams({ pixChave: '' })),
    ).rejects.toThrow(/pixChave obrigatória.*anti-fraude/);
  });

  it('pixChave só whitespace → BadRequest', async () => {
    const { service } = setup();
    await expect(
      service.transferir(baseParams({ pixChave: '   ' })),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('pixTipo inválido → BadRequest', async () => {
    const { service } = setup();
    await expect(
      service.transferir(baseParams({ pixTipo: 'INVALID_TYPE' })),
    ).rejects.toThrow(/pixTipo inválido/);
  });

  it('valor zero → BadRequest', async () => {
    const { service } = setup();
    await expect(
      service.transferir(baseParams({ valor: 0 })),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('valor negativo → BadRequest', async () => {
    const { service } = setup();
    await expect(
      service.transferir(baseParams({ valor: -50 })),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('valor NaN → BadRequest', async () => {
    const { service } = setup();
    await expect(
      service.transferir(baseParams({ valor: NaN })),
    ).rejects.toBeInstanceOf(BadRequestException);
  });
});

describe('AsaasPixOutService — ambiente NÃO-real (SIMULATED)', () => {
  it('isAmbienteReal=false → SIMULATED, NÃO chama Asaas', async () => {
    const { service, asaasService, post } = setup({ ambienteReal: false });
    const r = await service.transferir(baseParams());
    expect(r.status).toBe('SIMULATED');
    expect(r.asaasTransferId).toMatch(/^simulated-/);
    expect(r.raw).toEqual(expect.objectContaining({ simulated: true }));
    expect(asaasService.getApiClient).not.toHaveBeenCalled();
    expect(post).not.toHaveBeenCalled();
  });

  it('SIMULATED gera asaasTransferId único por chamada', async () => {
    const { service } = setup({ ambienteReal: false });
    const r1 = await service.transferir(baseParams());
    const r2 = await service.transferir(baseParams());
    expect(r1.asaasTransferId).not.toBe(r2.asaasTransferId);
  });
});

describe('AsaasPixOutService — ambiente real (Asaas)', () => {
  it('POST /transfers + retorna asaasTransferId + status PENDING (resposta != DONE)', async () => {
    const { service, asaasService, post } = setup({
      ambienteReal: true,
      postResponse: { id: 'tx-asaas-123', status: 'PENDING' },
    });
    const r = await service.transferir(baseParams());
    expect(r.asaasTransferId).toBe('tx-asaas-123');
    expect(r.status).toBe('PENDING');
    expect(asaasService.getApiClient).toHaveBeenCalledWith('coop-A');
    expect(post).toHaveBeenCalledWith(
      '/transfers',
      expect.objectContaining({
        value: 100,
        operationType: 'PIX',
        pixAddressKey: 'lucbragatto@gmail.com',
        pixAddressKeyType: 'EMAIL',
        description: 'F6 smoke test',
      }),
    );
  });

  it('Asaas status=DONE → status=DONE no helper', async () => {
    const { service } = setup({
      ambienteReal: true,
      postResponse: { id: 'tx-1', status: 'DONE' },
    });
    const r = await service.transferir(baseParams());
    expect(r.status).toBe('DONE');
  });

  it('valor arredondado pra 2 casas no payload Asaas', async () => {
    const { service, post } = setup({
      ambienteReal: true,
      postResponse: { id: 'tx-2', status: 'PENDING' },
    });
    await service.transferir(baseParams({ valor: 100.4567 }));
    expect(post.mock.calls[0][1].value).toBe(100.46);
  });

  it('pixTipo TELEFONE mapeia pra PHONE no Asaas', async () => {
    const { service, post } = setup({
      ambienteReal: true,
      postResponse: { id: 'tx-3', status: 'PENDING' },
    });
    await service.transferir(
      baseParams({ pixTipo: 'TELEFONE', pixChave: '+5527981341348' }),
    );
    expect(post.mock.calls[0][1].pixAddressKeyType).toBe('PHONE');
  });

  it('pixTipo ALEATORIA mapeia pra EVP', async () => {
    const { service, post } = setup({
      ambienteReal: true,
      postResponse: { id: 'tx-4', status: 'PENDING' },
    });
    await service.transferir(
      baseParams({ pixTipo: 'ALEATORIA', pixChave: 'random-key-uuid' }),
    );
    expect(post.mock.calls[0][1].pixAddressKeyType).toBe('EVP');
  });

  it('pixTipo CPF mapeia pra CPF', async () => {
    const { service, post } = setup({
      ambienteReal: true,
      postResponse: { id: 'tx-5', status: 'PENDING' },
    });
    await service.transferir(
      baseParams({ pixTipo: 'CPF', pixChave: '11111111111' }),
    );
    expect(post.mock.calls[0][1].pixAddressKeyType).toBe('CPF');
  });

  it('pixTipo case-insensitive (telefone minúsculo → PHONE)', async () => {
    const { service, post } = setup({
      ambienteReal: true,
      postResponse: { id: 'tx-6', status: 'PENDING' },
    });
    await service.transferir(baseParams({ pixTipo: 'telefone' }));
    expect(post.mock.calls[0][1].pixAddressKeyType).toBe('PHONE');
  });
});

describe('AsaasPixOutService — Asaas erro (preserva raw)', () => {
  it('Asaas rejeita → status=ERROR + raw response preservado + erro humano', async () => {
    const err: any = new Error('Asaas rejected');
    err.response = {
      data: {
        errors: [{ code: 'invalid_pixAddressKey', description: 'Chave PIX inválida' }],
      },
    };
    const { service } = setup({ ambienteReal: true, postLanca: err });
    const r = await service.transferir(baseParams());
    expect(r.status).toBe('ERROR');
    expect(r.asaasTransferId).toBeNull();
    expect(r.raw).toEqual(err.response.data);
    expect(r.erro).toMatch(/invalid_pixAddressKey/);
  });

  it('Asaas timeout/erro de rede → ERROR sem raw', async () => {
    const err = new Error('ETIMEDOUT');
    const { service } = setup({ ambienteReal: true, postLanca: err });
    const r = await service.transferir(baseParams());
    expect(r.status).toBe('ERROR');
    expect(r.erro).toMatch(/ETIMEDOUT/);
  });
});
