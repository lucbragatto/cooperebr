import { Injectable, Logger } from '@nestjs/common';
import { AsaasService } from '../../asaas/asaas.service';
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
 */
@Injectable()
export class AsaasAdapter implements GatewayPagamentoAdapter {
  private readonly logger = new Logger(AsaasAdapter.name);

  constructor(private readonly asaasService: AsaasService) {}

  async criarCustomer(cooperadoId: string, cooperativaId: string): Promise<ResultadoCustomer> {
    const customer = await this.asaasService.criarOuBuscarCustomer(cooperadoId, cooperativaId);
    return { gatewayCustomerId: customer.asaasId };
  }

  async emitirCobranca(
    cooperadoId: string,
    cooperativaId: string,
    dados: EmitirCobrancaDto,
  ): Promise<ResultadoEmissao> {
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
  }

  async cancelarCobranca(gatewayId: string, cooperativaId: string): Promise<void> {
    await this.asaasService.cancelarCobranca(gatewayId, cooperativaId);
  }

  async processarWebhook(payload: any, token: string): Promise<WebhookResult> {
    const result = await this.asaasService.processarWebhook(payload, token);
    return {
      received: result.received,
      skipped: result.skipped,
    };
  }

  async testarConexao(cooperativaId: string): Promise<TesteConexaoResult> {
    return this.asaasService.testarConexao(cooperativaId);
  }
}
