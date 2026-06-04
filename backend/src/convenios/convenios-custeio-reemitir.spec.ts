/**
 * Sprint Financeiro F1 (04/06/2026) — Specs do método reemitirCobrancaConsolidada.
 *
 * Cobre:
 *  1. Cobrança inexistente / não vinculada ao convênio → NotFound (multi-tenant).
 *  2. Cobrança já EMITIDO → BadRequest (nada a reemitir).
 *  3. Pagador sem cooperado configurado → BadRequest.
 *  4. SUCESSO: reset (tentativas=0, AGUARDANDO_EMISSAO, erro null) →
 *     emitirNoGateway chamado → retorna estado pós-tentativa.
 *
 * Não cobre a integração com gateway em si (testada em gateway-pagamento/*.spec).
 */
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { ConveniosCusteioService } from './convenios-custeio.service';

describe('ConveniosCusteioService.reemitirCobrancaConsolidada — F1.4', () => {
  const findFirstCobranca = jest.fn();
  const findUniqueCobranca = jest.fn();
  const updateCobranca = jest.fn();
  const emitirCobrancaGateway = jest.fn();
  const findUniqueFormaPagamento = jest.fn();

  const prismaMock = {
    cobranca: {
      findFirst: findFirstCobranca,
      findUnique: findUniqueCobranca,
      update: updateCobranca,
    },
    formaPagamentoCooperado: { findUnique: findUniqueFormaPagamento },
  } as any;

  const gatewayMock = { emitirCobranca: emitirCobrancaGateway } as any;

  let service: ConveniosCusteioService;

  beforeEach(() => {
    jest.clearAllMocks();
    process.env.AMBIENTE_REAL = 'true';
    service = new ConveniosCusteioService(prismaMock, gatewayMock);
  });

  afterAll(() => {
    delete process.env.AMBIENTE_REAL;
  });

  it('NotFound quando cobrança não pertence ao convênio/tenant', async () => {
    findFirstCobranca.mockResolvedValueOnce(null);

    await expect(
      service.reemitirCobrancaConsolidada({
        convenioId: 'conv-1',
        cobrancaId: 'cob-orfa',
        cooperativaId: 'coop-1',
      }),
    ).rejects.toThrow(NotFoundException);

    expect(updateCobranca).not.toHaveBeenCalled();
    expect(emitirCobrancaGateway).not.toHaveBeenCalled();
  });

  it('BadRequest quando cobrança já está EMITIDO', async () => {
    findFirstCobranca.mockResolvedValueOnce({
      id: 'cob-1',
      valorLiquido: 100,
      dataVencimento: new Date('2026-06-10'),
      mesReferencia: 5,
      anoReferencia: 2026,
      statusEmissao: 'EMITIDO',
      convenioContabilCobranca: {
        empresaNome: 'Empresa X',
        pagadorCooperadoId: 'pag-1',
        cooperativaId: 'coop-1',
      },
    });

    await expect(
      service.reemitirCobrancaConsolidada({
        convenioId: 'conv-1',
        cobrancaId: 'cob-1',
        cooperativaId: 'coop-1',
      }),
    ).rejects.toThrow(BadRequestException);

    expect(updateCobranca).not.toHaveBeenCalled();
  });

  it('BadRequest quando convênio sem pagadorCooperadoId', async () => {
    findFirstCobranca.mockResolvedValueOnce({
      id: 'cob-1',
      valorLiquido: 100,
      dataVencimento: new Date('2026-06-10'),
      mesReferencia: 5,
      anoReferencia: 2026,
      statusEmissao: 'FALHA_EMISSAO',
      convenioContabilCobranca: {
        empresaNome: 'Empresa X',
        pagadorCooperadoId: null, // não configurado
        cooperativaId: 'coop-1',
      },
    });

    await expect(
      service.reemitirCobrancaConsolidada({
        convenioId: 'conv-1',
        cobrancaId: 'cob-1',
        cooperativaId: 'coop-1',
      }),
    ).rejects.toThrow(BadRequestException);

    expect(updateCobranca).not.toHaveBeenCalled();
  });

  it('SUCESSO: reseta tentativas → chama emitirNoGateway → retorna estado atual', async () => {
    findFirstCobranca.mockResolvedValueOnce({
      id: 'cob-1',
      valorLiquido: 1234.56,
      dataVencimento: new Date('2026-06-10'),
      mesReferencia: 5,
      anoReferencia: 2026,
      statusEmissao: 'FALHA_EMISSAO',
      convenioContabilCobranca: {
        empresaNome: 'Empresa Falhou',
        pagadorCooperadoId: 'pag-1',
        cooperativaId: 'coop-1',
      },
    });

    // 1ª update (reset) + 2ª update (sucesso dentro de emitirNoGateway)
    updateCobranca
      .mockResolvedValueOnce(undefined) // reset AGUARDANDO + tentativas=0
      .mockResolvedValueOnce(undefined); // success EMITIDO

    // Mock da forma de pagamento (necessário pra emitirNoGateway ir até o fim)
    findUniqueFormaPagamento.mockResolvedValueOnce({ tipo: 'BOLETO' });

    // Mock do gateway respondendo OK
    emitirCobrancaGateway.mockResolvedValueOnce({
      gateway: 'asaas',
      gatewayId: 'asa-123',
      status: 'PENDING',
    });

    findUniqueCobranca.mockResolvedValueOnce({
      statusEmissao: 'EMITIDO',
      tentativasEmissao: 0,
      ultimoErroEmissao: null,
    });

    const r = await service.reemitirCobrancaConsolidada({
      convenioId: 'conv-1',
      cobrancaId: 'cob-1',
      cooperativaId: 'coop-1',
    });

    expect(r).toEqual({
      cobrancaId: 'cob-1',
      statusEmissao: 'EMITIDO',
      tentativasEmissao: 0,
      ultimoErroEmissao: null,
    });

    // 1ª chamada update — reset
    expect(updateCobranca).toHaveBeenNthCalledWith(1, {
      where: { id: 'cob-1' },
      data: {
        statusEmissao: 'AGUARDANDO_EMISSAO',
        tentativasEmissao: 0,
        ultimoErroEmissao: null,
        ultimaTentativaEmissaoEm: null,
      },
    });

    // Gateway foi chamado com os argumentos corretos
    expect(emitirCobrancaGateway).toHaveBeenCalledWith(
      'pag-1',
      'coop-1',
      expect.objectContaining({
        valor: 1234.56,
        formaPagamento: 'BOLETO',
        cobrancaId: 'cob-1',
        descricao: 'Cobrança consolidada — Empresa Falhou — 05/2026',
      }),
    );
  });

  it('Reemissão pode ocorrer em AGUARDANDO_EMISSAO travada (não só FALHA)', async () => {
    findFirstCobranca.mockResolvedValueOnce({
      id: 'cob-1',
      valorLiquido: 100,
      dataVencimento: new Date('2026-06-10'),
      mesReferencia: 5,
      anoReferencia: 2026,
      statusEmissao: 'AGUARDANDO_EMISSAO',
      convenioContabilCobranca: {
        empresaNome: 'Empresa X',
        pagadorCooperadoId: 'pag-1',
        cooperativaId: 'coop-1',
      },
    });
    updateCobranca.mockResolvedValue(undefined);
    findUniqueFormaPagamento.mockResolvedValueOnce({ tipo: 'PIX' });
    emitirCobrancaGateway.mockResolvedValueOnce({
      gateway: 'banestes',
      gatewayId: 'ban-1',
      status: 'PENDING',
    });
    findUniqueCobranca.mockResolvedValueOnce({
      statusEmissao: 'EMITIDO',
      tentativasEmissao: 0,
      ultimoErroEmissao: null,
    });

    await expect(
      service.reemitirCobrancaConsolidada({
        convenioId: 'conv-1',
        cobrancaId: 'cob-1',
        cooperativaId: 'coop-1',
      }),
    ).resolves.toMatchObject({ statusEmissao: 'EMITIDO' });
  });
});
