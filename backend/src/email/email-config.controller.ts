import {
  Controller, Get, Put, Post, Body, Req, ForbiddenException, BadRequestException, Logger,
} from '@nestjs/common';
import { ImapFlow } from 'imapflow';
import { Roles } from '../auth/roles.decorator';
import { PerfilUsuario } from '../auth/perfil.enum';
import { EmailConfigService } from './email-config.service';
import { EmailService } from './email.service';

interface SmtpDto {
  host?: string;
  port?: number | string;
  secure?: boolean | string;
  user?: string;
  pass?: string;          // string vazia = manter atual
  from?: string;
}

interface ImapDto {
  host?: string;
  port?: number | string;
  user?: string;
  pass?: string;          // string vazia = manter atual
  ativo?: boolean | string;
}

@Controller('configuracoes/email')
export class EmailConfigController {
  private readonly logger = new Logger(EmailConfigController.name);

  constructor(
    private emailConfig: EmailConfigService,
    private emailService: EmailService,
  ) {}

  /**
   * GET /configuracoes/email
   * Retorna configs SMTP+IMAP do tenant atual, sem expor senhas.
   * Indica fonte (tenant/env) e se senha está definida (passDefinida).
   */
  @Roles(PerfilUsuario.SUPER_ADMIN, PerfilUsuario.ADMIN)
  @Get()
  async get(@Req() req: any) {
    const cooperativaId: string | undefined = req.user?.cooperativaId;
    if (!cooperativaId) throw new ForbiddenException('Admin sem cooperativa associada');
    return this.emailConfig.getConfigSeguro(cooperativaId);
  }

  /**
   * PUT /configuracoes/email/smtp
   * Atualiza configs SMTP. Senha vazia = mantém atual. Invalida cache do
   * transporter pra próximo envio usar a config nova.
   */
  @Roles(PerfilUsuario.SUPER_ADMIN, PerfilUsuario.ADMIN)
  @Put('smtp')
  async putSmtp(@Req() req: any, @Body() body: SmtpDto) {
    const cooperativaId: string | undefined = req.user?.cooperativaId;
    if (!cooperativaId) throw new ForbiddenException('Admin sem cooperativa associada');
    this.validarSmtpInput(body);
    await this.emailConfig.setSmtpConfig(cooperativaId, body);
    this.emailService.invalidateTransporterCache(cooperativaId);
    this.logger.log(`Config SMTP atualizada [coop=${cooperativaId}]`);
    return this.emailConfig.getConfigSeguro(cooperativaId);
  }

  /**
   * PUT /configuracoes/email/imap
   * Atualiza configs IMAP do monitor de faturas EDP.
   */
  @Roles(PerfilUsuario.SUPER_ADMIN, PerfilUsuario.ADMIN)
  @Put('imap')
  async putImap(@Req() req: any, @Body() body: ImapDto) {
    const cooperativaId: string | undefined = req.user?.cooperativaId;
    if (!cooperativaId) throw new ForbiddenException('Admin sem cooperativa associada');
    this.validarImapInput(body);
    await this.emailConfig.setImapConfig(cooperativaId, body);
    this.logger.log(`Config IMAP atualizada [coop=${cooperativaId}]`);
    return this.emailConfig.getConfigSeguro(cooperativaId);
  }

  /**
   * POST /configuracoes/email/testar-smtp
   * Envia email de teste pro próprio admin (req.user.email) usando a config
   * SMTP do tenant. Permite validar credenciais antes de operação real.
   */
  @Roles(PerfilUsuario.SUPER_ADMIN, PerfilUsuario.ADMIN)
  @Post('testar-smtp')
  async testarSmtp(@Req() req: any, @Body() body?: { destino?: string }) {
    const cooperativaId: string | undefined = req.user?.cooperativaId;
    if (!cooperativaId) throw new ForbiddenException('Admin sem cooperativa associada');

    const destino = body?.destino || req.user?.email;
    if (!destino) {
      throw new BadRequestException('Sem destino — informe `destino` no body ou tenha email no usuário');
    }

    // Garantir que próximo envio usa config atual do tenant (não cache antigo)
    this.emailService.invalidateTransporterCache(cooperativaId);
    const ok = await this.emailService.enviarTeste(destino, cooperativaId);
    return {
      sucesso: ok,
      destino,
      cooperativaId,
      observacao: ok
        ? 'Email enviado. Verifique a caixa de entrada (e spam) em ~30s.'
        : 'Falha — verifique logs do backend (pm2 logs cooperebr-backend).',
    };
  }

  /**
   * POST /configuracoes/email/testar-imap
   * Conecta no IMAP usando configs do tenant e retorna pastas + total INBOX.
   * Não baixa nem move nada.
   */
  @Roles(PerfilUsuario.SUPER_ADMIN, PerfilUsuario.ADMIN)
  @Post('testar-imap')
  async testarImap(@Req() req: any) {
    const cooperativaId: string | undefined = req.user?.cooperativaId;
    if (!cooperativaId) throw new ForbiddenException('Admin sem cooperativa associada');

    const cfg = await this.emailConfig.getImapConfig(cooperativaId);
    if (!cfg.user || !cfg.pass) {
      throw new BadRequestException('IMAP não configurado (user e/ou pass ausentes)');
    }

    const client = new ImapFlow({
      host: cfg.host,
      port: cfg.port,
      secure: true,
      auth: { user: cfg.user, pass: cfg.pass },
      tls: { rejectUnauthorized: false },
      logger: false,
    });

    try {
      await client.connect();
      const mailboxes = await client.list();
      const lock = await client.getMailboxLock('INBOX', { readOnly: true });
      let totalInbox = 0;
      try {
        const status = await client.status('INBOX', { messages: true });
        totalInbox = status.messages ?? 0;
      } finally {
        lock.release();
      }
      await client.logout();
      return {
        sucesso: true,
        cooperativaId,
        host: cfg.host,
        port: cfg.port,
        user: cfg.user,
        fonte: cfg.fonte,
        totalPastas: mailboxes.length,
        pastas: mailboxes.slice(0, 20).map((m) => m.path),
        totalMensagensInbox: totalInbox,
      };
    } catch (err: any) {
      this.logger.warn(`Falha teste IMAP [coop=${cooperativaId}]: ${err.message}`);
      return {
        sucesso: false,
        cooperativaId,
        host: cfg.host,
        user: cfg.user,
        fonte: cfg.fonte,
        erro: err.message,
      };
    }
  }

  // ── Validações de input ─────────────────────────────────────────────────

  private validarSmtpInput(body: SmtpDto) {
    if (body.host !== undefined && typeof body.host !== 'string') {
      throw new BadRequestException('host deve ser string');
    }
    if (body.port !== undefined) {
      const p = Number(body.port);
      if (!Number.isInteger(p) || p <= 0 || p > 65535) {
        throw new BadRequestException('port deve ser inteiro entre 1 e 65535');
      }
    }
    if (body.user !== undefined && typeof body.user === 'string' && body.user.length > 0) {
      // Validação leve de email — admin pode usar formatos não-padrão
      if (body.user.length > 200) throw new BadRequestException('user muito longo');
    }
    if (body.from !== undefined && typeof body.from === 'string' && body.from.length > 200) {
      throw new BadRequestException('from muito longo');
    }
  }

  private validarImapInput(body: ImapDto) {
    if (body.host !== undefined && typeof body.host !== 'string') {
      throw new BadRequestException('host deve ser string');
    }
    if (body.port !== undefined) {
      const p = Number(body.port);
      if (!Number.isInteger(p) || p <= 0 || p > 65535) {
        throw new BadRequestException('port deve ser inteiro entre 1 e 65535');
      }
    }
  }
}
