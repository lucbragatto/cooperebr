/**
 * Eventos de domínio do CooperToken.
 * Emitidos pelo CooperTokenService e consumidos pelo FinanceiroTokenListener
 * para gerar lançamentos contábeis automáticos.
 */

export const COOPER_TOKEN_EVENTS = {
  EMITIDO: 'cooper-token.emitido',
  RESGATADO: 'cooper-token.resgatado',
  EXPIRADO: 'cooper-token.expirado',
  COMPRA_PARCEIRO_PAGO: 'cooper-token.compra-parceiro-pago',
} as const;

export class CooperTokenEmitidoEvent {
  constructor(
    public readonly cooperativaId: string,
    public readonly cooperadoId: string,
    public readonly tipo: string,
    public readonly quantidade: number,
    public readonly valorReais: number,
  ) {}
}

export class CooperTokenResgatadoEvent {
  constructor(
    public readonly cooperativaId: string,
    public readonly cooperadoId: string,
    public readonly cobrancaId: string,
    public readonly quantidade: number,
    public readonly valorReais: number,
  ) {}
}

export class CooperTokenExpiradoEvent {
  constructor(
    public readonly cooperativaId: string,
    public readonly quantidade: number,
    public readonly valorReais: number,
  ) {}
}

export class CooperTokenCompraParceiroPagoEvent {
  constructor(
    public readonly cooperativaId: string,
    public readonly compraId: string,
    public readonly quantidade: number,
    public readonly valorTotal: number,
  ) {}
}
