import { Injectable, BadRequestException, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { AsaasAdapter } from './adapters/asaas.adapter';
import {
  GatewayPagamentoAdapter,
  EmitirCobrancaDto,
  ResultadoEmissao,
  ResultadoCustomer,
  WebhookResult,
  TesteConexaoResult,
} from './interfaces/gateway-pagamento-adapter.interface';

/**
 * Orquestrador de gateways de pagamento.
 *
 * Resolve qual adapter usar baseado na ConfigGateway do parceiro.
 * Se parceiro não tem config ativa, lança exceção (não silencia).
 *
 * Sprint 7 — Refatoração multi-gateway.
 */
@Injectable()
export class GatewayPagamentoService {
  private readonly logger = new Logger(GatewayPagamentoService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly asaasAdapter: AsaasAdapter,
  ) {}

  /**
   * Resolve o adapter correto pra uma cooperativa.
   * Busca ConfigGateway ativa e retorna o adapter correspondente.
   */
  private async resolverAdapter(cooperativaId: string): Promise<GatewayPagamentoAdapter> {
    const config = await this.prisma.configGateway.findFirst({
      where: { cooperativaId, ativo: true },
    });

    if (!config) {
      throw new BadRequestException(
        `Nenhum gateway de pagamento configurado para a cooperativa ${cooperativaId}. ` +
        `Configure em /dashboard/configuracoes/asaas ou via API.`,
      );
    }

    switch (config.gateway) {
      case 'ASAAS':
        return this.asaasAdapter;

      // Sprint 9: descomentar quando implementar
      // case 'SICOOB':
      //   return this.sicoobAdapter;
      // case 'BB':
      //   return this.bbAdapter;

      default:
        throw new BadRequestException(
          `Gateway "${config.gateway}" não suportado. Gateways disponíveis: ASAAS.`,
        );
    }
  }

  /**
   * Resolve adapter e retorna junto com o nome do gateway (pra logging/persistência).
   */
  private async resolverAdapterComGateway(cooperativaId: string): Promise<{
    adapter: GatewayPagamentoAdapter;
    gateway: string;
  }> {
    const config = await this.prisma.configGateway.findFirst({
      where: { cooperativaId, ativo: true },
    });

    if (!config) {
      throw new BadRequestException(
        `Nenhum gateway de pagamento configurado para a cooperativa ${cooperativaId}. ` +
        `Configure em /dashboard/configuracoes/asaas ou via API.`,
      );
    }

    const adapter = await this.resolverAdapter(cooperativaId);
    return { adapter, gateway: config.gateway };
  }

  // ─── Métodos públicos (delegam pro adapter resolvido) ────────

  async criarCustomer(cooperadoId: string, cooperativaId: string): Promise<ResultadoCustomer> {
    const adapter = await this.resolverAdapter(cooperativaId);
    return adapter.criarCustomer(cooperadoId, cooperativaId);
  }

  async emitirCobranca(
    cooperadoId: string,
    cooperativaId: string,
    dados: EmitirCobrancaDto,
  ): Promise<ResultadoEmissao & { gateway: string }> {
    const { adapter, gateway } = await this.resolverAdapterComGateway(cooperativaId);
    const resultado = await adapter.emitirCobranca(cooperadoId, cooperativaId, dados);

    // Persistir em CobrancaGateway (registro unificado)
    await this.prisma.cobrancaGateway.create({
      data: {
        cobrancaId: dados.cobrancaId || null,
        cooperadoId,
        gateway,
        gatewayId: resultado.gatewayId,
        status: resultado.status,
        valor: dados.valor,
        vencimento: new Date(dados.vencimento),
        linkPagamento: resultado.linkPagamento,
        boletoUrl: resultado.boletoUrl,
        pixQrCode: resultado.pixQrCode,
        pixCopiaECola: resultado.pixCopiaECola,
        nossoNumero: resultado.nossoNumero,
        linhaDigitavel: resultado.linhaDigitavel,
        formaPagamento: dados.formaPagamento,
        dadosExtras: resultado.dadosExtras ? JSON.parse(JSON.stringify(resultado.dadosExtras)) : undefined,
      },
    });

    return { ...resultado, gateway };
  }

  async cancelarCobranca(gatewayId: string, cooperativaId: string): Promise<void> {
    const adapter = await this.resolverAdapter(cooperativaId);
    await adapter.cancelarCobranca(gatewayId, cooperativaId);

    // Atualizar status no registro local
    await this.prisma.cobrancaGateway.updateMany({
      where: { gatewayId },
      data: { status: 'CANCELLED' },
    });
  }

  async processarWebhook(payload: any, token: string, gateway: string): Promise<WebhookResult> {
    // Webhook vem com gateway explícito (rota separada por gateway)
    switch (gateway) {
      case 'ASAAS':
        return this.asaasAdapter.processarWebhook(payload, token);
      default:
        throw new BadRequestException(`Webhook pra gateway "${gateway}" não suportado.`);
    }
  }

  async testarConexao(cooperativaId: string): Promise<TesteConexaoResult> {
    const adapter = await this.resolverAdapter(cooperativaId);
    return adapter.testarConexao(cooperativaId);
  }
}
