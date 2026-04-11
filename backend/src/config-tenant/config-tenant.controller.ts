import { Controller, Get, Put, Post, Delete, Param, Body, Req } from '@nestjs/common';
import { ConfigTenantService } from './config-tenant.service';
import { Roles } from '../auth/roles.decorator';
import { PerfilUsuario } from '../auth/perfil.enum';
import { ImapFlow } from 'imapflow';

const { SUPER_ADMIN, ADMIN } = PerfilUsuario;

const EMAIL_MONITOR_KEYS = [
  'email.monitor.host',
  'email.monitor.port',
  'email.monitor.user',
  'email.monitor.pass',
  'email.monitor.ativo',
] as const;

@Controller('config-tenant')
export class ConfigTenantController {
  constructor(private readonly service: ConfigTenantService) {}

  @Roles(SUPER_ADMIN, ADMIN)
  @Get()
  findAll(@Req() req: any) {
    return this.service.findAll(req.user.cooperativaId);
  }

  @Roles(SUPER_ADMIN, ADMIN)
  @Get(':chave')
  get(@Param('chave') chave: string, @Req() req: any) {
    return this.service.get(chave, req.user.cooperativaId);
  }

  @Roles(SUPER_ADMIN, ADMIN)
  @Put(':chave')
  set(
    @Param('chave') chave: string,
    @Body() body: { valor: string; descricao?: string },
    @Req() req: any,
  ) {
    return this.service.set(chave, body.valor, req.user.cooperativaId, body.descricao);
  }

  @Roles(SUPER_ADMIN, ADMIN)
  @Delete(':chave')
  remove(@Param('chave') chave: string, @Req() req: any) {
    return this.service.remove(chave, req.user.cooperativaId);
  }

  // ── Email Monitor Config ──────────────────────────────────────────

  @Roles(SUPER_ADMIN, ADMIN)
  @Get('email-monitor/config')
  async getEmailMonitorConfig(@Req() req: any) {
    const cooperativaId = req.user.cooperativaId;
    const result: Record<string, string | null> = {};

    for (const chave of EMAIL_MONITOR_KEYS) {
      result[chave] = await this.service.get(chave, cooperativaId);
    }

    // Mascarar a senha — retornar apenas indicador de que está definida
    const senhaDefinida = !!result['email.monitor.pass'];
    return {
      host: result['email.monitor.host'] || 'imap.gmail.com',
      port: result['email.monitor.port'] || '993',
      user: result['email.monitor.user'] || '',
      senhaDefinida,
      ativo: result['email.monitor.ativo'] === 'true',
    };
  }

  @Roles(SUPER_ADMIN, ADMIN)
  @Put('email-monitor/config')
  async setEmailMonitorConfig(
    @Body() body: { host?: string; port?: string; user?: string; pass?: string; ativo?: boolean },
    @Req() req: any,
  ) {
    const cooperativaId = req.user.cooperativaId;

    if (body.host !== undefined) {
      await this.service.set('email.monitor.host', body.host, cooperativaId, 'Servidor IMAP');
    }
    if (body.port !== undefined) {
      await this.service.set('email.monitor.port', body.port, cooperativaId, 'Porta IMAP');
    }
    if (body.user !== undefined) {
      await this.service.set('email.monitor.user', body.user, cooperativaId, 'Usuário IMAP');
    }
    if (body.pass !== undefined && body.pass !== '') {
      const encoded = Buffer.from(body.pass).toString('base64');
      await this.service.set('email.monitor.pass', encoded, cooperativaId, 'Senha IMAP (base64)');
    }
    if (body.ativo !== undefined) {
      await this.service.set('email.monitor.ativo', String(body.ativo), cooperativaId, 'Monitor ativo');
    }

    return { message: 'Configuração de e-mail salva com sucesso' };
  }

  @Roles(SUPER_ADMIN, ADMIN)
  @Post('email-monitor/testar')
  async testarEmailMonitor(
    @Body() body: { host?: string; port?: string; user?: string; pass?: string },
    @Req() req: any,
  ) {
    const cooperativaId = req.user.cooperativaId;

    // Usar dados do body (formulário) ou fallback para banco
    const host = body.host || await this.service.get('email.monitor.host', cooperativaId) || 'imap.gmail.com';
    const port = Number(body.port || await this.service.get('email.monitor.port', cooperativaId) || '993');
    const user = body.user || await this.service.get('email.monitor.user', cooperativaId) || '';

    let pass = body.pass || '';
    if (!pass) {
      const encoded = await this.service.get('email.monitor.pass', cooperativaId);
      if (encoded) {
        pass = Buffer.from(encoded, 'base64').toString('utf-8');
      }
    }

    if (!user || !pass) {
      return { sucesso: false, erro: 'Usuário e senha IMAP são obrigatórios' };
    }

    const client = new ImapFlow({
      host,
      port,
      secure: true,
      auth: { user, pass },
      logger: false,
    });

    try {
      await client.connect();
      const mailbox = await client.mailboxOpen('INBOX');
      const totalEmails = mailbox.exists || 0;
      await client.logout();
      return { sucesso: true, mensagem: `Conexão OK — ${totalEmails} e-mails na caixa de entrada` };
    } catch (err) {
      return { sucesso: false, erro: (err as Error).message };
    }
  }
}
