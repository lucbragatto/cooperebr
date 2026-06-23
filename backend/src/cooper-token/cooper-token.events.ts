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
  /**
   * Sprint Convênio FUNDAÇÃO (21/06/2026) — E8 wiring.
   * Empresa-PJ distribuiu N tokens pra funcionário via convênio
   * (`distribuirTokens` mass-write). Emitido APÓS commit, 1 por destinatário,
   * sequencial best-effort (cuidado throttle WA — sem fila ainda).
   * Consumido pelo CooperTokenNotificacaoListener.
   */
  DISTRIBUIDO_CONVENIO: 'cooper-token.distribuido-convenio',
  /**
   * Sprint Família M49 (22/06/2026) — abate familiar.
   * Cooperada PAGADORA cedeu tokens dela pra abater fatura do cooperado
   * TITULAR (`usarNaFatura` com titularCooperadoId). 2 lados notificados.
   * Emitido APÓS commit no lugar do RESGATADO padrão pra evitar copy errada.
   */
  RESGATADO_FAMILIAR: 'cooper-token.resgatado-familiar',
  /**
   * Sprint Faxina Contábil do Token (22/06/2026) — modelo voucher CPC 47.
   * Substituto canônico para emissões PAGAS (BENEFICIO_CONVENIO +
   * COMPRA_PJ_COOPERADA). Listener contábil emite **D Caixa / C Passivo
   * Tokens a Resgatar (2.3.01)** — NÃO mais Receita Venda 1.2.01 (aposentada).
   * Evento dedicado pra diferenciar de EMITIDO (que vira bonificação =
   * D Custo/Despesa Bonificação / C Passivo, sem caixa).
   */
  INGRESSO_EMISSAO_PAGA: 'cooper-token.ingresso-emissao-paga',
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

/**
 * Sprint Convênio FUNDAÇÃO (21/06/2026) — E8 wiring.
 * Emitido APÓS commit do mass-write em `distribuirTokens`, 1 evento por
 * destinatário. Best-effort sequencial; sem fila WA dedicada (catalogado
 * como débito P3 se piloto Santi mostrar burst grande).
 */
export class CooperTokenDistribuidoConvenioEvent {
  constructor(
    public readonly cooperativaId: string,
    public readonly empresaCooperadoId: string,
    public readonly empresaNome: string,
    public readonly destinatarioCooperadoId: string,
    public readonly convenioId: string,
    public readonly quantidade: number,
    public readonly valorReais: number,
    /** Pra dedup idempotente — disparoId no MensagemWhatsapp. */
    public readonly transacaoId: string,
  ) {}
}

/**
 * Sprint Família M49 (22/06/2026) — abate familiar.
 * Substitui RESGATADO quando há `titularCooperadoId` no `usarNaFatura`.
 * Listener notifica AMBOS os lados (pagador + titular), cada um com texto
 * apropriado (PAGADOR vê "você abateu fatura de {titular}"; TITULAR vê
 * "{pagador} cedeu N tokens pra abater sua fatura").
 */
/**
 * Sprint Faxina Contábil do Token (22/06/2026).
 * Empresa cooperada PJ pagou por tokens (BENEFICIO_CONVENIO / COMPRA_PJ_COOPERADA).
 * `naturezaAto` = 'PROPRIO' se cooperado é PF cooperado; 'AUXILIAR' se convênio
 * (Art. 88). Promoção AUXILIAR→PROPRIO é documental (Q4 orquestrador).
 */
export class CooperTokenIngressoEmissaoPagaEvent {
  constructor(
    public readonly cooperativaId: string,
    public readonly cooperadoId: string,
    public readonly tipo: string,
    public readonly quantidade: number,
    public readonly valorReais: number,
    public readonly naturezaAto: 'PROPRIO' | 'AUXILIAR' | 'NAO_COOPERATIVO',
  ) {}
}

export class CooperTokenResgatadoFamiliarEvent {
  constructor(
    public readonly cooperativaId: string,
    public readonly cooperadoPagadorId: string,
    public readonly cooperadoTitularId: string,
    public readonly autorizacaoId: string,
    public readonly cobrancaId: string,
    public readonly quantidade: number,
    public readonly valorReais: number,
  ) {}
}
