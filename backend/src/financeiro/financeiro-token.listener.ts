import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { TokenContabilService } from './token-contabil.service';
import { AsPlatform } from '../common/tenant-context';
import {
  COOPER_TOKEN_EVENTS,
  CooperTokenEmitidoEvent,
  CooperTokenResgatadoEvent,
  CooperTokenExpiradoEvent,
  CooperTokenCompraParceiroPagoEvent,
  CooperTokenIngressoEmissaoPagaEvent,
  CooperTokenResgatadoFamiliarEvent,
} from '../cooper-token/cooper-token.events';
import { classificarTipo } from '../cooper-token/classificacao-contabil.helper';

/**
 * Listener contábil do CooperToken.
 *
 * REVISÃO Sprint Faxina Contábil do Token (22/06/2026):
 *  - Handler novo `handleIngressoEmissaoPaga` — D Caixa / C Passivo 2.3.01.
 *  - `handleEmitido` agora **classifica o tipo** e escolhe entre
 *    `lancarEmissaoFaturaCheia` (BONIFICACAO_DESCONTO → 5.1.10) e
 *    `lancarEmissaoAdminLote` (BONIFICACAO_ADMIN → 5.1.03).
 *  - `handleCompraParceiroPago` migrado pra chamar `lancarIngressoEmissaoPaga`
 *    (mantém compat com caminho legado tenant-level).
 *  - `lancarCompraParceiroPago` (Receita Venda 1.2.01) APOSENTADO — não é
 *    mais chamado de nenhum lugar.
 */
@Injectable()
export class FinanceiroTokenListener {
  private readonly logger = new Logger(FinanceiroTokenListener.name);

  constructor(private tokenContabil: TokenContabilService) {}

  @OnEvent(COOPER_TOKEN_EVENTS.EMITIDO)
  @AsPlatform()
  async handleEmitido(event: CooperTokenEmitidoEvent): Promise<void> {
    try {
      const classificacao = classificarTipo(event.tipo);
      if (event.valorReais <= 0) {
        this.logger.debug(
          `[token-contabil] EMITIDO sem valorReais (${event.tipo}) — skip`,
        );
        return;
      }
      const params = {
        cooperativaId: event.cooperativaId,
        cooperadoId: event.cooperadoId,
        valor: event.valorReais,
        competencia: new Date().toISOString().slice(0, 7),
        descricao: `Emissão ${event.quantidade} tokens (${event.tipo})`,
        naturezaAto: classificacao.naturezaAtoSugerida,
      };
      if (classificacao.categoria === 'BONIFICACAO_DESCONTO') {
        await this.tokenContabil.lancarEmissaoFaturaCheia(params);
      } else if (classificacao.categoria === 'BONIFICACAO_ADMIN') {
        // Reusa lancarEmissaoAdminLote (D 5.1.03 / C Passivo). loteId =
        // event.cooperadoId pra rastreabilidade individual (não é lote real
        // mas o campo é só descritivo).
        await this.tokenContabil.lancarEmissaoAdminLote({
          ...params,
          loteId: `${event.cooperadoId}-${event.tipo}`,
        });
      } else {
        // INGRESSO_PAGO + TRANSFERENCIA_INTERNA + USO NÃO devem chegar aqui
        // (cooper-token.service.ts:creditar() roteia por evento separado).
        this.logger.warn(
          `[token-contabil] EMITIDO recebeu tipo ${event.tipo} com categoria ${classificacao.categoria} — não esperado, skip`,
        );
      }
    } catch (err) {
      this.logger.warn(`Falha ao lançar contábil emissão: ${(err as Error).message}`);
    }
  }

  /**
   * Sprint Faxina Contábil (22/06/2026) — handler novo.
   *
   * Empresa cooperada pagou por tokens (BENEFICIO_CONVENIO + COMPRA_PJ_COOPERADA).
   * D Caixa / C Passivo Tokens a Resgatar (2.3.01).
   */
  @OnEvent(COOPER_TOKEN_EVENTS.INGRESSO_EMISSAO_PAGA)
  @AsPlatform()
  async handleIngressoEmissaoPaga(event: CooperTokenIngressoEmissaoPagaEvent): Promise<void> {
    try {
      if (event.valorReais <= 0) {
        this.logger.debug(
          `[token-contabil] INGRESSO_EMISSAO_PAGA sem valorReais (${event.tipo}) — skip`,
        );
        return;
      }
      await this.tokenContabil.lancarIngressoEmissaoPaga({
        cooperativaId: event.cooperativaId,
        cooperadoId: event.cooperadoId,
        valor: event.valorReais,
        competencia: new Date().toISOString().slice(0, 7),
        descricao: `Ingresso pago ${event.quantidade} tokens (${event.tipo})`,
        naturezaAto: event.naturezaAto,
      });
    } catch (err) {
      this.logger.warn(
        `Falha ao lançar contábil ingresso pago: ${(err as Error).message}`,
      );
    }
  }

  @OnEvent(COOPER_TOKEN_EVENTS.RESGATADO)
  @AsPlatform()
  async handleResgatado(event: CooperTokenResgatadoEvent): Promise<void> {
    try {
      await this.tokenContabil.lancarResgateFatura({
        cooperativaId: event.cooperativaId,
        cooperadoId: event.cooperadoId,
        valor: event.valorReais,
        competencia: new Date().toISOString().slice(0, 7),
        descricao: `Resgate ${event.quantidade} tokens na cobrança ${event.cobrancaId}`,
        // Idempotência (fix P2 financeiro-token 22/06).
        origemId: event.cobrancaId,
      });
    } catch (err) {
      this.logger.warn(`Falha ao lançar contábil resgate fatura: ${(err as Error).message}`);
    }
  }

  /**
   * Sprint Faxina Contábil (22/06/2026) — fix P1 financeiro-token + multitenant:
   * M49 emite RESGATADO_FAMILIAR (não RESGATADO) quando há `titularCooperadoId`.
   * Sem este handler, o passivo 2.3.01 NÃO baixava no abate familiar — invariante
   * FUNDACAO §4#1 quebrado a cada uso familiar.
   * `cooperativaId` vem do payload (lição M45).
   */
  @OnEvent(COOPER_TOKEN_EVENTS.RESGATADO_FAMILIAR)
  @AsPlatform()
  async handleResgatadoFamiliar(event: CooperTokenResgatadoFamiliarEvent): Promise<void> {
    try {
      await this.tokenContabil.lancarResgateFatura({
        cooperativaId: event.cooperativaId,
        // Cobrança é do TITULAR (a fatura abatida); registramos por ele
        // pra rastreabilidade.
        cooperadoId: event.cooperadoTitularId,
        valor: event.valorReais,
        competencia: new Date().toISOString().slice(0, 7),
        descricao: `Abate familiar ${event.quantidade} tokens (pagadora ${event.cooperadoPagadorId} → titular ${event.cooperadoTitularId}, cobrança ${event.cobrancaId})`,
        // Idempotência via @@unique(origemTipo,origemId) — fix P2 financeiro-token 22/06.
        origemId: event.cobrancaId,
      });
    } catch (err) {
      this.logger.warn(
        `Falha ao lançar contábil resgate familiar: ${(err as Error).message}`,
      );
    }
  }

  @OnEvent(COOPER_TOKEN_EVENTS.EXPIRADO)
  @AsPlatform()
  async handleExpirado(event: CooperTokenExpiradoEvent): Promise<void> {
    try {
      await this.tokenContabil.lancarExpiracao({
        cooperativaId: event.cooperativaId,
        valor: event.valorReais,
        competencia: new Date().toISOString().slice(0, 7),
        descricao: `Expiração de ${event.quantidade} tokens`,
      });
    } catch (err) {
      this.logger.warn(`Falha ao lançar contábil expiração: ${(err as Error).message}`);
    }
  }

  /**
   * Sprint Faxina Contábil (22/06/2026) — caminho legado tenant-level.
   *
   * `confirmarCompraParceiro` (parceiro = saldo do TENANT) ainda emite este
   * evento. Roteamos pra `lancarIngressoEmissaoPaga` (D Caixa / C Passivo)
   * — NÃO mais `lancarCompraParceiroPago` (Receita Venda 1.2.01 aposentada).
   *
   * `naturezaAto` = 'AUXILIAR' default pra compra parceiro (convênio Art. 88;
   * admin promove documentalmente pra PROPRIO).
   */
  @OnEvent(COOPER_TOKEN_EVENTS.COMPRA_PARCEIRO_PAGO)
  @AsPlatform()
  async handleCompraParceiroPago(event: CooperTokenCompraParceiroPagoEvent): Promise<void> {
    try {
      await this.tokenContabil.lancarIngressoEmissaoPaga({
        cooperativaId: event.cooperativaId,
        valor: event.valorTotal,
        competencia: new Date().toISOString().slice(0, 7),
        descricao: `Compra parceiro ${event.compraId}: ${event.quantidade} tokens`,
        naturezaAto: 'AUXILIAR',
      });
    } catch (err) {
      this.logger.warn(`Falha ao lançar contábil compra parceiro: ${(err as Error).message}`);
    }
  }
}
