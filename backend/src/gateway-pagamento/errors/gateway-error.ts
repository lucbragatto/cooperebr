/**
 * Erro padronizado de gateway de pagamento.
 *
 * Qualquer adapter traduz erros do gateway externo pra esse formato.
 * Callers tratam GatewayError sem saber se veio do Asaas, Sicoob ou BB.
 */
export type GatewayErrorCode =
  | 'CREDENCIAIS_INVALIDAS'
  | 'CONEXAO_FALHOU'
  | 'GATEWAY_INDISPONIVEL'
  | 'COBRANCA_DUPLICADA'
  | 'COOPERADO_INVALIDO'
  | 'DESCONHECIDO';

export class GatewayError extends Error {
  readonly code: GatewayErrorCode;
  readonly retryable: boolean;
  readonly originalError?: any;

  constructor(params: {
    code: GatewayErrorCode;
    message: string;
    retryable?: boolean;
    originalError?: any;
  }) {
    super(params.message);
    this.name = 'GatewayError';
    this.code = params.code;
    this.retryable = params.retryable ?? false;
    this.originalError = params.originalError;
  }
}
