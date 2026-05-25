import { BanestesAdapter } from './banestes.adapter';
import { BanestesConfigService } from './banestes-config.service';
import { GatewayError } from '../errors/gateway-error';
import { NotImplementedException } from '@nestjs/common';

describe('BanestesAdapter', () => {
  let adapter: BanestesAdapter;
  let configMock: jest.Mocked<BanestesConfigService>;
  let postMock: jest.Mock;
  let getMock: jest.Mock;
  let prismaMock: any;

  const COOPERADO_ID = 'coop-luciano';
  const TENANT_ID = 'coop-A';

  beforeEach(() => {
    postMock = jest.fn();
    getMock = jest.fn();

    configMock = {
      getAccessToken: jest.fn().mockResolvedValue('tok-fake-123'),
      getHttpClient: jest.fn().mockReturnValue({ post: postMock, get: getMock }),
      invalidarTokenCache: jest.fn(),
    } as any;

    prismaMock = {
      cooperado: { findFirst: jest.fn() },
      configGateway: { findFirst: jest.fn() },
    };

    adapter = new BanestesAdapter(configMock, prismaMock);
  });

  describe('criarCustomer (no-op)', () => {
    it('Retorna placeholder com prefixo banestes:', async () => {
      const r = await adapter.criarCustomer(COOPERADO_ID, TENANT_ID);
      expect(r.gatewayCustomerId).toBe(`banestes:${COOPERADO_ID}`);
      // Sem chamada HTTP — confirma no-op
      expect(postMock).not.toHaveBeenCalled();
      expect(getMock).not.toHaveBeenCalled();
    });
  });

  describe('emitirCobranca (PIX)', () => {
    const dadosBase = {
      valor: 100.5,
      vencimento: '2026-06-10',
      descricao: 'Cobranca Carolina mai/2026',
      formaPagamento: 'PIX' as const,
      cobrancaId: 'cob-real-1',
    };

    const cooperadoFake = {
      id: COOPERADO_ID,
      nomeCompleto: 'Carolina Lemos Cravo',
      cpf: '08649654789',
    };

    const configGatewayFake = {
      credenciais: { chavePix: 'cooperebr@pix.banestes.b.br' },
    };

    beforeEach(() => {
      prismaMock.cooperado.findFirst.mockResolvedValue(cooperadoFake);
      prismaMock.configGateway.findFirst.mockResolvedValue(configGatewayFake);
    });

    it('Rejeita formaPagamento != PIX', async () => {
      let caught: GatewayError | null = null;
      try {
        await adapter.emitirCobranca(COOPERADO_ID, TENANT_ID, {
          ...dadosBase,
          formaPagamento: 'BOLETO' as any,
        });
      } catch (e) {
        caught = e as GatewayError;
      }
      expect(caught).toBeInstanceOf(GatewayError);
      expect(caught!.code).toBe('DESCONHECIDO');
      expect(caught!.message).toMatch(/PIX/);
    });

    it('Rejeita cooperado nao encontrado no tenant', async () => {
      prismaMock.cooperado.findFirst.mockResolvedValueOnce(null);

      let caught: GatewayError | null = null;
      try {
        await adapter.emitirCobranca(COOPERADO_ID, TENANT_ID, dadosBase);
      } catch (e) {
        caught = e as GatewayError;
      }
      expect(caught!.code).toBe('COOPERADO_INVALIDO');
      expect(caught!.message).toMatch(/nao encontrado/);
    });

    it('Rejeita cooperado sem CPF/CNPJ', async () => {
      prismaMock.cooperado.findFirst.mockResolvedValueOnce({ ...cooperadoFake, cpf: '' });

      let caught: GatewayError | null = null;
      try {
        await adapter.emitirCobranca(COOPERADO_ID, TENANT_ID, dadosBase);
      } catch (e) {
        caught = e as GatewayError;
      }
      expect(caught!.code).toBe('COOPERADO_INVALIDO');
      expect(caught!.message).toMatch(/CPF\/CNPJ/);
    });

    it('Rejeita quando ConfigGateway sem chavePix', async () => {
      prismaMock.configGateway.findFirst.mockResolvedValueOnce({
        credenciais: {}, // sem chavePix
      });

      let caught: GatewayError | null = null;
      try {
        await adapter.emitirCobranca(COOPERADO_ID, TENANT_ID, dadosBase);
      } catch (e) {
        caught = e as GatewayError;
      }
      expect(caught!.code).toBe('CREDENCIAIS_INVALIDAS');
      expect(caught!.message).toMatch(/chave PIX/);
    });

    it('Rejeita quando ConfigGateway nao existe pro tenant', async () => {
      prismaMock.configGateway.findFirst.mockResolvedValueOnce(null);

      let caught: GatewayError | null = null;
      try {
        await adapter.emitirCobranca(COOPERADO_ID, TENANT_ID, dadosBase);
      } catch (e) {
        caught = e as GatewayError;
      }
      expect(caught!.code).toBe('CREDENCIAIS_INVALIDAS');
    });

    it('Sucesso 201: monta payload PIX correto (CPF + valor + chave + infoAdicionais)', async () => {
      postMock.mockResolvedValueOnce({
        status: 201,
        data: {
          txid: 'txid-banestes-abc',
          pixCopiaECola: '00020101021226...',
          status: 'ATIVA',
          location: 'https://pix.banestes.b.br/qr/abc',
        },
      });

      const r = await adapter.emitirCobranca(COOPERADO_ID, TENANT_ID, dadosBase);

      expect(r.gatewayId).toBe('txid-banestes-abc');
      expect(r.pixCopiaECola).toBe('00020101021226...');
      expect(r.status).toBe('ATIVA');
      expect(r.dadosExtras?.chave).toBe('cooperebr@pix.banestes.b.br');

      const [url, payload, options] = postMock.mock.calls[0];
      expect(url).toBe('/pix-qrcode-cobranca/v1/cob/');
      expect(payload).toEqual(
        expect.objectContaining({
          chave: 'cooperebr@pix.banestes.b.br',
          valor: expect.objectContaining({ original: '100.50', modalidadeAlteracao: 0 }),
          devedor: expect.objectContaining({
            nome: 'Carolina Lemos Cravo',
            cpf: '08649654789',
          }),
        }),
      );
      expect(payload.devedor.cnpj).toBeUndefined();
      expect(payload.infoAdicionais).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ nome: 'cobrancaId', valor: 'cob-real-1' }),
          expect.objectContaining({ nome: 'cooperadoId', valor: COOPERADO_ID }),
        ]),
      );

      // Authorization Bearer com o token
      expect(options.headers.Authorization).toBe('Bearer tok-fake-123');
      expect(options.headers['Content-Type']).toBe('application/json');
    });

    it('Sucesso CNPJ: usa campo cnpj no devedor (nao cpf)', async () => {
      prismaMock.cooperado.findFirst.mockResolvedValueOnce({
        ...cooperadoFake,
        cpf: '12345678000190', // 14 digitos = CNPJ
      });
      postMock.mockResolvedValueOnce({
        status: 201,
        data: { txid: 'txid-pj', pixCopiaECola: 'pix-pj' },
      });

      await adapter.emitirCobranca(COOPERADO_ID, TENANT_ID, dadosBase);

      const payload = postMock.mock.calls[0][1];
      expect(payload.devedor.cnpj).toBe('12345678000190');
      expect(payload.devedor.cpf).toBeUndefined();
    });

    it('CPF/CNPJ sanitizado (remove pontos/traços)', async () => {
      prismaMock.cooperado.findFirst.mockResolvedValueOnce({
        ...cooperadoFake,
        cpf: '086.496.547-89',
      });
      postMock.mockResolvedValueOnce({
        status: 201,
        data: { txid: 'tx', pixCopiaECola: 'p' },
      });

      await adapter.emitirCobranca(COOPERADO_ID, TENANT_ID, dadosBase);
      const payload = postMock.mock.calls[0][1];
      expect(payload.devedor.cpf).toBe('08649654789');
    });

    it('Valor formata com 2 casas decimais', async () => {
      postMock.mockResolvedValueOnce({
        status: 201,
        data: { txid: 'tx', pixCopiaECola: 'p' },
      });
      await adapter.emitirCobranca(COOPERADO_ID, TENANT_ID, { ...dadosBase, valor: 50 });
      let payload = postMock.mock.calls[0][1];
      expect(payload.valor.original).toBe('50.00');

      postMock.mockResolvedValueOnce({
        status: 201,
        data: { txid: 'tx2', pixCopiaECola: 'p2' },
      });
      await adapter.emitirCobranca(COOPERADO_ID, TENANT_ID, { ...dadosBase, valor: 0.99 });
      payload = postMock.mock.calls[1][1];
      expect(payload.valor.original).toBe('0.99');
    });

    it('Descricao trunca pra 140 chars (limite Banestes)', async () => {
      postMock.mockResolvedValueOnce({
        status: 201,
        data: { txid: 'tx', pixCopiaECola: 'p' },
      });

      const desc200 = 'X'.repeat(200);
      await adapter.emitirCobranca(COOPERADO_ID, TENANT_ID, { ...dadosBase, descricao: desc200 });
      const payload = postMock.mock.calls[0][1];
      expect(payload.solicitacaoPagador.length).toBe(140);
    });

    it('Sem cobrancaId: nao inclui infoAdicionais', async () => {
      postMock.mockResolvedValueOnce({
        status: 201,
        data: { txid: 'tx', pixCopiaECola: 'p' },
      });

      const dadosSemCobrancaId = { ...dadosBase };
      delete (dadosSemCobrancaId as any).cobrancaId;
      await adapter.emitirCobranca(COOPERADO_ID, TENANT_ID, dadosSemCobrancaId);
      const payload = postMock.mock.calls[0][1];
      expect(payload.infoAdicionais).toBeUndefined();
    });

    it('HTTP 401 traduz CREDENCIAIS_INVALIDAS + invalida cache token', async () => {
      postMock.mockResolvedValueOnce({
        status: 401,
        data: { title: 'invalid_token' },
      });

      let caught: GatewayError | null = null;
      try {
        await adapter.emitirCobranca(COOPERADO_ID, TENANT_ID, dadosBase);
      } catch (e) {
        caught = e as GatewayError;
      }
      expect(caught!.code).toBe('CREDENCIAIS_INVALIDAS');
      expect(configMock.invalidarTokenCache).toHaveBeenCalled();
    });

    it('HTTP 400 com mensagem CPF traduz COOPERADO_INVALIDO', async () => {
      postMock.mockResolvedValueOnce({
        status: 400,
        data: { detail: 'CPF do devedor invalido' },
      });

      let caught: GatewayError | null = null;
      try {
        await adapter.emitirCobranca(COOPERADO_ID, TENANT_ID, dadosBase);
      } catch (e) {
        caught = e as GatewayError;
      }
      expect(caught!.code).toBe('COOPERADO_INVALIDO');
    });

    it('HTTP 500 traduz GATEWAY_INDISPONIVEL (retryable)', async () => {
      postMock.mockResolvedValueOnce({
        status: 500,
        data: { error: 'internal' },
      });

      let caught: GatewayError | null = null;
      try {
        await adapter.emitirCobranca(COOPERADO_ID, TENANT_ID, dadosBase);
      } catch (e) {
        caught = e as GatewayError;
      }
      expect(caught!.code).toBe('GATEWAY_INDISPONIVEL');
      expect(caught!.retryable).toBe(true);
    });

    it('ECONNREFUSED traduz GATEWAY_INDISPONIVEL', async () => {
      const netErr = new Error('connect ECONNREFUSED 1.2.3.4:443');
      (netErr as any).code = 'ECONNREFUSED';
      postMock.mockRejectedValueOnce(netErr);

      let caught: GatewayError | null = null;
      try {
        await adapter.emitirCobranca(COOPERADO_ID, TENANT_ID, dadosBase);
      } catch (e) {
        caught = e as GatewayError;
      }
      expect(caught!.code).toBe('GATEWAY_INDISPONIVEL');
      expect(caught!.retryable).toBe(true);
    });

    it('Resposta 200 mas sem txid lanca DESCONHECIDO', async () => {
      postMock.mockResolvedValueOnce({
        status: 200,
        data: { pixCopiaECola: 'p' }, // sem txid
      });

      let caught: GatewayError | null = null;
      try {
        await adapter.emitirCobranca(COOPERADO_ID, TENANT_ID, dadosBase);
      } catch (e) {
        caught = e as GatewayError;
      }
      expect(caught!.code).toBe('DESCONHECIDO');
    });
  });

  describe('cancelarCobranca (stub Cenario Completo)', () => {
    it('Lanca NotImplementedException', async () => {
      await expect(adapter.cancelarCobranca('tx1', TENANT_ID)).rejects.toThrow(NotImplementedException);
    });
  });

  describe('processarWebhook (stub Cenario Completo)', () => {
    it('Lanca NotImplementedException com referencia ao D-novo-AH', async () => {
      await expect(adapter.processarWebhook({}, 'tok')).rejects.toThrow(NotImplementedException);
      try {
        await adapter.processarWebhook({}, 'tok');
      } catch (e) {
        expect((e as Error).message).toMatch(/D-novo-AH/);
      }
    });
  });

  describe('testarConexao', () => {
    it('Sucesso 200 retorna ok=true + totalCustomers (qtd ult 24h)', async () => {
      getMock.mockResolvedValueOnce({
        status: 200,
        data: {
          parametros: { paginacao: { quantidadeTotalDeItens: 5 } },
          cobs: [],
        },
      });

      const r = await adapter.testarConexao(TENANT_ID);
      expect(r.ok).toBe(true);
      expect(r.totalCustomers).toBe(5);
    });

    it('HTTP 401 retorna ok=false com erro tipado', async () => {
      getMock.mockResolvedValueOnce({ status: 401, data: { error: 'invalid' } });

      const r = await adapter.testarConexao(TENANT_ID);
      expect(r.ok).toBe(false);
      expect(r.erro).toMatch(/HTTP 401/);
    });

    it('GatewayError de getAccessToken propaga como erro estruturado', async () => {
      (configMock.getAccessToken as jest.Mock).mockRejectedValueOnce(
        new GatewayError({
          code: 'CREDENCIAIS_INVALIDAS',
          message: 'Senha .pfx invalida',
          retryable: false,
        }),
      );

      const r = await adapter.testarConexao(TENANT_ID);
      expect(r.ok).toBe(false);
      expect(r.erro).toMatch(/CREDENCIAIS_INVALIDAS/);
      expect(r.erro).toMatch(/Senha \.pfx invalida/);
    });

    it('ECONNREFUSED retorna ok=false com codigo GATEWAY_INDISPONIVEL', async () => {
      const netErr = new Error('ECONNREFUSED');
      (netErr as any).code = 'ECONNREFUSED';
      getMock.mockRejectedValueOnce(netErr);

      const r = await adapter.testarConexao(TENANT_ID);
      expect(r.ok).toBe(false);
      expect(r.erro).toMatch(/GATEWAY_INDISPONIVEL/);
    });
  });
});
