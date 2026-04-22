import { Injectable, Logger } from '@nestjs/common';
import { AsaasService } from '../../asaas/asaas.service';
import { GatewayError } from '../errors/gateway-error';
import {
  GatewayPagamentoAdapter,
  EmitirCobrancaDto,
  ResultadoEmissao,
  ResultadoCustomer,
  WebhookResult,
  TesteConexaoResult,
} from '../interfaces/gateway-pagamento-adapter.interface';

/**
 * Adapter Asaas — delega pro AsaasService existente.
 *
 * Não reescreve lógica — traduz a interface unificada pra chamadas
 * do service que já funciona (criptografia, webhook, idempotência).
 * Erros do Asaas são traduzidos pra GatewayError padronizado.
 */
@Injectable()
export class AsaasAdapter implements GatewayPagamentoAdapter {
  private readonly logger = new Logger(AsaasAdapter.name);

  constructor(private readonly asaasService: AsaasService) {}

  private traduzirErro(err: any): GatewayError {
    const status = err.response?.status ?? err.status;
    const msg = err.response?.data?.errors?.[0]?.description
      ?? err.response?.data?.message
      ?? err.message
      ?? 'Erro desconhecido no Asaas';

    if (status === 401 || status === 403) {
      return new GatewayError({
        code: 'CREDENCIAIS_INVALIDAS',
        message: `Credenciais Asaas inválidas ou expiradas: ${msg}`,
        retryable: false,
        originalError: err,
      });
    }

    if (status === 422 || status === 400) {
      const descLower = String(msg).toLowerCase();
      if (descLower.includes('cpf') || descLower.includes('cnpj') || descLower.includes('inválido')) {
        return new GatewayError({
          code: 'COOPERADO_INVALIDO',
          message: `Dados do cooperado rejeitados pelo Asaas: ${msg}`,
          retryable: false,
          originalError: err,
        });
      }
      if (descLower.includes('duplicat') || descLower.includes('already')) {
        return new GatewayError({
          code: 'COBRANCA_DUPLICADA',
          message: `Cobrança já existe no Asaas: ${msg}`,
          retryable: false,
          originalError: err,
        });
      }
      return new GatewayError({
        code: 'DESCONHECIDO',
        message: `Erro de validação no Asaas: ${msg}`,
        retryable: false,
        originalError: err,
      });
    }

    if (err.code === 'ECONNREFUSED' || err.code === 'ENOTFOUND' || err.code === 'ETIMEDOUT' || err.code === 'ECONNABORTED') {
      return new GatewayError({
        code: 'GATEWAY_INDISPONIVEL',
        message: `Asaas indisponível: ${msg}`,
        retryable: true,
        originalError: err,
      });
    }

    if (status >= 500) {
      return new GatewayError({
        code: 'GATEWAY_INDISPONIVEL',
        message: `Erro interno do Asaas (${status}): ${msg}`,
        retryable: true,
        originalError: err,
      });
    }

    return new GatewayError({
      code: 'DESCONHECIDO',
      message: `Erro no Asaas: ${msg}`,
      retryable: false,
      originalError: err,
    });
  }

  async criarCustomer(cooperadoId: string, cooperativaId: string): Promise<ResultadoCustomer> {
    try {
      const customer = await this.asaasService.criarOuBuscarCustomer(cooperadoId, cooperativaId);
      return { gatewayCustomerId: customer.asaasId };
    } catch (err) {
      throw this.traduzirErro(err);
    }
  }

  async emitirCobranca(
    cooperadoId: string,
    cooperativaId: string,
    dados: EmitirCobrancaDto,
  ): Promise<ResultadoEmissao> {
    try {
      const result = await this.asaasService.emitirCobranca(cooperadoId, cooperativaId, {
        valor: dados.valor,
        vencimento: dados.vencimento,
        descricao: dados.descricao,
        formaPagamento: dados.formaPagamento,
        cobrancaId: dados.cobrancaId,
      });

      return {
        gatewayId: result.asaasId,
        status: result.status,
        linkPagamento: result.linkPagamento ?? undefined,
        boletoUrl: result.boletoUrl ?? undefined,
        pixQrCode: (result as any).pixQrCode ?? undefined,
        pixCopiaECola: (result as any).pixCopiaECola ?? undefined,
        nossoNumero: result.nossoNumero ?? undefined,
        linhaDigitavel: (result as any).linhaDigitavel ?? undefined,
      };
    } catch (err) {
      throw this.traduzirErro(err);
    }
  }

  async cancelarCobranca(gatewayId: string, cooperativaId: string): Promise<void> {
    try {
      await this.asaasService.cancelarCobranca(gatewayId, cooperativaId);
    } catch (err) {
      throw this.traduzirErro(err);
    }
  }

  async processarWebhook(payload: any, token: string): Promise<WebhookResult> {
    try {
      const result = await this.asaasService.processarWebhook(payload, token);
      return {
        received: result.received,
        skipped: result.skipped,
      };
    } catch (err) {
      throw this.traduzirErro(err);
    }
  }

  async testarConexao(cooperativaId: string): Promise<TesteConexaoResult> {
    try {
      return await this.asaasService.testarConexao(cooperativaId);
    } catch (err) {
      throw this.traduzirErro(err);
    }
  }
}
