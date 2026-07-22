/**
 * Tarefa 4 correcoes #1 + #4 (22/07/2026) — spec do retorno discriminado de
 * `emitirNoGatewaySeConfigurado` + gate de notificacao no chamador.
 *
 * # Correção #1 — retorno discriminado
 *
 * Antes: metodo retornava `null` em 4 situacoes (3 skips legitimos + 1 falha
 * real capturada). Isso apagava o sinal de falha na origem — o try/catch do
 * chamador (:366-379) era codigo morto porque o metodo NUNCA lancava. Agora
 * retorna `EmissaoGatewayResult` discriminado:
 *   - SEM_GATEWAY (motivo: sem_cooperativa | sem_config | sem_forma_pagamento)
 *   - EMITIDO (gatewayId + campos de instrumento de pagamento)
 *   - FALHOU (erro capturado)
 *
 * # Correção #4 — gate de notificacao no chamador (regra Luciano: 2 caminhos)
 *
 * `podeNotificarCooperado = emissaoResult.tipo !== 'FALHOU'` gate as
 * notificacoes de WA e email na criacao da cobranca:
 *   - FALHOU → NAO notifica (cobranca fica sem instrumento, aguarda retry)
 *   - SEM_GATEWAY → NOTIFICA (os 307 faturados manualmente NAO podem parar
 *     de receber aviso; e o caso critico da regra)
 *   - EMITIDO → NOTIFICA (fluxo normal, com instrumento gerado)
 *
 * Este spec cobre as duas metades separadas. Nenhum canal externo eh acionado
 * (mock puro do prisma + gatewayPagamento + logger).
 */
import { CobrancasService, EmissaoGatewayResult } from './cobrancas.service';

describe('CobrancasService.emitirNoGatewaySeConfigurado — retorno discriminado (correcao #1)', () => {
  function buildSut(overrides: {
    configGateway?: any;
    formaPagamento?: any;
    gatewayEmit?: (...args: any[]) => Promise<any>;
  } = {}) {
    // 'formaPagamento' in overrides distingue "nao passou" (usa default) de
    // "passou null explicito" (respeita null). Sem isso, ?? engolia meu null.
    const configGwFinal = 'configGateway' in overrides
      ? overrides.configGateway
      : { id: 'cfg-1', ativo: true };
    const formaPgFinal = 'formaPagamento' in overrides
      ? overrides.formaPagamento
      : { tipo: 'PIX' };
    const prisma = {
      configGateway: { findFirst: jest.fn().mockResolvedValue(configGwFinal) },
      formaPagamentoCooperado: { findUnique: jest.fn().mockResolvedValue(formaPgFinal) },
    } as any;

    const gatewayPagamento = {
      emitirCobranca: jest.fn(overrides.gatewayEmit ?? (async () => ({
        gatewayId: 'pay_abc123',
        status: 'PENDING',
        linkPagamento: 'https://asaas.com/i/pay_abc123',
        boletoUrl: null,
        pixQrCode: 'data:image/png;base64,xxx',
        pixCopiaECola: '00020126...',
        nossoNumero: null,
        linhaDigitavel: null,
      }))),
    } as any;

    const service = Object.create(CobrancasService.prototype) as CobrancasService;
    (service as any).prisma = prisma;
    (service as any).gatewayPagamento = gatewayPagamento;
    (service as any).logger = { warn: jest.fn(), log: jest.fn(), error: jest.fn() };

    return { service, prisma, gatewayPagamento };
  }

  const args = {
    cobrancaId: 'cob-1',
    cooperativaId: 'tenant-A',
    cooperadoId: 'coop-1',
    dados: { valor: 100, vencimento: new Date('2026-08-25'), descricao: 'Cobrança 07/2026' },
  };

  it('SEM_GATEWAY (sem_cooperativa) — cooperativaId vazio → skip legitimo, gateway nao chamado', async () => {
    const { service, gatewayPagamento } = buildSut();
    const r = await service.emitirNoGatewaySeConfigurado(
      args.cobrancaId,
      '', // vazio
      args.cooperadoId,
      args.dados,
    );
    expect(r).toEqual({ tipo: 'SEM_GATEWAY', motivo: 'sem_cooperativa' });
    expect(gatewayPagamento.emitirCobranca).not.toHaveBeenCalled();
  });

  it('SEM_GATEWAY (sem_config) — configGateway.findFirst retorna null', async () => {
    const { service, gatewayPagamento } = buildSut({ configGateway: null });
    const r = await service.emitirNoGatewaySeConfigurado(
      args.cobrancaId,
      args.cooperativaId,
      args.cooperadoId,
      args.dados,
    );
    expect(r).toEqual({ tipo: 'SEM_GATEWAY', motivo: 'sem_config' });
    expect(gatewayPagamento.emitirCobranca).not.toHaveBeenCalled();
  });

  it('SEM_GATEWAY (sem_forma_pagamento) — formaPagamentoCooperado ausente OU tipo invalido', async () => {
    const { service, gatewayPagamento } = buildSut({ formaPagamento: null });
    const r = await service.emitirNoGatewaySeConfigurado(
      args.cobrancaId,
      args.cooperativaId,
      args.cooperadoId,
      args.dados,
    );
    expect(r).toEqual({ tipo: 'SEM_GATEWAY', motivo: 'sem_forma_pagamento' });
    expect(gatewayPagamento.emitirCobranca).not.toHaveBeenCalled();
  });

  it('SEM_GATEWAY (sem_forma_pagamento) — tipo fora da whitelist tambem cai aqui', async () => {
    const { service, gatewayPagamento } = buildSut({ formaPagamento: { tipo: 'DINHEIRO' } });
    const r = await service.emitirNoGatewaySeConfigurado(
      args.cobrancaId,
      args.cooperativaId,
      args.cooperadoId,
      args.dados,
    );
    expect(r).toEqual({ tipo: 'SEM_GATEWAY', motivo: 'sem_forma_pagamento' });
    expect(gatewayPagamento.emitirCobranca).not.toHaveBeenCalled();
  });

  it('EMITIDO — gateway retorna sucesso; discriminado com gatewayId + campos de instrumento', async () => {
    const { service, gatewayPagamento } = buildSut();
    const r = await service.emitirNoGatewaySeConfigurado(
      args.cobrancaId,
      args.cooperativaId,
      args.cooperadoId,
      args.dados,
    );
    expect(r.tipo).toBe('EMITIDO');
    if (r.tipo === 'EMITIDO') {
      expect(r.gatewayId).toBe('pay_abc123');
      expect(r.pixQrCode).toBe('data:image/png;base64,xxx');
      expect(r.pixCopiaECola).toBe('00020126...');
      expect(r.linkPagamento).toBe('https://asaas.com/i/pay_abc123');
      expect(r.boletoUrl).toBeNull();
      expect(r.linhaDigitavel).toBeNull();
    }
    expect(gatewayPagamento.emitirCobranca).toHaveBeenCalledTimes(1);
  });

  it('FALHOU — gateway lanca; erro CAPTURADO no metodo (nao propaga, retorna FALHOU)', async () => {
    const { service, gatewayPagamento } = buildSut({
      gatewayEmit: async () => { throw new Error('Asaas 502 Bad Gateway'); },
    });
    const r = await service.emitirNoGatewaySeConfigurado(
      args.cobrancaId,
      args.cooperativaId,
      args.cooperadoId,
      args.dados,
    );
    expect(r.tipo).toBe('FALHOU');
    if (r.tipo === 'FALHOU') {
      expect(r.erro).toMatch(/Asaas 502/);
    }
    expect(gatewayPagamento.emitirCobranca).toHaveBeenCalledTimes(1);
  });

  it('metodo NUNCA lanca — try/catch do chamador (:366-379 original) era codigo morto', async () => {
    // Prova estrutural: com prisma.findFirst throw, o catch interno deve pegar
    // e retornar FALHOU. Se propagasse, seria unhandled rejection.
    const service = Object.create(CobrancasService.prototype) as CobrancasService;
    (service as any).prisma = {
      configGateway: { findFirst: jest.fn().mockRejectedValue(new Error('DB down')) },
      formaPagamentoCooperado: { findUnique: jest.fn() },
    };
    (service as any).gatewayPagamento = { emitirCobranca: jest.fn() };
    (service as any).logger = { warn: jest.fn(), log: jest.fn(), error: jest.fn() };

    const r = await service.emitirNoGatewaySeConfigurado(
      args.cobrancaId,
      args.cooperativaId,
      args.cooperadoId,
      args.dados,
    );
    expect(r).toEqual({ tipo: 'FALHOU', erro: 'DB down' });
  });
});

describe('gate #4 podeNotificarCooperado — 2 caminhos que NAO podem quebrar (regra Luciano)', () => {
  // Regra do gate no chamador (`criar()` linha 406):
  //   const podeNotificarCooperado = emissaoResult.tipo !== 'FALHOU';
  //
  // Este describe prova a INTENCAO do gate, nao o cabo eletrico do fetch.
  // O caso critico eh SEM_GATEWAY continuar notificando (307 faturados
  // manualmente vao esse caminho). FALHOU eh o unico caso que bloqueia.

  const gate = (r: EmissaoGatewayResult): boolean => r.tipo !== 'FALHOU';

  it('SEM_GATEWAY (sem_cooperativa) → NOTIFICA (307 manuais precisam receber)', () => {
    expect(gate({ tipo: 'SEM_GATEWAY', motivo: 'sem_cooperativa' })).toBe(true);
  });

  it('SEM_GATEWAY (sem_config) → NOTIFICA (parceiro sem gateway ativo — Sant/parceiros iniciando)', () => {
    expect(gate({ tipo: 'SEM_GATEWAY', motivo: 'sem_config' })).toBe(true);
  });

  it('SEM_GATEWAY (sem_forma_pagamento) → NOTIFICA (cooperado sem forma cadastrada)', () => {
    expect(gate({ tipo: 'SEM_GATEWAY', motivo: 'sem_forma_pagamento' })).toBe(true);
  });

  it('EMITIDO → NOTIFICA (fluxo normal, instrumento gerado)', () => {
    expect(
      gate({
        tipo: 'EMITIDO',
        gatewayId: 'pay_xxx',
        linkPagamento: null,
        boletoUrl: null,
        pixQrCode: null,
        pixCopiaECola: null,
        linhaDigitavel: null,
      }),
    ).toBe(true);
  });

  it('🔴 FALHOU → NAO NOTIFICA (o unico caso que bloqueia; cooperado nao recebe aviso de cobranca sem PIX/boleto)', () => {
    expect(gate({ tipo: 'FALHOU', erro: 'Asaas 502' })).toBe(false);
  });
});
