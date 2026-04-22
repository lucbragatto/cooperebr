/**
 * Interface abstrata pra gateways de pagamento.
 *
 * Cada gateway (Asaas, Sicoob, BB, etc) implementa esses 5 métodos.
 * O GatewayPagamentoService resolve qual adapter usar baseado na
 * ConfigGateway do parceiro.
 *
 * Sprint 7 — Refatoração multi-gateway.
 */

export interface EmitirCobrancaDto {
  valor: number;
  vencimento: string; // YYYY-MM-DD
  descricao: string;
  formaPagamento: 'BOLETO' | 'PIX' | 'CREDIT_CARD';
  cobrancaId?: string; // FK pra Cobranca local
}

export interface ResultadoEmissao {
  gatewayId: string;       // ID no gateway externo (pay_xxx, boleto_xxx)
  status: string;          // PENDING, CONFIRMED, etc
  linkPagamento?: string;
  boletoUrl?: string;
  pixQrCode?: string;
  pixCopiaECola?: string;
  nossoNumero?: string;
  linhaDigitavel?: string;
  dadosExtras?: Record<string, unknown>;
}

export interface ResultadoCustomer {
  gatewayCustomerId: string; // ID no gateway externo (cus_xxx)
}

export interface WebhookResult {
  received: boolean;
  cobrancaId?: string;   // FK da Cobranca local afetada
  novoStatus?: string;
  valorPago?: number;
  dataPagamento?: string;
  skipped?: string;
}

export interface TesteConexaoResult {
  ok: boolean;
  erro?: string;
  totalCustomers?: number;
}

export interface GatewayPagamentoAdapter {
  /**
   * Cria ou busca customer no gateway externo.
   * Idempotente: se já existe por CPF/CNPJ, retorna o existente.
   */
  criarCustomer(cooperadoId: string, cooperativaId: string): Promise<ResultadoCustomer>;

  /**
   * Emite cobrança no gateway externo.
   * Retorna dados pra exibir pro cooperado (link, PIX, boleto).
   */
  emitirCobranca(cooperadoId: string, cooperativaId: string, dados: EmitirCobrancaDto): Promise<ResultadoEmissao>;

  /**
   * Cancela cobrança no gateway externo.
   */
  cancelarCobranca(gatewayId: string, cooperativaId: string): Promise<void>;

  /**
   * Processa webhook recebido do gateway.
   * Valida token, atualiza status, emite evento de pagamento confirmado.
   */
  processarWebhook(payload: any, token: string): Promise<WebhookResult>;

  /**
   * Testa conexão com o gateway (GET simples pra validar API key).
   */
  testarConexao(cooperativaId: string): Promise<TesteConexaoResult>;
}
