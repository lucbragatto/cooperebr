import { Injectable, Logger } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';
import * as https from 'https';
import * as fs from 'fs';

interface TokenCache {
  token: string;
  expiresAt: number;
}

interface BbConfig {
  clientId: string;
  clientSecret: string;
  ambiente: string;
  convenio?: string;
  carteira?: string;
  agencia?: string;
  conta?: string;
  certificadoPfx?: string;
  certificadoSenha?: string;
}

interface DadosBoleto {
  valor: number;
  vencimento: Date;
  descricao: string;
  cooperadoNome: string;
  cooperadoCpf: string;
  nossoNumeroSequencial?: number;
}

interface DadosPix {
  valor: number;
  vencimento: Date;
  descricao: string;
  cooperadoNome: string;
  cooperadoCpf: string;
  txId?: string;
}

@Injectable()
export class BbService {
  private readonly logger = new Logger(BbService.name);
  private tokenCache = new Map<string, TokenCache>();

  constructor(private readonly httpService: HttpService) {}

  private getBaseUrl(ambiente: string): string {
    return ambiente === 'PRODUCAO'
      ? 'https://api.bb.com.br'
      : 'https://apisandbox.bb.com.br';
  }

  private getOAuthUrl(ambiente: string): string {
    return ambiente === 'PRODUCAO'
      ? 'https://oauth.bb.com.br/oauth/token'
      : 'https://oauth.sandbox.bb.com.br/oauth/token';
  }

  private createHttpsAgent(config: BbConfig): https.Agent | undefined {
    if (!config.certificadoPfx) return undefined;
    try {
      return new https.Agent({
        pfx: fs.readFileSync(config.certificadoPfx),
        passphrase: config.certificadoSenha || '',
      });
    } catch (err) {
      this.logger.warn(`Erro ao carregar certificado PFX: ${err.message}`);
      return undefined;
    }
  }

  async getToken(config: BbConfig): Promise<string> {
    const cacheKey = `bb_${config.clientId}_${config.ambiente}`;
    const cached = this.tokenCache.get(cacheKey);
    if (cached && cached.expiresAt > Date.now()) {
      return cached.token;
    }

    const url = this.getOAuthUrl(config.ambiente);
    const credentials = Buffer.from(`${config.clientId}:${config.clientSecret}`).toString('base64');
    const httpsAgent = this.createHttpsAgent(config);

    try {
      const { data } = await firstValueFrom(
        this.httpService.post(url, 'grant_type=client_credentials', {
          headers: {
            'Authorization': `Basic ${credentials}`,
            'Content-Type': 'application/x-www-form-urlencoded',
          },
          ...(httpsAgent && { httpsAgent }),
        }),
      );

      this.tokenCache.set(cacheKey, {
        token: data.access_token,
        expiresAt: Date.now() + (data.expires_in - 60) * 1000,
      });

      return data.access_token;
    } catch (err) {
      this.logger.error(`Erro ao obter token BB: ${err.message}`);
      throw err;
    }
  }

  async emitirBoleto(config: BbConfig, dados: DadosBoleto) {
    const token = await this.getToken(config);
    const baseUrl = this.getBaseUrl(config.ambiente);
    const httpsAgent = this.createHttpsAgent(config);

    const vencimento = dados.vencimento.toISOString().split('T')[0].replace(/-/g, '.');

    const payload = {
      numeroConvenio: Number(config.convenio),
      numeroCarteira: Number(config.carteira || 17),
      numeroVariacaoCarteira: 35,
      codigoModalidade: 1,
      dataEmissao: new Date().toISOString().split('T')[0].replace(/-/g, '.'),
      dataVencimento: vencimento,
      valorOriginal: dados.valor,
      textoDescricaoTipoTitulo: 'DM',
      indicadorAceiteTituloCobranca: 'N',
      codigoTipoJurosMora: 0,
      codigoTipoMulta: 0,
      codigoAceiteTituloCobranca: 'N',
      codigoTipoDuplicata: '2',
      pagador: {
        tipoInscricao: dados.cooperadoCpf.length > 11 ? 2 : 1,
        numeroInscricao: dados.cooperadoCpf.replace(/\D/g, ''),
        nome: dados.cooperadoNome,
      },
      ...(dados.nossoNumeroSequencial && {
        numeroTituloCliente: String(dados.nossoNumeroSequencial).padStart(10, '0'),
      }),
    };

    try {
      const { data } = await firstValueFrom(
        this.httpService.post(
          `${baseUrl}/cobrancas/v2/boletos`,
          payload,
          {
            headers: {
              'Authorization': `Bearer ${token}`,
              'Content-Type': 'application/json',
            },
            params: { 'gw-dev-app-key': config.clientId },
            ...(httpsAgent && { httpsAgent }),
          },
        ),
      );

      return {
        nossoNumero: data.numero || data.nossoNumero,
        codigoBarras: data.codigoBarraNumerico,
        linhaDigitavel: data.linhaDigitavel,
        urlBoleto: data.url || data.linkBoleto,
        retornoBanco: data,
      };
    } catch (err) {
      this.logger.error(`Erro ao emitir boleto BB: ${JSON.stringify(err.response?.data || err.message)}`);
      return {
        erro: true,
        retornoBanco: err.response?.data || { message: err.message },
      };
    }
  }

  async emitirPix(config: BbConfig, dados: DadosPix) {
    const token = await this.getToken(config);
    const baseUrl = this.getBaseUrl(config.ambiente);
    const httpsAgent = this.createHttpsAgent(config);

    const txId = dados.txId || `cooperebr${Date.now()}${Math.random().toString(36).slice(2, 8)}`;
    const expiracaoSegundos = Math.max(
      3600,
      Math.floor((dados.vencimento.getTime() - Date.now()) / 1000),
    );

    const payload = {
      calendario: {
        expiracao: expiracaoSegundos,
      },
      devedor: {
        cpf: dados.cooperadoCpf.replace(/\D/g, '').slice(0, 11),
        nome: dados.cooperadoNome,
      },
      valor: {
        original: dados.valor.toFixed(2),
      },
      chave: config.convenio || '',
      solicitacaoPagador: dados.descricao.slice(0, 140),
    };

    try {
      const { data } = await firstValueFrom(
        this.httpService.put(
          `${baseUrl}/pix/v1/cob/${txId}`,
          payload,
          {
            headers: {
              'Authorization': `Bearer ${token}`,
              'Content-Type': 'application/json',
            },
            params: { 'gw-dev-app-key': config.clientId },
            ...(httpsAgent && { httpsAgent }),
          },
        ),
      );

      return {
        txId: data.txid || txId,
        pixCopiaECola: data.pixCopiaECola || data.location,
        qrCodeBase64: data.qrCode || null,
        retornoBanco: data,
      };
    } catch (err) {
      this.logger.error(`Erro ao emitir PIX BB: ${JSON.stringify(err.response?.data || err.message)}`);
      return {
        erro: true,
        retornoBanco: err.response?.data || { message: err.message },
      };
    }
  }

  async consultarCobranca(config: BbConfig, nossoNumero: string) {
    const token = await this.getToken(config);
    const baseUrl = this.getBaseUrl(config.ambiente);
    const httpsAgent = this.createHttpsAgent(config);

    try {
      const { data } = await firstValueFrom(
        this.httpService.get(
          `${baseUrl}/cobrancas/v2/boletos/${nossoNumero}`,
          {
            headers: { 'Authorization': `Bearer ${token}` },
            params: {
              'gw-dev-app-key': config.clientId,
              numeroConvenio: config.convenio,
            },
            ...(httpsAgent && { httpsAgent }),
          },
        ),
      );

      return {
        status: this.mapStatusBoleto(data.codigoEstadoTituloCobranca),
        dataPagamento: data.dataCredito || null,
        valorPago: data.valorPagoSacado || data.valorAtual || null,
        retornoBanco: data,
      };
    } catch (err) {
      this.logger.error(`Erro ao consultar boleto BB: ${err.message}`);
      return { erro: true, retornoBanco: err.response?.data || { message: err.message } };
    }
  }

  async consultarPix(config: BbConfig, txId: string) {
    const token = await this.getToken(config);
    const baseUrl = this.getBaseUrl(config.ambiente);
    const httpsAgent = this.createHttpsAgent(config);

    try {
      const { data } = await firstValueFrom(
        this.httpService.get(
          `${baseUrl}/pix/v1/cob/${txId}`,
          {
            headers: { 'Authorization': `Bearer ${token}` },
            params: { 'gw-dev-app-key': config.clientId },
            ...(httpsAgent && { httpsAgent }),
          },
        ),
      );

      return {
        status: this.mapStatusPix(data.status),
        dataPagamento: data.pix?.[0]?.horario || null,
        valorPago: data.pix?.[0]?.valor ? parseFloat(data.pix[0].valor) : null,
        retornoBanco: data,
      };
    } catch (err) {
      this.logger.error(`Erro ao consultar PIX BB: ${err.message}`);
      return { erro: true, retornoBanco: err.response?.data || { message: err.message } };
    }
  }

  async cancelarBoleto(config: BbConfig, nossoNumero: string) {
    const token = await this.getToken(config);
    const baseUrl = this.getBaseUrl(config.ambiente);
    const httpsAgent = this.createHttpsAgent(config);

    try {
      const { data } = await firstValueFrom(
        this.httpService.post(
          `${baseUrl}/cobrancas/v2/boletos/${nossoNumero}/baixar`,
          {},
          {
            headers: {
              'Authorization': `Bearer ${token}`,
              'Content-Type': 'application/json',
            },
            params: {
              'gw-dev-app-key': config.clientId,
              numeroConvenio: config.convenio,
            },
            ...(httpsAgent && { httpsAgent }),
          },
        ),
      );
      return { sucesso: true, retornoBanco: data };
    } catch (err) {
      this.logger.error(`Erro ao cancelar boleto BB: ${err.message}`);
      return { erro: true, retornoBanco: err.response?.data || { message: err.message } };
    }
  }

  async consultarLiquidadasPeriodo(config: BbConfig, dataInicio: Date, dataFim: Date) {
    const token = await this.getToken(config);
    const baseUrl = this.getBaseUrl(config.ambiente);
    const httpsAgent = this.createHttpsAgent(config);

    const inicio = dataInicio.toISOString().split('T')[0].replace(/-/g, '.');
    const fim = dataFim.toISOString().split('T')[0].replace(/-/g, '.');

    try {
      const { data } = await firstValueFrom(
        this.httpService.get(
          `${baseUrl}/cobrancas/v2/boletos`,
          {
            headers: { 'Authorization': `Bearer ${token}` },
            params: {
              'gw-dev-app-key': config.clientId,
              indicadorSituacao: 'A',
              agenciaCobradora: config.agencia,
              contaMovimento: config.conta,
              dataInicioMovimento: inicio,
              dataFimMovimento: fim,
            },
            ...(httpsAgent && { httpsAgent }),
          },
        ),
      );

      return {
        boletos: (data.boletos || []).map((b: any) => ({
          nossoNumero: b.numero || b.nossoNumero,
          valorPago: b.valorPagoSacado || b.valorAtual,
          dataPagamento: b.dataCredito,
          status: 'LIQUIDADO',
        })),
        retornoBanco: data,
      };
    } catch (err) {
      this.logger.error(`Erro ao consultar liquidadas BB: ${err.message}`);
      return { boletos: [], retornoBanco: err.response?.data || { message: err.message } };
    }
  }

  private mapStatusBoleto(codigoEstado: string): string {
    const map: Record<string, string> = {
      '01': 'REGISTRADO',
      '02': 'REGISTRADO',
      '06': 'LIQUIDADO',
      '09': 'CANCELADO',
      '10': 'CANCELADO',
    };
    return map[codigoEstado] || 'REGISTRADO';
  }

  private mapStatusPix(status: string): string {
    const map: Record<string, string> = {
      'ATIVA': 'REGISTRADO',
      'CONCLUIDA': 'LIQUIDADO',
      'REMOVIDA_PELO_USUARIO_RECEBEDOR': 'CANCELADO',
      'REMOVIDA_PELO_PSP': 'CANCELADO',
    };
    return map[status] || 'PENDENTE';
  }
}
