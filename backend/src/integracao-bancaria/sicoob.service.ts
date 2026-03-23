import { Injectable, Logger } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';
import * as https from 'https';
import * as fs from 'fs';

interface TokenCache {
  token: string;
  expiresAt: number;
}

interface SicoobConfig {
  clientId: string;
  clientSecret: string;
  ambiente: string;
  convenio?: string;
  carteira?: string;
  agencia?: string;
  conta?: string;
  digitoConta?: string;
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
export class SicoobService {
  private readonly logger = new Logger(SicoobService.name);
  private tokenCache = new Map<string, TokenCache>();

  constructor(private readonly httpService: HttpService) {}

  private getBaseUrl(ambiente: string): string {
    return ambiente === 'PRODUCAO'
      ? 'https://api.sicoob.com.br'
      : 'https://sandbox.sicoob.com.br';
  }

  private getOAuthUrl(ambiente: string): string {
    return ambiente === 'PRODUCAO'
      ? 'https://auth.sicoob.com.br/auth/realms/cooperado/protocol/openid-connect/token'
      : 'https://sandbox.sicoob.com.br/token';
  }

  private createHttpsAgent(config: SicoobConfig): https.Agent | undefined {
    if (!config.certificadoPfx) return undefined;
    try {
      return new https.Agent({
        pfx: fs.readFileSync(config.certificadoPfx),
        passphrase: config.certificadoSenha || '',
      });
    } catch (err) {
      this.logger.warn(`Erro ao carregar certificado PFX Sicoob: ${err.message}`);
      return undefined;
    }
  }

  async getToken(config: SicoobConfig): Promise<string> {
    const cacheKey = `sicoob_${config.clientId}_${config.ambiente}`;
    const cached = this.tokenCache.get(cacheKey);
    if (cached && cached.expiresAt > Date.now()) {
      return cached.token;
    }

    const url = this.getOAuthUrl(config.ambiente);

    try {
      const params = new URLSearchParams();
      params.append('grant_type', 'client_credentials');
      params.append('client_id', config.clientId);
      params.append('client_secret', config.clientSecret);
      params.append('scope', 'cobranca_boletos_incluir cobranca_boletos_consultar cobranca_boletos_pagador cob.read cob.write pix.read pix.write');

      const httpsAgent = this.createHttpsAgent(config);

      const { data } = await firstValueFrom(
        this.httpService.post(url, params.toString(), {
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          ...(httpsAgent && { httpsAgent }),
        }),
      );

      this.tokenCache.set(cacheKey, {
        token: data.access_token,
        expiresAt: Date.now() + (data.expires_in - 60) * 1000,
      });

      return data.access_token;
    } catch (err) {
      this.logger.error(`Erro ao obter token Sicoob: ${err.message}`);
      throw err;
    }
  }

  async emitirBoleto(config: SicoobConfig, dados: DadosBoleto) {
    const token = await this.getToken(config);
    const baseUrl = this.getBaseUrl(config.ambiente);
    const httpsAgent = this.createHttpsAgent(config);

    const vencimento = dados.vencimento.toISOString().split('T')[0];
    const cpfLimpo = dados.cooperadoCpf.replace(/\D/g, '');

    const payload = {
      numeroContrato: Number(config.convenio),
      modalidade: 1,
      numeroContaCorrente: Number(config.conta),
      especieDocumento: 'DM',
      dataEmissao: new Date().toISOString().split('T')[0],
      nossoNumero: dados.nossoNumeroSequencial || undefined,
      seuNumero: dados.nossoNumeroSequencial ? String(dados.nossoNumeroSequencial) : undefined,
      identificacaoBoletoEmpresa: dados.descricao.slice(0, 25),
      identificacaoEmissaoBoleto: 2,
      identificacaoDistribuicaoBoleto: 0,
      valor: dados.valor,
      dataVencimento: vencimento,
      tipoDesconto: 0,
      tipoMulta: 0,
      tipoJurosMora: 0,
      numeroParcela: 1,
      aceite: false,
      codigoPagador: 0,
      tipoPagador: cpfLimpo.length > 11 ? 2 : 1,
      cpfCnpjPagador: cpfLimpo,
      nomePagador: dados.cooperadoNome,
      gerarPdf: true,
    };

    try {
      const { data } = await firstValueFrom(
        this.httpService.post(
          `${baseUrl}/cobranca-bancaria/v3/boletos`,
          { boletos: [payload] },
          {
            headers: {
              'Authorization': `Bearer ${token}`,
              'Content-Type': 'application/json',
              'client_id': config.clientId,
            },
            ...(httpsAgent && { httpsAgent }),
          },
        ),
      );

      const resultado = data.resultado?.[0] || data;

      return {
        nossoNumero: resultado.nossoNumero?.toString() || null,
        codigoBarras: resultado.codigoBarras || null,
        linhaDigitavel: resultado.linhaDigitavel || null,
        urlBoleto: resultado.pdfBoleto || resultado.urlBoleto || null,
        retornoBanco: data,
      };
    } catch (err) {
      this.logger.error(`Erro ao emitir boleto Sicoob: ${JSON.stringify(err.response?.data || err.message)}`);
      return {
        erro: true,
        retornoBanco: err.response?.data || { message: err.message },
      };
    }
  }

  async emitirPix(config: SicoobConfig, dados: DadosPix) {
    const token = await this.getToken(config);
    const baseUrl = this.getBaseUrl(config.ambiente);
    const httpsAgent = this.createHttpsAgent(config);

    const txId = dados.txId || `cooperebr${Date.now()}${Math.random().toString(36).slice(2, 8)}`;
    const expiracaoSegundos = Math.max(
      3600,
      Math.floor((dados.vencimento.getTime() - Date.now()) / 1000),
    );

    const cpfLimpo = dados.cooperadoCpf.replace(/\D/g, '');

    const payload = {
      calendario: {
        expiracao: expiracaoSegundos,
      },
      devedor: {
        ...(cpfLimpo.length > 11 ? { cnpj: cpfLimpo } : { cpf: cpfLimpo }),
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
          `${baseUrl}/pix/v2/cob/${txId}`,
          payload,
          {
            headers: {
              'Authorization': `Bearer ${token}`,
              'Content-Type': 'application/json',
              'client_id': config.clientId,
            },
            ...(httpsAgent && { httpsAgent }),
          },
        ),
      );

      return {
        txId: data.txid || txId,
        pixCopiaECola: data.pixCopiaECola || data.location || null,
        qrCodeBase64: data.qrCode || null,
        retornoBanco: data,
      };
    } catch (err) {
      this.logger.error(`Erro ao emitir PIX Sicoob: ${JSON.stringify(err.response?.data || err.message)}`);
      return {
        erro: true,
        retornoBanco: err.response?.data || { message: err.message },
      };
    }
  }

  async consultarCobranca(config: SicoobConfig, nossoNumero: string) {
    const token = await this.getToken(config);
    const baseUrl = this.getBaseUrl(config.ambiente);
    const httpsAgent = this.createHttpsAgent(config);

    try {
      const { data } = await firstValueFrom(
        this.httpService.get(
          `${baseUrl}/cobranca-bancaria/v3/boletos`,
          {
            headers: {
              'Authorization': `Bearer ${token}`,
              'client_id': config.clientId,
            },
            params: {
              nossoNumero,
              numeroContrato: config.convenio,
            },
            ...(httpsAgent && { httpsAgent }),
          },
        ),
      );

      const boleto = data.resultado?.[0] || data;

      return {
        status: this.mapStatusBoleto(boleto.situacaoBoleto || boleto.situacao),
        dataPagamento: boleto.dataPagamento || null,
        valorPago: boleto.valorPago || boleto.valorRecebido || null,
        retornoBanco: data,
      };
    } catch (err) {
      this.logger.error(`Erro ao consultar boleto Sicoob: ${err.message}`);
      return { erro: true, retornoBanco: err.response?.data || { message: err.message } };
    }
  }

  async consultarPix(config: SicoobConfig, txId: string) {
    const token = await this.getToken(config);
    const baseUrl = this.getBaseUrl(config.ambiente);
    const httpsAgent = this.createHttpsAgent(config);

    try {
      const { data } = await firstValueFrom(
        this.httpService.get(
          `${baseUrl}/pix/v2/cob/${txId}`,
          {
            headers: {
              'Authorization': `Bearer ${token}`,
              'client_id': config.clientId,
            },
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
      this.logger.error(`Erro ao consultar PIX Sicoob: ${err.message}`);
      return { erro: true, retornoBanco: err.response?.data || { message: err.message } };
    }
  }

  async cancelarBoleto(config: SicoobConfig, nossoNumero: string) {
    const token = await this.getToken(config);
    const baseUrl = this.getBaseUrl(config.ambiente);
    const httpsAgent = this.createHttpsAgent(config);

    try {
      const { data } = await firstValueFrom(
        this.httpService.patch(
          `${baseUrl}/cobranca-bancaria/v3/boletos/${nossoNumero}/baixar`,
          {},
          {
            headers: {
              'Authorization': `Bearer ${token}`,
              'Content-Type': 'application/json',
              'client_id': config.clientId,
            },
            params: { numeroContrato: config.convenio },
            ...(httpsAgent && { httpsAgent }),
          },
        ),
      );
      return { sucesso: true, retornoBanco: data };
    } catch (err) {
      this.logger.error(`Erro ao cancelar boleto Sicoob: ${err.message}`);
      return { erro: true, retornoBanco: err.response?.data || { message: err.message } };
    }
  }

  async consultarLiquidadasPeriodo(config: SicoobConfig, dataInicio: Date, dataFim: Date) {
    const token = await this.getToken(config);
    const baseUrl = this.getBaseUrl(config.ambiente);
    const httpsAgent = this.createHttpsAgent(config);

    const inicio = dataInicio.toISOString().split('T')[0];
    const fim = dataFim.toISOString().split('T')[0];

    try {
      const { data } = await firstValueFrom(
        this.httpService.get(
          `${baseUrl}/cobranca-bancaria/v3/boletos/liquidados`,
          {
            headers: {
              'Authorization': `Bearer ${token}`,
              'client_id': config.clientId,
            },
            params: {
              numeroContrato: config.convenio,
              dataInicio: inicio,
              dataFim: fim,
            },
            ...(httpsAgent && { httpsAgent }),
          },
        ),
      );

      return {
        boletos: (data.resultado || []).map((b: any) => ({
          nossoNumero: b.nossoNumero?.toString(),
          valorPago: b.valorPago || b.valorRecebido,
          dataPagamento: b.dataPagamento,
          status: 'LIQUIDADO',
        })),
        retornoBanco: data,
      };
    } catch (err) {
      this.logger.error(`Erro ao consultar liquidadas Sicoob: ${err.message}`);
      return { boletos: [], retornoBanco: err.response?.data || { message: err.message } };
    }
  }

  private mapStatusBoleto(situacao: string | number): string {
    const map: Record<string, string> = {
      '1': 'REGISTRADO',
      '2': 'REGISTRADO',
      '3': 'LIQUIDADO',
      '4': 'CANCELADO',
      'Em Aberto': 'REGISTRADO',
      'Liquidado': 'LIQUIDADO',
      'Baixado': 'CANCELADO',
    };
    return map[String(situacao)] || 'REGISTRADO';
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
