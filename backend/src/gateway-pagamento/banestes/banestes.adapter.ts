import { Injectable, Logger, NotImplementedException } from '@nestjs/common';
import { PrismaService } from '../../prisma.service';
import { BanestesConfigService } from './banestes-config.service';
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
 * Adapter Banestes PIX — Cenario Minimo (M26, 2026-05-26).
 *
 * Implementa GatewayPagamentoAdapter (mesma interface do AsaasAdapter).
 *
 * Operacoes vivas nesta etapa:
 *   - emitirCobranca: POST /pix-qrcode-cobranca/v1/cob → retorna pixCopiaECola
 *   - criarCustomer: no-op (Banestes nao tem customer model — devedor inline)
 *   - testarConexao: GET /pix-qrcode-cobranca/v1/cob?... limit 1 (smoke)
 *
 * Stubs deliberados (Cenario Completo futuro):
 *   - cancelarCobranca: PATCH com status=REMOVIDA_PELO_USUARIO_RECEBEDOR
 *   - processarWebhook: validacao de origem + emit evento pagamento.confirmado
 *
 * D-novo-AH (catalogado): webhook fica pendente. Baixa de pagamento e
 * MANUAL pela equipe via painel admin Bloco 8 (campo marcarPago: true).
 */
@Injectable()
export class BanestesAdapter implements GatewayPagamentoAdapter {
  private readonly logger = new Logger(BanestesAdapter.name);

  constructor(
    private readonly config: BanestesConfigService,
    private readonly prisma: PrismaService,
  ) {}

  /**
   * Banestes nao tem customer model. Cobrancas recebem devedor inline
   * (nome + cpf/cnpj). Retornamos placeholder pra satisfazer a interface
   * GatewayPagamentoAdapter.
   *
   * cooperadoId e tenant retornados pra rastreabilidade no log.
   */
  async criarCustomer(cooperadoId: string, cooperativaId: string): Promise<ResultadoCustomer> {
    this.logger.log(
      `criarCustomer no-op Banestes (cooperado=${cooperadoId}, tenant=${cooperativaId})`,
    );
    return { gatewayCustomerId: `banestes:${cooperadoId}` };
  }

  /**
   * Emite cobranca PIX no Banestes. Mapeia EmitirCobrancaDto pro payload
   * canonico Banestes (devedor + valor + calendario + infoAdicionais).
   *
   * Requisitos:
   *   - dados.formaPagamento === 'PIX' (boleto registrado nao suportado)
   *   - cooperado deve ter cpf/cnpj + nome cadastrados
   *
   * Retorna pixCopiaECola pronto pro cooperado colar no app do banco.
   */
  async emitirCobranca(
    cooperadoId: string,
    cooperativaId: string,
    dados: EmitirCobrancaDto,
  ): Promise<ResultadoEmissao> {
    if (dados.formaPagamento !== 'PIX') {
      throw new GatewayError({
        code: 'DESCONHECIDO',
        message:
          `Banestes adapter suporta apenas formaPagamento=PIX (recebido: ${dados.formaPagamento}). ` +
          `Boleto registrado / CNAB nao implementados neste adapter.`,
        retryable: false,
      });
    }

    // Busca cooperado pra extrair nome + cpf/cnpj + chave PIX do tenant
    const cooperado = await this.prisma.cooperado.findFirst({
      where: { id: cooperadoId, cooperativaId },
      select: { id: true, nomeCompleto: true, cpf: true },
    });

    if (!cooperado) {
      throw new GatewayError({
        code: 'COOPERADO_INVALIDO',
        message: `Cooperado ${cooperadoId} nao encontrado no tenant ${cooperativaId}.`,
        retryable: false,
      });
    }

    if (!cooperado.cpf || cooperado.cpf.trim() === '') {
      throw new GatewayError({
        code: 'COOPERADO_INVALIDO',
        message: `Cooperado ${cooperadoId} sem CPF/CNPJ cadastrado — obrigatorio pro Banestes PIX.`,
        retryable: false,
      });
    }

    // Chave PIX recebedora vem do ConfigGateway do tenant
    const configGateway = await this.prisma.configGateway.findFirst({
      where: { cooperativaId, gateway: 'BANESTES', ativo: true },
      select: { credenciais: true },
    });

    const chavePixRecebedor =
      (configGateway?.credenciais as Record<string, unknown> | null)?.chavePix as string | undefined;

    if (!chavePixRecebedor) {
      throw new GatewayError({
        code: 'CREDENCIAIS_INVALIDAS',
        message:
          `ConfigGateway Banestes do tenant ${cooperativaId} sem chave PIX recebedora ` +
          `(credenciais.chavePix). Configure no painel admin.`,
        retryable: false,
      });
    }

    // Sanitiza CPF/CNPJ (Banestes espera so digitos)
    const documentoLimpo = cooperado.cpf.replace(/\D/g, '');
    const isCpf = documentoLimpo.length === 11;

    // Calendario: expiracao em segundos. Default 1 hora (3600s) — Banestes
    // legado usava VariaveisGlobais.TEMPO_BOLETO_EXPIRA. Configuravel via env.
    const expiracaoSegundos = Number(process.env.BANESTES_TEMPO_COBRANCA_EXPIRA_SEGUNDOS ?? '3600');

    // Valor: Banestes espera string com 2 casas decimais (ex: "100.00")
    const valorFormatado = dados.valor.toFixed(2);

    // Texto curto que aparece pro pagador no app do banco. Limit Banestes: 140 chars.
    const solicitacaoPagador = (
      dados.descricao ?? `CoopereBR - Cobranca ${dados.cobrancaId ?? ''}`
    ).slice(0, 140);

    const payload = {
      chave: chavePixRecebedor,
      solicitacaoPagador,
      calendario: { expiracao: expiracaoSegundos },
      valor: {
        original: valorFormatado,
        modalidadeAlteracao: 0, // 0 = valor fixo (cooperado nao pode alterar)
      },
      devedor: isCpf
        ? { nome: cooperado.nomeCompleto ?? '', cpf: documentoLimpo }
        : { nome: cooperado.nomeCompleto ?? '', cnpj: documentoLimpo },
      ...(dados.cobrancaId
        ? {
            infoAdicionais: [
              { nome: 'cobrancaId', valor: String(dados.cobrancaId).slice(0, 50) },
              { nome: 'cooperadoId', valor: String(cooperadoId).slice(0, 50) },
            ],
          }
        : {}),
    };

    const token = await this.config.getAccessToken(cooperativaId);
    const client = await this.config.getHttpClient(cooperativaId);

    try {
      const response = await client.post('/pix-qrcode-cobranca/v1/cob/', payload, {
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
      });

      if (response.status === 200 || response.status === 201) {
        const txid = String(response.data?.txid ?? '');
        const pixCopiaECola = String(response.data?.pixCopiaECola ?? '');

        if (!txid || !pixCopiaECola) {
          throw new GatewayError({
            code: 'DESCONHECIDO',
            message: 'Resposta Banestes sem txid ou pixCopiaECola.',
            retryable: true,
          });
        }

        this.logger.log(
          `emitirCobranca OK Banestes (cooperado=${cooperadoId}, tenant=${cooperativaId}, txid=${txid}, valor=${valorFormatado})`,
        );

        return {
          gatewayId: txid,
          status: response.data?.status ?? 'ATIVA',
          pixCopiaECola,
          dadosExtras: {
            chave: payload.chave,
            location: response.data?.location,
            expiracaoSegundos,
          },
        };
      }

      // Erros 4xx/5xx — mapear pra GatewayError tipado
      throw this.traduzirHttpError(response.status, response.data, cooperativaId);
    } catch (err) {
      if (err instanceof GatewayError) throw err;
      throw this.traduzirNetworkError(err);
    }
  }

  async cancelarCobranca(_gatewayId: string, _cooperativaId: string): Promise<void> {
    // Stub deliberado — Cenario Completo (M26 futuro).
    // Quando implementar: PATCH /pix-qrcode-cobranca/v1/cob/{txid}
    // com { status: 'REMOVIDA_PELO_USUARIO_RECEBEDOR' }.
    throw new NotImplementedException(
      'BanestesAdapter.cancelarCobranca nao implementado no Cenario Minimo (M26). ' +
        'Cancelamento manual via painel admin enquanto isso.',
    );
  }

  async processarWebhook(_payload: any, _token: string): Promise<WebhookResult> {
    // Stub deliberado — Cenario Completo (M26 futuro).
    // D-novo-AH catalogado: baixa de pagamento e MANUAL pela equipe via
    // painel admin Bloco 8 (campo marcarPago: true) enquanto webhook
    // nao for implementado.
    throw new NotImplementedException(
      'BanestesAdapter.processarWebhook nao implementado no Cenario Minimo (M26). ' +
        'Baixa de pagamento e manual via painel admin (D-novo-AH).',
    );
  }

  /**
   * Smoke test contra a API Banestes. Gera token + GET listar cobrancas
   * com limit 1 (operacao leve). Valida que .pfx + credenciais + endpoint
   * estao OK em conjunto.
   */
  async testarConexao(cooperativaId: string): Promise<TesteConexaoResult> {
    try {
      const token = await this.config.getAccessToken(cooperativaId);
      const client = await this.config.getHttpClient(cooperativaId);

      // GET leve — lista cobrancas (paginacao 1 item) so pra exercitar mTLS + token.
      // Banestes aceita range de data mesmo curto.
      const hoje = new Date();
      const ontem = new Date(hoje.getTime() - 24 * 60 * 60 * 1000);
      const fmt = (d: Date): string => d.toISOString().split('.')[0] + 'Z';

      const response = await client.get('/pix-qrcode-cobranca/v1/cob/', {
        params: {
          inicio: fmt(ontem),
          fim: fmt(hoje),
          'paginacao.itensPorPagina': 1,
        },
        headers: { Authorization: `Bearer ${token}` },
      });

      if (response.status >= 200 && response.status < 300) {
        const totalItens = Number(response.data?.parametros?.paginacao?.quantidadeTotalDeItens ?? 0);
        this.logger.log(
          `testarConexao OK Banestes (tenant=${cooperativaId}, totalCobrancasUlt24h=${totalItens})`,
        );
        return { ok: true, totalCustomers: totalItens };
      }

      return {
        ok: false,
        erro: `Banestes retornou HTTP ${response.status}. Verifique credenciais + chave PIX no ConfigGateway.`,
      };
    } catch (err) {
      const gatewayErr = err instanceof GatewayError ? err : this.traduzirNetworkError(err);
      this.logger.warn(
        `testarConexao FALHA Banestes (tenant=${cooperativaId}): ${gatewayErr.code} — ${gatewayErr.message}`,
      );
      return { ok: false, erro: `${gatewayErr.code}: ${gatewayErr.message}` };
    }
  }

  /**
   * Mapeia HTTP status + body do Banestes pra GatewayError tipado.
   */
  private traduzirHttpError(status: number, data: any, cooperativaId: string): GatewayError {
    const msg =
      data?.detail ??
      data?.title ??
      data?.message ??
      (typeof data === 'string' ? data : JSON.stringify(data));

    if (status === 401 || status === 403) {
      // Token expirou OU credenciais invalidas. Invalida cache pra forcar
      // refresh na proxima chamada (no tenant especifico).
      this.config.invalidarTokenCache(cooperativaId);
      return new GatewayError({
        code: 'CREDENCIAIS_INVALIDAS',
        message: `Banestes rejeitou autenticacao (HTTP ${status}): ${msg}`,
        retryable: false,
      });
    }

    if (status === 400 || status === 422) {
      const msgLower = String(msg).toLowerCase();
      if (msgLower.includes('cpf') || msgLower.includes('cnpj') || msgLower.includes('devedor')) {
        return new GatewayError({
          code: 'COOPERADO_INVALIDO',
          message: `Dados do cooperado rejeitados pelo Banestes (HTTP ${status}): ${msg}`,
          retryable: false,
        });
      }
      if (msgLower.includes('txid') || msgLower.includes('duplica')) {
        return new GatewayError({
          code: 'COBRANCA_DUPLICADA',
          message: `Cobranca ja existe no Banestes (HTTP ${status}): ${msg}`,
          retryable: false,
        });
      }
      return new GatewayError({
        code: 'DESCONHECIDO',
        message: `Erro de validacao no Banestes (HTTP ${status}): ${msg}`,
        retryable: false,
      });
    }

    if (status >= 500) {
      return new GatewayError({
        code: 'GATEWAY_INDISPONIVEL',
        message: `Banestes indisponivel (HTTP ${status}): ${msg}`,
        retryable: true,
      });
    }

    return new GatewayError({
      code: 'DESCONHECIDO',
      message: `Resposta inesperada do Banestes (HTTP ${status}): ${msg}`,
      retryable: false,
    });
  }

  /**
   * Mapeia erro de rede (ECONNREFUSED, ENOTFOUND, ETIMEDOUT) pra GatewayError.
   */
  private traduzirNetworkError(err: any): GatewayError {
    const code = err?.code as string | undefined;
    if (code === 'ECONNREFUSED' || code === 'ENOTFOUND' || code === 'ETIMEDOUT' || code === 'ECONNABORTED') {
      return new GatewayError({
        code: 'GATEWAY_INDISPONIVEL',
        message: `Banestes indisponivel (${code}): ${(err as Error).message}`,
        retryable: true,
        originalError: err,
      });
    }

    return new GatewayError({
      code: 'DESCONHECIDO',
      message: `Erro de rede ao chamar Banestes: ${(err as Error).message}`,
      retryable: false,
      originalError: err,
    });
  }
}
