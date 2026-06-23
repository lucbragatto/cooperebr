/**
 * Sprint Faxina Contábil do Token (22/06/2026).
 *
 * Specs do FinanceiroTokenListener pós-faxina. Cobertura:
 *  - handleIngressoEmissaoPaga → tokenContabil.lancarIngressoEmissaoPaga
 *  - handleEmitido roteia por classificação:
 *    * BONIFICACAO_DESCONTO (FATURA_CHEIA) → lancarEmissaoFaturaCheia
 *    * BONIFICACAO_ADMIN (BONUS_INDICACAO/SOCIAL) → lancarEmissaoAdminLote
 *    * INGRESSO_PAGO (BENEFICIO_CONVENIO) → WARN skip (não é caminho EMITIDO)
 *  - handleCompraParceiroPago (legado tenant) → lancarIngressoEmissaoPaga (AUXILIAR)
 *  - valorReais=0 → skip
 *  - error → log warn (best-effort)
 */
import { FinanceiroTokenListener } from './financeiro-token.listener';
import {
  CooperTokenEmitidoEvent,
  CooperTokenIngressoEmissaoPagaEvent,
  CooperTokenCompraParceiroPagoEvent,
  CooperTokenResgatadoFamiliarEvent,
} from '../cooper-token/cooper-token.events';

function setup() {
  const lancarIngressoEmissaoPaga = jest.fn().mockResolvedValue({});
  const lancarEmissaoFaturaCheia = jest.fn().mockResolvedValue({});
  const lancarEmissaoAdminLote = jest.fn().mockResolvedValue({});
  const lancarResgateFatura = jest.fn().mockResolvedValue({});
  const lancarExpiracao = jest.fn().mockResolvedValue({});

  const tokenContabil = {
    lancarIngressoEmissaoPaga,
    lancarEmissaoFaturaCheia,
    lancarEmissaoAdminLote,
    lancarResgateFatura,
    lancarExpiracao,
  } as any;

  const listener = new FinanceiroTokenListener(tokenContabil);
  return {
    listener,
    lancarIngressoEmissaoPaga,
    lancarEmissaoFaturaCheia,
    lancarEmissaoAdminLote,
    lancarResgateFatura,
  };
}

describe('Faxina Contábil — FinanceiroTokenListener', () => {
  describe('handleIngressoEmissaoPaga', () => {
    it('chama lancarIngressoEmissaoPaga com naturezaAto do evento', async () => {
      const { listener, lancarIngressoEmissaoPaga } = setup();
      const evt = new CooperTokenIngressoEmissaoPagaEvent(
        'tenant-A',
        'coop-1',
        'BENEFICIO_CONVENIO',
        100,
        45.0,
        'AUXILIAR',
      );
      await listener.handleIngressoEmissaoPaga(evt);
      expect(lancarIngressoEmissaoPaga).toHaveBeenCalledWith(
        expect.objectContaining({
          cooperativaId: 'tenant-A',
          cooperadoId: 'coop-1',
          valor: 45.0,
          naturezaAto: 'AUXILIAR',
          descricao: expect.stringContaining('Ingresso pago'),
        }),
      );
    });

    it('valorReais=0 → skip silencioso', async () => {
      const { listener, lancarIngressoEmissaoPaga } = setup();
      await listener.handleIngressoEmissaoPaga(
        new CooperTokenIngressoEmissaoPagaEvent('t', 'c', 'X', 0, 0, 'PROPRIO'),
      );
      expect(lancarIngressoEmissaoPaga).not.toHaveBeenCalled();
    });

    it('error no service não derruba listener', async () => {
      const { listener, lancarIngressoEmissaoPaga } = setup();
      lancarIngressoEmissaoPaga.mockRejectedValueOnce(new Error('boom'));
      await expect(
        listener.handleIngressoEmissaoPaga(
          new CooperTokenIngressoEmissaoPagaEvent('t', 'c', 'X', 10, 5, 'PROPRIO'),
        ),
      ).resolves.toBeUndefined();
    });
  });

  describe('handleEmitido — roteamento por classificação', () => {
    it('FATURA_CHEIA → lancarEmissaoFaturaCheia (BONIFICACAO_DESCONTO + PROPRIO)', async () => {
      const { listener, lancarEmissaoFaturaCheia, lancarEmissaoAdminLote } = setup();
      const evt = new CooperTokenEmitidoEvent('t', 'c1', 'FATURA_CHEIA', 50, 22.5);
      await listener.handleEmitido(evt);
      expect(lancarEmissaoFaturaCheia).toHaveBeenCalledWith(
        expect.objectContaining({ valor: 22.5, naturezaAto: 'PROPRIO' }),
      );
      expect(lancarEmissaoAdminLote).not.toHaveBeenCalled();
    });

    it('BONUS_INDICACAO → lancarEmissaoAdminLote (BONIFICACAO_ADMIN)', async () => {
      const { listener, lancarEmissaoFaturaCheia, lancarEmissaoAdminLote } = setup();
      const evt = new CooperTokenEmitidoEvent('t', 'c1', 'BONUS_INDICACAO', 10, 4.5);
      await listener.handleEmitido(evt);
      expect(lancarEmissaoAdminLote).toHaveBeenCalledWith(
        expect.objectContaining({ valor: 4.5, naturezaAto: 'PROPRIO', loteId: 'c1-BONUS_INDICACAO' }),
      );
      expect(lancarEmissaoFaturaCheia).not.toHaveBeenCalled();
    });

    it('SOCIAL → lancarEmissaoAdminLote', async () => {
      const { listener, lancarEmissaoAdminLote } = setup();
      const evt = new CooperTokenEmitidoEvent('t', 'c1', 'SOCIAL', 100, 45);
      await listener.handleEmitido(evt);
      expect(lancarEmissaoAdminLote).toHaveBeenCalled();
    });

    it('valorReais=0 → skip silencioso', async () => {
      const { listener, lancarEmissaoFaturaCheia, lancarEmissaoAdminLote } = setup();
      await listener.handleEmitido(new CooperTokenEmitidoEvent('t', 'c', 'BONUS_INDICACAO', 0, 0));
      expect(lancarEmissaoFaturaCheia).not.toHaveBeenCalled();
      expect(lancarEmissaoAdminLote).not.toHaveBeenCalled();
    });

    it('tipo INGRESSO_PAGO recebido por EMITIDO → WARN skip (não esperado)', async () => {
      const { listener, lancarEmissaoFaturaCheia, lancarEmissaoAdminLote } = setup();
      await listener.handleEmitido(new CooperTokenEmitidoEvent('t', 'c', 'BENEFICIO_CONVENIO', 10, 5));
      // Não deve chamar nenhuma das duas rotas BONIFICACAO_*
      expect(lancarEmissaoFaturaCheia).not.toHaveBeenCalled();
      expect(lancarEmissaoAdminLote).not.toHaveBeenCalled();
    });
  });

  describe('handleResgatadoFamiliar (fix P1 — M49 gap fechado)', () => {
    it('chama lancarResgateFatura usando cobrancaId como origemId (idempotência)', async () => {
      const { listener, lancarResgateFatura } = setup();
      const evt = new CooperTokenResgatadoFamiliarEvent(
        'tenant-A',
        'coop-pagadora',
        'coop-titular',
        'aut-1',
        'cobranca-fam',
        100,
        45.0,
      );
      await listener.handleResgatadoFamiliar(evt);
      expect(lancarResgateFatura).toHaveBeenCalledWith(
        expect.objectContaining({
          cooperativaId: 'tenant-A',
          cooperadoId: 'coop-titular', // dono da fatura
          valor: 45.0,
          origemId: 'cobranca-fam',
          descricao: expect.stringContaining('Abate familiar'),
        }),
      );
    });

    it('erro no service não derruba listener (best-effort)', async () => {
      const { listener, lancarResgateFatura } = setup();
      lancarResgateFatura.mockRejectedValueOnce(new Error('boom'));
      const evt = new CooperTokenResgatadoFamiliarEvent('t', 'p', 'tt', 'a', 'c', 10, 5);
      await expect(listener.handleResgatadoFamiliar(evt)).resolves.toBeUndefined();
    });
  });

  describe('handleCompraParceiroPago (legado tenant)', () => {
    it('roteia pra lancarIngressoEmissaoPaga com AUXILIAR (NÃO mais lancarCompraParceiroPago)', async () => {
      const { listener, lancarIngressoEmissaoPaga } = setup();
      const evt = new CooperTokenCompraParceiroPagoEvent('t', 'compra-1', 100, 45);
      await listener.handleCompraParceiroPago(evt);
      expect(lancarIngressoEmissaoPaga).toHaveBeenCalledWith(
        expect.objectContaining({
          cooperativaId: 't',
          valor: 45,
          naturezaAto: 'AUXILIAR',
        }),
      );
    });
  });
});
