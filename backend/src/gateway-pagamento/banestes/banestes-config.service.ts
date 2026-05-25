import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { readFileSync } from 'node:fs';
import { Agent } from 'node:https';
import axios, { AxiosInstance } from 'axios';
import { GatewayError } from '../errors/gateway-error';
import { PrismaService } from '../../prisma.service';
import { CredentialsEncryptor } from '../../gateways-pagamento-config/credentials-encryptor.service';

/**
 * Sub-Sprint Gateways de Pagamento — Fatia F3 (M28, 2026-05-26).
 *
 * REFATOR multi-tenant: ConfigGateway BANESTES por tenant em vez de
 * `process.env.BANESTES_*` globais.
 *
 * Centraliza por `cooperativaId`:
 *  - Carrega ConfigGateway Banestes ativa do tenant + decripta secrets
 *    (CredentialsEncryptor com GATEWAY_ENCRYPT_KEY)
 *  - Cache em memoria do https.Agent reusavel por tenant (Map)
 *  - Cache do OAuth token por tenant (Map) com TTL = expires_in - 5min
 *  - Cliente HTTP axios configurado com mTLS + timeout
 *
 * Valores globais permanecem em env (nao-secretos, nao-especificos por
 * tenant):
 *  - BANESTES_TIMEOUT_MS (default 10000)
 *  - BANESTES_TEMPO_COBRANCA_EXPIRA_SEGUNDOS (default 3600)
 *
 * Variaveis BANESTES_* especificas (PFX_PATH, PFX_SENHA, CLIENT_ID,
 * CLIENT_SECRET, AMBIENTE, BASE_URL) ficaram OBSOLETAS — substituidas
 * por ConfigGateway gateway=BANESTES com:
 *   credenciais (Json):
 *     __enc: { pfxSenha, clientId, clientSecret, chavePix }  ← encrypted
 *     pfxPath: "/opt/certs/{tenant}-{ambiente}.pfx"          ← texto puro
 *   ambiente: "SANDBOX" | "PRODUCAO"                          ← coluna propria
 *
 * D-novo-AG (catalogado): .pfx em disco hoje. Migrar pra Azure Key Vault
 * quando Sinergia entrar em producao.
 */
export interface BanestesConfigCarregada {
  pfxPath: string;
  pfxSenha: string;
  clientId: string;
  clientSecret: string;
  chavePix: string;
  ambiente: 'sandbox' | 'producao';
  baseUrl: string;
  timeoutMs: number;
  authorizationBasic: string;
}

@Injectable()
export class BanestesConfigService implements OnModuleDestroy {
  private readonly logger = new Logger(BanestesConfigService.name);

  // Cache por tenant — chave: cooperativaId
  private httpsAgentCache = new Map<string, Agent>();
  private tokenCache = new Map<string, { accessToken: string; expiresAt: number }>();

  // Margem de seguranca pra renovar antes do vencimento (5 min)
  private static readonly TOKEN_REFRESH_MARGIN_MS = 5 * 60 * 1000;

  constructor(
    private readonly prisma: PrismaService,
    private readonly encryptor: CredentialsEncryptor,
  ) {}

  /**
   * Busca ConfigGateway Banestes ativa do tenant + decripta secrets +
   * monta config carregada pronta pra consumo. Throws GatewayError
   * explicativo se ausente, inativa ou com credenciais incompletas.
   */
  async carregarConfig(cooperativaId: string): Promise<BanestesConfigCarregada> {
    if (!cooperativaId) {
      throw new GatewayError({
        code: 'CREDENCIAIS_INVALIDAS',
        message: 'cooperativaId obrigatorio pra carregar config Banestes.',
        retryable: false,
      });
    }

    const row = await this.prisma.configGateway.findFirst({
      where: { cooperativaId, gateway: 'BANESTES', ativo: true },
    });

    if (!row) {
      throw new GatewayError({
        code: 'CREDENCIAIS_INVALIDAS',
        message:
          `Cooperativa ${cooperativaId} sem ConfigGateway BANESTES ativa. ` +
          `Configure em /dashboard/configuracoes/gateways-pagamento ` +
          `(POST /gateways-pagamento) antes de emitir cobranca PIX Banestes.`,
        retryable: false,
      });
    }

    const ambienteRaw = (row.ambiente ?? 'SANDBOX').toUpperCase();
    const ambiente: 'sandbox' | 'producao' = ambienteRaw === 'PRODUCAO' ? 'producao' : 'sandbox';

    // Decripta secrets + extrai metadados em texto puro do shape unificado
    // F1: { __enc: {...secrets}, pfxPath: "..." }
    let decifradas: Record<string, string>;
    try {
      decifradas = this.decifrarCredenciais(row.credenciais);
    } catch (err) {
      throw new GatewayError({
        code: 'CREDENCIAIS_INVALIDAS',
        message:
          `Falha ao decifrar credenciais Banestes da cooperativa ${cooperativaId}. ` +
          `Possivel causa: GATEWAY_ENCRYPT_KEY foi rotacionada sem migrar dados. ` +
          `Detalhe: ${(err as Error).message}`,
        retryable: false,
        originalError: err,
      });
    }

    const faltando: string[] = [];
    const pfxPath = decifradas['pfxPath'];
    const pfxSenha = decifradas['pfxSenha'];
    const clientId = decifradas['clientId'];
    const clientSecret = decifradas['clientSecret'];
    const chavePix = decifradas['chavePix'];

    if (!pfxPath) faltando.push('pfxPath');
    if (!pfxSenha) faltando.push('pfxSenha');
    if (!clientId) faltando.push('clientId');
    if (!clientSecret) faltando.push('clientSecret');
    if (!chavePix) faltando.push('chavePix');

    if (faltando.length > 0) {
      throw new GatewayError({
        code: 'CREDENCIAIS_INVALIDAS',
        message:
          `ConfigGateway BANESTES da cooperativa ${cooperativaId} esta incompleta. ` +
          `Campos faltando: ${faltando.join(', ')}. ` +
          `Edite em PATCH /gateways-pagamento/${row.id} antes de usar.`,
        retryable: false,
      });
    }

    const baseUrlDefault =
      ambiente === 'producao'
        ? 'https://api-pix.banestes.b.br'
        : 'https://api-pix-sandbox.banestes.b.br';
    const baseUrl = (decifradas['baseUrl'] && decifradas['baseUrl'].trim() !== '') ? decifradas['baseUrl'] : baseUrlDefault;

    const timeoutMs = Number(process.env.BANESTES_TIMEOUT_MS ?? '10000');
    const authorizationBasic = Buffer.from(`${clientId}:${clientSecret}`).toString('base64');

    return {
      pfxPath,
      pfxSenha,
      clientId,
      clientSecret,
      chavePix,
      ambiente,
      baseUrl,
      timeoutMs,
      authorizationBasic,
    };
  }

  /**
   * Decripta o shape { __enc: { campo: "iv:cipher:tag" }, ...metadados }
   * gravado por GatewaysPagamentoConfigService.encriptarSecrets.
   */
  private decifrarCredenciais(rowCredenciais: unknown): Record<string, string> {
    const shape = (rowCredenciais as Record<string, unknown>) ?? {};
    const enc = (shape.__enc as Record<string, string> | undefined) ?? {};
    const resultado: Record<string, string> = {};

    for (const [campo, valor] of Object.entries(shape)) {
      if (campo === '__enc') continue;
      if (typeof valor === 'string') resultado[campo] = valor;
    }

    for (const [campo, cipher] of Object.entries(enc)) {
      resultado[campo] = this.encryptor.decrypt(cipher);
    }

    return resultado;
  }

  /**
   * Retorna https.Agent mTLS reusavel pro tenant. Carrega o .pfx do disco
   * apenas uma vez por (cooperativaId + path) — cache singleton por tenant.
   *
   * Throws GatewayError se .pfx nao for legivel ou senha incorreta.
   */
  async getHttpsAgent(cooperativaId: string): Promise<Agent> {
    const cached = this.httpsAgentCache.get(cooperativaId);
    if (cached) return cached;

    const config = await this.carregarConfig(cooperativaId);

    let pfxBuffer: Buffer;
    try {
      pfxBuffer = readFileSync(config.pfxPath);
    } catch (err) {
      throw new GatewayError({
        code: 'CREDENCIAIS_INVALIDAS',
        message:
          `Nao foi possivel ler o certificado Banestes da cooperativa ${cooperativaId} em ` +
          `${config.pfxPath}. Confirme que o caminho aponta pra um arquivo .pfx ` +
          `legivel pelo processo (permissao 0600 + dono correto).`,
        retryable: false,
        originalError: err,
      });
    }

    let agent: Agent;
    try {
      agent = new Agent({
        pfx: pfxBuffer,
        passphrase: config.pfxSenha,
        minVersion: 'TLSv1.2',
        keepAlive: true,
      });
    } catch (err) {
      throw new GatewayError({
        code: 'CREDENCIAIS_INVALIDAS',
        message:
          `Falha ao carregar certificado Banestes (.pfx) da cooperativa ${cooperativaId}. ` +
          `Confirme senha (credenciais.pfxSenha) + validade do certificado.`,
        retryable: false,
        originalError: err,
      });
    }

    this.httpsAgentCache.set(cooperativaId, agent);
    this.logger.log(
      `Banestes httpsAgent inicializado (cooperativa=${cooperativaId}, ambiente=${config.ambiente})`,
    );
    return agent;
  }

  /**
   * Cria axios instance com mTLS pre-configurado pro tenant. Cada chamada
   * e independente mas reusa o mesmo Agent (keep-alive).
   */
  async getHttpClient(cooperativaId: string): Promise<AxiosInstance> {
    const config = await this.carregarConfig(cooperativaId);
    const agent = await this.getHttpsAgent(cooperativaId);
    return axios.create({
      baseURL: config.baseUrl,
      timeout: config.timeoutMs,
      httpsAgent: agent,
      headers: { 'User-Agent': 'cooperebr-sisgd/banestes-adapter' },
      validateStatus: () => true, // nao lancar exception em 4xx — adapter mapeia manualmente
    });
  }

  /**
   * Retorna access_token OAuth valido pro tenant. Usa cache em memoria —
   * chama API Banestes apenas se token expirou (ou esta perto de expirar).
   */
  async getAccessToken(cooperativaId: string): Promise<string> {
    const cached = this.tokenCache.get(cooperativaId);
    if (cached && cached.expiresAt > Date.now()) {
      return cached.accessToken;
    }

    const config = await this.carregarConfig(cooperativaId);
    const client = await this.getHttpClient(cooperativaId);

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
            `Cooperativa ${cooperativaId}. Verifique clientId + clientSecret no ConfigGateway.`,
          retryable: response.status >= 500,
        });
      }

      const accessToken = response.data?.access_token as string | undefined;
      const expiresIn = Number(response.data?.expires_in ?? 3600);

      if (!accessToken) {
        throw new GatewayError({
          code: 'DESCONHECIDO',
          message: `Resposta OAuth Banestes sem access_token (cooperativa ${cooperativaId}).`,
          retryable: true,
        });
      }

      const ttlMs = expiresIn * 1000 - BanestesConfigService.TOKEN_REFRESH_MARGIN_MS;
      this.tokenCache.set(cooperativaId, {
        accessToken,
        expiresAt: Date.now() + Math.max(ttlMs, 60_000),
      });

      this.logger.log(
        `Banestes OAuth token renovado (cooperativa=${cooperativaId}, expira em ~${Math.round(
          ttlMs / 1000,
        )}s, ambiente=${config.ambiente})`,
      );

      return accessToken;
    } catch (err) {
      if (err instanceof GatewayError) throw err;

      const code = (err as { code?: string })?.code;
      if (code === 'ECONNREFUSED' || code === 'ENOTFOUND' || code === 'ETIMEDOUT') {
        throw new GatewayError({
          code: 'GATEWAY_INDISPONIVEL',
          message: `Banestes indisponivel (cooperativa ${cooperativaId}): ${(err as Error).message}`,
          retryable: true,
          originalError: err,
        });
      }

      throw new GatewayError({
        code: 'DESCONHECIDO',
        message: `Erro ao obter token OAuth Banestes (cooperativa ${cooperativaId}): ${(err as Error).message}`,
        retryable: false,
        originalError: err,
      });
    }
  }

  /**
   * Invalida o cache de token do tenant (forca refresh na proxima chamada).
   * Util pra testes ou quando recebemos 401 Bearer expirado.
   */
  invalidarTokenCache(cooperativaId: string): void {
    this.tokenCache.delete(cooperativaId);
  }

  /**
   * Limpa Agent + token de um tenant especifico. Util quando admin edita
   * credenciais via PATCH /gateways-pagamento/:id e precisamos invalidar
   * cache pra refletir mudancas imediatamente.
   */
  invalidarCacheTenant(cooperativaId: string): void {
    const agent = this.httpsAgentCache.get(cooperativaId);
    if (agent) {
      agent.destroy();
      this.httpsAgentCache.delete(cooperativaId);
    }
    this.tokenCache.delete(cooperativaId);
  }

  /**
   * Limpa todos os caches. Util pra testes que precisam recarregar config.
   */
  resetCache(): void {
    for (const agent of this.httpsAgentCache.values()) {
      agent.destroy();
    }
    this.httpsAgentCache.clear();
    this.tokenCache.clear();
  }

  onModuleDestroy(): void {
    this.resetCache();
  }
}
