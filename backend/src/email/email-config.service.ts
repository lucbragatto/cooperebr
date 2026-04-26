import { Injectable, Logger } from '@nestjs/common';
import { ConfigTenantService } from '../config-tenant/config-tenant.service';

/**
 * Configuração SMTP (envio) por tenant.
 * Sprint 11 — multi-parceiro: cada cooperativa pode ter seu próprio servidor.
 * Senha armazenada em base64 no banco (mesma convenção do email.monitor.pass).
 */
export interface SmtpConfig {
  host: string;
  port: number;
  secure: boolean;
  user: string;
  pass: string;
  from: string;
  fonte: 'tenant' | 'env' | 'default';
}

/**
 * Configuração IMAP (recebimento) por tenant. Usada pelo email-monitor.service
 * pra varrer faturas EDP. Mantém compatibilidade com chaves email.monitor.* já
 * existentes (CoopereVerde + agora CoopereBR).
 */
export interface ImapConfig {
  host: string;
  port: number;
  user: string;
  pass: string;
  ativo: boolean;
  fonte: 'tenant' | 'env' | 'default';
}

const ENV_FALLBACK_SMTP = {
  host: () => process.env.EMAIL_HOST || 'smtp.gmail.com',
  port: () => Number(process.env.EMAIL_PORT) || 465,
  secure: () => process.env.EMAIL_SECURE === 'true' || (Number(process.env.EMAIL_PORT) || 465) === 465,
  user: () => process.env.EMAIL_USER || '',
  pass: () => process.env.EMAIL_PASS || '',
  from: () => process.env.EMAIL_FROM || 'CoopereBR <contato@cooperebr.com.br>',
};

const ENV_FALLBACK_IMAP = {
  host: () => process.env.EMAIL_IMAP_HOST || 'imap.gmail.com',
  port: () => Number(process.env.EMAIL_IMAP_PORT) || 993,
  user: () => process.env.EMAIL_IMAP_USER || '',
  pass: () => process.env.EMAIL_IMAP_PASS || '',
  ativo: () => process.env.EMAIL_IMAP_ATIVO === 'true',
};

function tryDecodeBase64(value: string): string {
  if (!value) return '';
  // Heurística: base64 só contém A-Z a-z 0-9 + / =, e tamanho múltiplo de 4
  if (!/^[A-Za-z0-9+/]+=*$/.test(value) || value.length % 4 !== 0) return value;
  try {
    const decoded = Buffer.from(value, 'base64').toString('utf-8');
    // Se decoded contém só ASCII printável, assume base64 válido
    if (/^[\x20-\x7E]*$/.test(decoded) && decoded.length > 0) return decoded;
  } catch {
    /* not base64 */
  }
  return value;
}

@Injectable()
export class EmailConfigService {
  private readonly logger = new Logger(EmailConfigService.name);

  constructor(private configTenant: ConfigTenantService) {}

  /**
   * Resolve config SMTP do tenant. Sem cooperativaId, usa só .env (envio
   * "global" do sistema, ex: emails de sistema sem destinatário cooperativa).
   * Se cooperativaId vier mas não tiver chaves email.smtp.* no banco, faz
   * fallback campo a campo pro .env (logado em "fonte").
   */
  async getSmtpConfig(cooperativaId?: string | null): Promise<SmtpConfig> {
    if (!cooperativaId) {
      return this.buildFromEnv('env');
    }

    const [host, port, secure, user, passRaw, from] = await Promise.all([
      this.configTenant.get('email.smtp.host', cooperativaId),
      this.configTenant.get('email.smtp.port', cooperativaId),
      this.configTenant.get('email.smtp.secure', cooperativaId),
      this.configTenant.get('email.smtp.user', cooperativaId),
      this.configTenant.get('email.smtp.pass', cooperativaId),
      this.configTenant.get('email.smtp.from', cooperativaId),
    ]);

    // Se tenant tem ao menos host+user+pass, usa tenant; senão fallback
    const tenantTemConfig = !!(host && user && passRaw);
    if (!tenantTemConfig) {
      return this.buildFromEnv('env');
    }

    const portNum = Number(port) || 465;
    return {
      host: host!,
      port: portNum,
      secure: secure === 'true' || portNum === 465,
      user: user!,
      pass: tryDecodeBase64(passRaw!),
      from: from || ENV_FALLBACK_SMTP.from(),
      fonte: 'tenant',
    };
  }

  async getImapConfig(cooperativaId?: string | null): Promise<ImapConfig> {
    if (!cooperativaId) {
      return this.buildImapFromEnv('env');
    }

    const [host, port, user, passRaw, ativo] = await Promise.all([
      this.configTenant.get('email.monitor.host', cooperativaId),
      this.configTenant.get('email.monitor.port', cooperativaId),
      this.configTenant.get('email.monitor.user', cooperativaId),
      this.configTenant.get('email.monitor.pass', cooperativaId),
      this.configTenant.get('email.monitor.ativo', cooperativaId),
    ]);

    const tenantTemConfig = !!(host && user && passRaw);
    if (!tenantTemConfig) {
      return this.buildImapFromEnv('env');
    }

    return {
      host: host!,
      port: Number(port) || 993,
      user: user!,
      pass: tryDecodeBase64(passRaw!),
      ativo: ativo === 'true',
      fonte: 'tenant',
    };
  }

  /**
   * Salva config SMTP do tenant. Senha é armazenada em base64.
   * Passar pass = '' mantém a senha atual (não sobrescreve).
   */
  async setSmtpConfig(cooperativaId: string, dto: {
    host?: string; port?: number | string; secure?: boolean | string;
    user?: string; pass?: string; from?: string;
  }) {
    const ops: Promise<unknown>[] = [];
    if (dto.host !== undefined) ops.push(this.configTenant.set('email.smtp.host', String(dto.host), cooperativaId));
    if (dto.port !== undefined) ops.push(this.configTenant.set('email.smtp.port', String(dto.port), cooperativaId));
    if (dto.secure !== undefined) ops.push(this.configTenant.set('email.smtp.secure', String(dto.secure), cooperativaId));
    if (dto.user !== undefined) ops.push(this.configTenant.set('email.smtp.user', String(dto.user), cooperativaId));
    if (dto.from !== undefined) ops.push(this.configTenant.set('email.smtp.from', String(dto.from), cooperativaId));
    if (dto.pass !== undefined && dto.pass !== '') {
      const passB64 = Buffer.from(String(dto.pass), 'utf-8').toString('base64');
      ops.push(this.configTenant.set('email.smtp.pass', passB64, cooperativaId));
    }
    await Promise.all(ops);
  }

  async setImapConfig(cooperativaId: string, dto: {
    host?: string; port?: number | string;
    user?: string; pass?: string; ativo?: boolean | string;
  }) {
    const ops: Promise<unknown>[] = [];
    if (dto.host !== undefined) ops.push(this.configTenant.set('email.monitor.host', String(dto.host), cooperativaId));
    if (dto.port !== undefined) ops.push(this.configTenant.set('email.monitor.port', String(dto.port), cooperativaId));
    if (dto.user !== undefined) ops.push(this.configTenant.set('email.monitor.user', String(dto.user), cooperativaId));
    if (dto.ativo !== undefined) ops.push(this.configTenant.set('email.monitor.ativo', String(dto.ativo), cooperativaId));
    if (dto.pass !== undefined && dto.pass !== '') {
      const passB64 = Buffer.from(String(dto.pass), 'utf-8').toString('base64');
      ops.push(this.configTenant.set('email.monitor.pass', passB64, cooperativaId));
    }
  }

  /**
   * Visão "segura" pra retornar ao frontend (sem senhas).
   */
  async getConfigSeguro(cooperativaId: string): Promise<{
    smtp: Omit<SmtpConfig, 'pass'> & { passDefinida: boolean };
    imap: Omit<ImapConfig, 'pass'> & { passDefinida: boolean };
  }> {
    const [smtp, imap] = await Promise.all([
      this.getSmtpConfig(cooperativaId),
      this.getImapConfig(cooperativaId),
    ]);
    const { pass: smtpPass, ...smtpRest } = smtp;
    const { pass: imapPass, ...imapRest } = imap;
    return {
      smtp: { ...smtpRest, passDefinida: !!smtpPass },
      imap: { ...imapRest, passDefinida: !!imapPass },
    };
  }

  private buildFromEnv(fonte: 'env' | 'default'): SmtpConfig {
    return {
      host: ENV_FALLBACK_SMTP.host(),
      port: ENV_FALLBACK_SMTP.port(),
      secure: ENV_FALLBACK_SMTP.secure(),
      user: ENV_FALLBACK_SMTP.user(),
      pass: ENV_FALLBACK_SMTP.pass(),
      from: ENV_FALLBACK_SMTP.from(),
      fonte,
    };
  }

  private buildImapFromEnv(fonte: 'env' | 'default'): ImapConfig {
    return {
      host: ENV_FALLBACK_IMAP.host(),
      port: ENV_FALLBACK_IMAP.port(),
      user: ENV_FALLBACK_IMAP.user(),
      pass: ENV_FALLBACK_IMAP.pass(),
      ativo: ENV_FALLBACK_IMAP.ativo(),
      fonte,
    };
  }
}
