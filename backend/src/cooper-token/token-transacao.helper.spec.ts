/**
 * Sprint Clube P1 — F4 Bloco B (12/06/2026).
 *
 * Specs do helper criarTokenTransacao + auxiliares puros:
 *   - calcularTier (BAIXO ≤ R$50 < ALTO)
 *   - determinarMotivoStepUp (precedência PRIMEIRO_USO > DESTINATARIO_NOVO > VALOR_ALTO)
 *   - criarTokenTransacao (guards multi-tenant + jti + tier + motivo)
 */
import {
  calcularTier,
  criarTokenTransacao,
  determinarMotivoStepUp,
  LIMIAR_TIER_REAIS,
} from './token-transacao.helper';

describe('F4 Bloco B — calcularTier', () => {
  it('R$ 0 → BAIXO', () => {
    expect(calcularTier(0)).toBe('BAIXO');
  });
  it('R$ 50 exatos → BAIXO (≤R$50)', () => {
    expect(calcularTier(LIMIAR_TIER_REAIS)).toBe('BAIXO');
  });
  it('R$ 50.01 → ALTO', () => {
    expect(calcularTier(50.01)).toBe('ALTO');
  });
  it('R$ 9999 → ALTO', () => {
    expect(calcularTier(9999)).toBe('ALTO');
  });
});

describe('F4 Bloco B — determinarMotivoStepUp (precedência)', () => {
  it('sem histórico → PRIMEIRO_USO mesmo em tier BAIXO', () => {
    expect(
      determinarMotivoStepUp({
        tier: 'BAIXO',
        temHistorico: false,
        temHistoricoComRecebedor: false,
      }),
    ).toBe('PRIMEIRO_USO');
  });

  it('tem histórico geral mas não com este recebedor → DESTINATARIO_NOVO', () => {
    expect(
      determinarMotivoStepUp({
        tier: 'BAIXO',
        temHistorico: true,
        temHistoricoComRecebedor: false,
      }),
    ).toBe('DESTINATARIO_NOVO');
  });

  it('tem histórico com recebedor + tier ALTO → VALOR_ALTO', () => {
    expect(
      determinarMotivoStepUp({
        tier: 'ALTO',
        temHistorico: true,
        temHistoricoComRecebedor: true,
      }),
    ).toBe('VALOR_ALTO');
  });

  it('tem histórico com recebedor + tier BAIXO → null (sem step-up)', () => {
    expect(
      determinarMotivoStepUp({
        tier: 'BAIXO',
        temHistorico: true,
        temHistoricoComRecebedor: true,
      }),
    ).toBeNull();
  });

  it('PRIMEIRO_USO tem precedência sobre VALOR_ALTO', () => {
    expect(
      determinarMotivoStepUp({
        tier: 'ALTO',
        temHistorico: false,
        temHistoricoComRecebedor: false,
      }),
    ).toBe('PRIMEIRO_USO');
  });

  it('DESTINATARIO_NOVO tem precedência sobre VALOR_ALTO', () => {
    expect(
      determinarMotivoStepUp({
        tier: 'ALTO',
        temHistorico: true,
        temHistoricoComRecebedor: false,
      }),
    ).toBe('DESTINATARIO_NOVO');
  });
});

describe('F4 Bloco B — criarTokenTransacao (guards + criação)', () => {
  function setup(opts: {
    pagador?: any;
    recebedor?: any;
    countConfirmadasPagador?: number;
    countConfirmadasParRecebedor?: number;
    txCreatedOverride?: any;
  } = {}) {
    const txCreate = jest.fn().mockResolvedValue({
      id: 'tt-1',
      jti: 'jti-deterministic',
      tier: 'BAIXO',
      motivoStepUp: 'PRIMEIRO_USO',
      status: 'PENDENTE_PIN',
      ...(opts.txCreatedOverride ?? {}),
    });

    const tx: any = {
      cooperado: {
        findUnique: jest.fn(({ where }: any) => {
          if (where.id === 'pag-1') {
            return Promise.resolve(
              opts.pagador ?? { id: 'pag-1', cooperativaId: 'coop-A' },
            );
          }
          if (where.id === 'rec-1') {
            return Promise.resolve(
              opts.recebedor ?? { id: 'rec-1', cooperativaId: 'coop-A' },
            );
          }
          return Promise.resolve(null);
        }),
      },
      tokenTransacao: {
        count: jest
          .fn()
          .mockResolvedValueOnce(opts.countConfirmadasPagador ?? 0)
          .mockResolvedValueOnce(opts.countConfirmadasParRecebedor ?? 0),
        create: txCreate,
      },
    };

    return { tx, txCreate };
  }

  it('pagador inexistente → erro', async () => {
    const { tx } = setup();
    tx.cooperado.findUnique.mockResolvedValueOnce(null);
    await expect(
      criarTokenTransacao(tx, {
        pagadorId: 'pag-INEXISTE',
        pagadorCooperativaId: 'coop-A',
        quantidadeTokens: 10,
        valorReaisEstimado: 5,
        tipoOperacao: 'USO_FATURA',
      }),
    ).rejects.toThrow(/pagador.*não encontrado/);
  });

  it('pagador com cooperativaId divergente do param → erro cross-tenant', async () => {
    const { tx } = setup({
      pagador: { id: 'pag-1', cooperativaId: 'coop-OUTRO' },
    });
    await expect(
      criarTokenTransacao(tx, {
        pagadorId: 'pag-1',
        pagadorCooperativaId: 'coop-A',
        quantidadeTokens: 10,
        valorReaisEstimado: 5,
        tipoOperacao: 'USO_FATURA',
      }),
    ).rejects.toThrow(/cross-tenant bloqueado/);
  });

  it('cross-tenant pagador↔recebedor bloqueado por default', async () => {
    const { tx } = setup({
      recebedor: { id: 'rec-1', cooperativaId: 'coop-B' },
    });
    await expect(
      criarTokenTransacao(tx, {
        pagadorId: 'pag-1',
        pagadorCooperativaId: 'coop-A',
        recebedorId: 'rec-1',
        recebedorCooperativaId: 'coop-B',
        quantidadeTokens: 10,
        valorReaisEstimado: 5,
        tipoOperacao: 'TRANSFERENCIA',
      }),
    ).rejects.toThrow(/cross-tenant pagador.*bloqueado/);
  });

  it('cross-tenant explicitamente permitido NÃO bloqueia', async () => {
    const { tx, txCreate } = setup({
      recebedor: { id: 'rec-1', cooperativaId: 'coop-B' },
    });
    await criarTokenTransacao(tx, {
      pagadorId: 'pag-1',
      pagadorCooperativaId: 'coop-A',
      recebedorId: 'rec-1',
      recebedorCooperativaId: 'coop-B',
      quantidadeTokens: 10,
      valorReaisEstimado: 5,
      tipoOperacao: 'TRANSFERENCIA',
      permitirCrossTenant: true,
    });
    expect(txCreate).toHaveBeenCalled();
  });

  it('valor alto > R$50 grava tier=ALTO', async () => {
    const { tx, txCreate } = setup();
    await criarTokenTransacao(tx, {
      pagadorId: 'pag-1',
      pagadorCooperativaId: 'coop-A',
      quantidadeTokens: 200,
      valorReaisEstimado: 100,
      tipoOperacao: 'USO_FATURA',
    });
    const data = txCreate.mock.calls[0][0].data;
    expect(data.tier).toBe('ALTO');
  });

  it('valor baixo ≤ R$50 grava tier=BAIXO', async () => {
    const { tx, txCreate } = setup();
    await criarTokenTransacao(tx, {
      pagadorId: 'pag-1',
      pagadorCooperativaId: 'coop-A',
      quantidadeTokens: 10,
      valorReaisEstimado: 5,
      tipoOperacao: 'USO_FATURA',
    });
    const data = txCreate.mock.calls[0][0].data;
    expect(data.tier).toBe('BAIXO');
  });

  it('sem histórico do pagador grava motivoStepUp=PRIMEIRO_USO', async () => {
    const { tx, txCreate } = setup({ countConfirmadasPagador: 0 });
    await criarTokenTransacao(tx, {
      pagadorId: 'pag-1',
      pagadorCooperativaId: 'coop-A',
      quantidadeTokens: 10,
      valorReaisEstimado: 5,
      tipoOperacao: 'USO_FATURA',
    });
    const data = txCreate.mock.calls[0][0].data;
    expect(data.motivoStepUp).toBe('PRIMEIRO_USO');
  });

  it('histórico com recebedor + ALTO grava motivoStepUp=VALOR_ALTO', async () => {
    const { tx, txCreate } = setup({
      countConfirmadasPagador: 5,
      countConfirmadasParRecebedor: 2,
    });
    await criarTokenTransacao(tx, {
      pagadorId: 'pag-1',
      pagadorCooperativaId: 'coop-A',
      recebedorId: 'rec-1',
      recebedorCooperativaId: 'coop-A',
      quantidadeTokens: 200,
      valorReaisEstimado: 100,
      tipoOperacao: 'TRANSFERENCIA',
    });
    const data = txCreate.mock.calls[0][0].data;
    expect(data.motivoStepUp).toBe('VALOR_ALTO');
  });

  it('sem recebedor (uso-fatura/resgate) não dispara DESTINATARIO_NOVO', async () => {
    const { tx, txCreate } = setup({
      countConfirmadasPagador: 5,
      countConfirmadasParRecebedor: 0,
    });
    await criarTokenTransacao(tx, {
      pagadorId: 'pag-1',
      pagadorCooperativaId: 'coop-A',
      quantidadeTokens: 10,
      valorReaisEstimado: 5,
      tipoOperacao: 'USO_FATURA',
    });
    const data = txCreate.mock.calls[0][0].data;
    // tem histórico geral (5) + sem recebedor + tier BAIXO → null
    expect(data.motivoStepUp).toBeNull();
  });

  it('jti gerado tem 32 chars hex (gerarTokenHex(16))', async () => {
    const { tx, txCreate } = setup();
    await criarTokenTransacao(tx, {
      pagadorId: 'pag-1',
      pagadorCooperativaId: 'coop-A',
      quantidadeTokens: 10,
      valorReaisEstimado: 5,
      tipoOperacao: 'USO_FATURA',
    });
    const data = txCreate.mock.calls[0][0].data;
    expect(data.jti).toMatch(/^[a-f0-9]{32}$/);
  });

  it('jti override (testes determinísticos) é respeitado', async () => {
    const { tx, txCreate } = setup();
    await criarTokenTransacao(tx, {
      pagadorId: 'pag-1',
      pagadorCooperativaId: 'coop-A',
      quantidadeTokens: 10,
      valorReaisEstimado: 5,
      tipoOperacao: 'USO_FATURA',
      jti: 'jti-fixo-12345',
    });
    const data = txCreate.mock.calls[0][0].data;
    expect(data.jti).toBe('jti-fixo-12345');
  });

  it('qrExpiresAt default null (operação NÃO-QR)', async () => {
    const { tx, txCreate } = setup();
    await criarTokenTransacao(tx, {
      pagadorId: 'pag-1',
      pagadorCooperativaId: 'coop-A',
      quantidadeTokens: 10,
      valorReaisEstimado: 5,
      tipoOperacao: 'USO_FATURA',
    });
    const data = txCreate.mock.calls[0][0].data;
    expect(data.qrExpiresAt).toBeNull();
  });

  it('qrExpiresAt preservado se fornecido (QR real Fase 3)', async () => {
    const { tx, txCreate } = setup();
    const expira = new Date('2030-01-01T00:00:00Z');
    await criarTokenTransacao(tx, {
      pagadorId: 'pag-1',
      pagadorCooperativaId: 'coop-A',
      quantidadeTokens: 10,
      valorReaisEstimado: 5,
      tipoOperacao: 'PAGAMENTO',
      qrExpiresAt: expira,
    });
    const data = txCreate.mock.calls[0][0].data;
    expect(data.qrExpiresAt).toEqual(expira);
  });

  it('status default = PENDENTE_PIN', async () => {
    const { tx, txCreate } = setup();
    await criarTokenTransacao(tx, {
      pagadorId: 'pag-1',
      pagadorCooperativaId: 'coop-A',
      quantidadeTokens: 10,
      valorReaisEstimado: 5,
      tipoOperacao: 'USO_FATURA',
    });
    const data = txCreate.mock.calls[0][0].data;
    expect(data.status).toBe('PENDENTE_PIN');
  });
});
