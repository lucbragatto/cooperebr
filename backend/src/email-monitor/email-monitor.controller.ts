import { Controller, Post, Get, Req, BadRequestException } from '@nestjs/common';
import { EmailMonitorService } from './email-monitor.service';
import { Roles } from '../auth/roles.decorator';
import { PerfilUsuario } from '../auth/perfil.enum';

@Controller('email-monitor')
@Roles(PerfilUsuario.SUPER_ADMIN, PerfilUsuario.ADMIN)
export class EmailMonitorController {
  constructor(private readonly emailMonitorService: EmailMonitorService) {}

  /**
   * POST /email-monitor/processar
   * Disparo manual da verificação de e-mails com faturas concessionária.
   *
   * D-novo-BR F1.5 M8 (31/05/2026) — cooperativaId obrigatório. Sem isso,
   * SUPER_ADMIN sem cooperativaId vinculado fazia fallback pra ENV global,
   * vazando credencial IMAP "padrão" entre tenants.
   */
  @Post('processar')
  processar(@Req() req: any) {
    const cooperativaId = req.user?.cooperativaId;
    if (!cooperativaId) {
      throw new BadRequestException(
        'cooperativaId obrigatório pra disparar monitor de e-mail manualmente. ' +
          'SUPER_ADMIN sem tenant vinculado: use impersonate ou cadastre vínculo.',
      );
    }
    return this.emailMonitorService.processarManual(cooperativaId);
  }

  /**
   * GET /email-monitor/status
   * Retorna status da configuração do monitor de e-mails.
   * Verifica banco (ConfigTenant) e fallback para ENV.
   */
  @Get('status')
  async status(@Req() req: any) {
    const cooperativaId = req.user?.cooperativaId;
    let imapUser: string | null = null;
    let imapHost = 'imap.gmail.com';
    let fonte = 'nenhuma';

    // Tentar banco primeiro
    if (cooperativaId) {
      const dbUser = await this.emailMonitorService.getConfigValue('email.monitor.user', cooperativaId);
      if (dbUser) {
        imapUser = dbUser.replace(/(.{3}).*(@.*)/, '$1***$2');
        const dbHost = await this.emailMonitorService.getConfigValue('email.monitor.host', cooperativaId);
        if (dbHost) imapHost = dbHost;
        fonte = 'banco';
      }
    }

    // Fallback ENV
    if (!imapUser && process.env.EMAIL_IMAP_USER) {
      imapUser = process.env.EMAIL_IMAP_USER.replace(/(.{3}).*(@.*)/, '$1***$2');
      imapHost = process.env.EMAIL_IMAP_HOST || 'imap.gmail.com';
      fonte = 'env';
    }

    return {
      imapConfigurado: !!imapUser,
      imapHost,
      imapUser,
      fonte,
      intervalo: '30 minutos',
    };
  }
}
