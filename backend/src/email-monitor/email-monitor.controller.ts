import { Controller, Post, Get, Req } from '@nestjs/common';
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
   */
  @Post('processar')
  processar() {
    return this.emailMonitorService.processarManual();
  }

  /**
   * GET /email-monitor/status
   * Retorna status da configuração do monitor de e-mails.
   */
  @Get('status')
  status() {
    return {
      imapConfigurado: !!process.env.IMAP_USER,
      imapHost: process.env.IMAP_HOST || 'imap.gmail.com',
      imapUser: process.env.IMAP_USER
        ? process.env.IMAP_USER.replace(/(.{3}).*(@.*)/, '$1***$2')
        : null,
      intervalo: '30 minutos',
    };
  }
}
