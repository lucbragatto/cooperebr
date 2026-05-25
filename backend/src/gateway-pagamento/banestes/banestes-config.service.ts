import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { readFileSync } from 'node:fs';
import { Agent } from 'node:https';
import axios, { AxiosInstance } from 'axios';
import { GatewayError } from '../errors/gateway-error';

/**
 * Sprint 9 / Adapter Banestes — Cenario Minimo (M26, 2026-05-26).
 *
 * Centraliza:
 * - Carregamento do .pfx do disco + montagem do https.Agent reusavel (mTLS)
 * - Cache em memoria do OAuth access_token com TTL respeitando expires_in
 * - Cliente HTTP axios configurado com mTLS + timeout
 *
 * Variaveis de ambiente esperadas (.env):
 *   BANESTES_PFX_PATH         caminho absoluto do .pfx
 *   BANESTES_PFX_SENHA        senha do .pfx (rotacionar antes de prod — D-novo-AG)
 *   BANESTES_CLIENT_ID        OAuth client_id
 *   BANESTES_CLIENT_SECRET    OAuth client_secret
 *   BANESTES_AMBIENTE         "sandbox" | "producao" (default: sandbox)
 *   BANESTES_BASE_URL         override opcional (default deriva do ambiente)
 *   BANESTES_TIMEOUT_MS       default 10000 (igual ao legado Java HttpClient)
 *
 * D-novo-AG (catalogado): .pfx em disco hoje. Migrar pra Azure Key Vault
 * quando Sinergia entrar em producao.
 */
@Injectable()
export class BanestesConfigService implements OnModuleDestroy {
  private readonly logger = new Logger(BanestesConfigService.name);

  // Cache singleton — instancia unica de Agent reusavel (evita reconstruir SSL a cada chamada)
  private httpsAgentCache: Agent | null = null;
  // Cache do token OAuth — atualizado conforme expires_in
  private tokenCache: { accessToken: string; expiresAt: number } | null = null;
  // Margem de seguranca pra renovar antes do vencimento (5 min)
  private static readonly TOKEN_REFRESH_MARGIN_MS = 5 * 60 * 1000;

  /**
   * Carrega configuracao de ambiente em runtime. Lanca erro se incompleta.
   */
  private getConfig(): {
    pfxPath: string;
    pfxSenha: string;
    clientId: string;
    clientSecret: string;
    ambiente: 'sandbox' | 'producao';
    baseUrl: string;
    timeoutMs: number;
    authorizationBasic: string;
  } {
    const pfxPath = process.env.BANESTES_PFX_PATH;
    const pfxSenha = process.env.BANESTES_PFX_SENHA;
    const clientId = process.env.BANESTES_CLIENT_ID;
    const clientSecret = process.env.BANESTES_CLIENT_SECRET;
    const ambienteRaw = (process.env.BANESTES_AMBIENTE ?? 'sandbox').toLowerCase();
    const ambiente: 'sandbox' | 'producao' = ambienteRaw === 'producao' ? 'producao' : 'sandbox';
    const baseUrlDefault =
      ambiente === 'producao'
        ? 'https://api-pix.banestes.b.br'
        : 'https://api-pix-sandbox.banestes.b.br';
    const baseUrl = process.env.BANESTES_BASE_URL ?? baseUrlDefault;
    const timeoutMs = Number(process.env.BANESTES_TIMEOUT_MS ?? '10000');

    const faltando: string[] = [];
    if (!pfxPath) faltando.push('BANESTES_PFX_PATH');
    if (!pfxSenha) faltando.push('BANESTES_PFX_SENHA');
    if (!clientId) faltando.push('BANESTES_CLIENT_ID');
    if (!clientSecret) faltando.push('BANESTES_CLIENT_SECRET');
    if (faltando.length > 0) {
      throw new GatewayError({
        code: 'CREDENCIAIS_INVALIDAS',
        message:
          `Configuracao Banestes incompleta. Variaveis de ambiente ausentes: ${faltando.join(', ')}. ` +
          `Configure no .env e reinicie o backend.`,
        retryable: false,
      });
    }

    const authorizationBasic = Buffer.from(`${clientId}:${clientSecret}`).toString('base64');

    return {
      pfxPath: pfxPath!,
      pfxSenha: pfxSenha!,
      clientId: clientId!,
      clientSecret: clientSecret!,
      ambiente,
      baseUrl,
      timeoutMs,
      authorizationBasic,
    };
  }

  /**
   * Retorna https.Agent mTLS reusavel. Carrega o .pfx do disco apenas
   * uma vez por instancia (cache singleton).
   *
   * Throws GatewayError se .pfx nao for legivel ou senha incorreta.
   */
  getHttpsAgent(): Agent {
    if (this.httpsAgentCache) return this.httpsAgentCache;

    const config = this.getConfig();

    let pfxBuffer: Buffer;
    try {
      pfxBuffer = readFileSync(config.pfxPath);
    } catch (err) {
      throw new GatewayError({
        code: 'CREDENCIAIS_INVALIDAS',
        message:
          `Nao foi possivel ler o certificado Banestes em ${config.pfxPath}. ` +
          `Confirme que BANESTES_PFX_PATH aponta pra um arquivo .pfx legivel.`,
        retryable: false,
        originalError: err,
      });
    }

    try {
      this.httpsAgentCache = new Agent({
        pfx: pfxBuffer,
        passphrase: config.pfxSenha,
        minVersion: 'TLSv1.2',
        keepAlive: true,
      });
    } catch (err) {
      throw new GatewayError({
        code: 'CREDENCIAIS_INVALIDAS',
        message:
          `Falha ao carregar certificado Banestes (.pfx). Confirme senha (BANESTES_PFX_SENHA) ` +
          `e validade do certificado.`,
        retryable: false,
        originalError: err,
      });
    }

    this.logger.log(`Banestes httpsAgent inicializado (ambiente=${config.ambiente})`);
    return this.httpsAgentCache;
  }

  /**
   * Cria axios instance com mTLS pre-configurado. Cada chamada e independente
   * mas reusa o mesmo Agent (keep-alive).
   */
  getHttpClient(): AxiosInstance {
    const config = this.getConfig();
    return axios.create({
      baseURL: config.baseUrl,
      timeout: config.timeoutMs,
      httpsAgent: this.getHttpsAgent(),
      headers: { 'User-Agent': 'cooperebr-sisgd/banestes-adapter' },
      // Importante: nao lancar exception em status 4xx — adapter mapeia manualmente
      validateStatus: () => true,
    });
  }

  /**
   * Retorna access_token OAuth valido. Usa cache em memoria — chama API
   * Banestes apenas se token expirou (ou esta perto de expirar).
   *
   * Banestes OAuth2 Client Credentials:
   *   POST /oauth/v1/access-token
   *   Body: grant_type=client_credentials (form-urlencoded)
   *   Headers: Authorization: Basic <base64(client_id:secret)>
   *   Response: { access_token, expires_in, token_type, scope }
   */
  async getAccessToken(): Promise<string> {
    if (this.tokenCache && this.tokenCache.expiresAt > Date.now()) {
      return this.tokenCache.accessToken;
    }

    const config = this.getConfig();
    const client = this.getHttpClient();

    try {
      const response = await client.post(
        '/oauth/v1/access-token',
        'grant_type=client_credentials',
        {
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
            Authorization: `Basic ${config.authorizationBasic}`,
          },
        },
      );

      if (response.status !== 200) {
        throw new GatewayError({
          code: response.status === 401 ? 'CREDENCIAIS_INVALIDAS' : 'GATEWAY_INDISPONIVEL',
          message:
            `Falha ao obter token OAuth Banestes (HTTP ${response.status}). ` +
            `Verifique BANESTES_CLIENT_ID + BANESTES_CLIENT_SECRET.`,
          retryable: response.status >= 500,
        });
      }

      const accessToken = response.data?.access_token as string | undefined;
      const expiresIn = Number(response.data?.expires_in ?? 3600);

      if (!accessToken) {
        throw new GatewayError({
          code: 'DESCONHECIDO',
          message: 'Resposta OAuth Banestes sem access_token.',
          retryable: true,
        });
      }

      const ttlMs = expiresIn * 1000 - BanestesConfigService.TOKEN_REFRESH_MARGIN_MS;
      this.tokenCache = {
        accessToken,
        expiresAt: Date.now() + Math.max(ttlMs, 60_000), // pelo menos 1 min
      };

      this.logger.log(
        `Banestes OAuth token renovado (expira em ~${Math.round(ttlMs / 1000)}s, ambiente=${config.ambiente})`,
      );

      return accessToken;
    } catch (err) {
      if (err instanceof GatewayError) throw err;

      if ((err as any)?.code === 'ECONNREFUSED' || (err as any)?.code === 'ENOTFOUND' || (err as any)?.code === 'ETIMEDOUT') {
        throw new GatewayError({
          code: 'GATEWAY_INDISPONIVEL',
          message: `Banestes indisponivel: ${(err as Error).message}`,
          retryable: true,
          originalError: err,
        });
      }

      throw new GatewayError({
        code: 'DESCONHECIDO',
        message: `Erro ao obter token OAuth Banestes: ${(err as Error).message}`,
        retryable: false,
        originalError: err,
      });
    }
  }

  /**
   * Invalida o cache de token (forca refresh na proxima chamada). Util
   * pra testes ou quando recebemos 401 Bearer expirado.
   */
  invalidarTokenCache(): void {
    this.tokenCache = null;
  }

  /**
   * Limpa Agent + token. Util pra testes que precisam recarregar config.
   */
  resetCache(): void {
    this.httpsAgentCache = null;
    this.tokenCache = null;
  }

  onModuleDestroy(): void {
    if (this.httpsAgentCache) {
      this.httpsAgentCache.destroy();
      this.httpsAgentCache = null;
    }
    this.tokenCache = null;
  }
}
