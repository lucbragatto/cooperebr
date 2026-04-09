import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { TokenContabilService } from './token-contabil.service';
import {
  COOPER_TOKEN_EVENTS,
  CooperTokenEmitidoEvent,
  CooperTokenResgatadoEvent,
  CooperTokenExpiradoEvent,
  CooperTokenCompraParceiroPagoEvent,
} from '../cooper-token/cooper-token.events';

@Injectable()
export class FinanceiroTokenListener {
  private readonly logger = new Logger(FinanceiroTokenListener.name);

  constructor(private tokenContabil: TokenContabilService) {}

  @OnEvent(COOPER_TOKEN_EVENTS.EMITIDO)
  async handleEmitido(event: CooperTokenEmitidoEvent): Promise<void> {
    try {
      await this.tokenContabil.lancarEmissaoFaturaCheia({
        cooperativaId: event.cooperativaId,
        cooperadoId: event.cooperadoId,
        valor: event.valorReais,
        competencia: new Date().toISOString().slice(0, 7),
        descricao: `Emissão ${event.quantidade} tokens (${event.tipo})`,
      });
    } catch (err) {
      this.logger.warn(`Falha ao lançar contábil emissão: ${(err as Error).message}`);
    }
  }

  @OnEvent(COOPER_TOKEN_EVENTS.RESGATADO)
  async handleResgatado(event: CooperTokenResgatadoEvent): Promise<void> {
    try {
      await this.tokenContabil.lancarResgateFatura({
        cooperativaId: event.cooperativaId,
        cooperadoId: event.cooperadoId,
        valor: event.valorReais,
        competencia: new Date().toISOString().slice(0, 7),
        descricao: `Resgate ${event.quantidade} tokens na cobrança ${event.cobrancaId}`,
      });
    } catch (err) {
      this.logger.warn(`Falha ao lançar contábil resgate fatura: ${(err as Error).message}`);
    }
  }

  @OnEvent(COOPER_TOKEN_EVENTS.EXPIRADO)
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

  @OnEvent(COOPER_TOKEN_EVENTS.COMPRA_PARCEIRO_PAGO)
  async handleCompraParceiroPago(event: CooperTokenCompraParceiroPagoEvent): Promise<void> {
    try {
      await this.tokenContabil.lancarCompraParceiroPago({
        cooperativaId: event.cooperativaId,
        valor: event.valorTotal,
        competencia: new Date().toISOString().slice(0, 7),
        descricao: `Compra parceiro ${event.compraId}: ${event.quantidade} tokens`,
      });
    } catch (err) {
      this.logger.warn(`Falha ao lançar contábil compra parceiro: ${(err as Error).message}`);
    }
  }
}
