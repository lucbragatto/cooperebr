import { Module } from '@nestjs/common';
import { NotificacoesProativasService } from './notificacoes-proativas.service';
import { NotificacoesProativasJob } from './notificacoes-proativas.job';
import { PrismaService } from '../prisma.service';
import { ConfigTenantModule } from '../config-tenant/config-tenant.module';
import { EmailModule } from '../email/email.module';
import { WhatsappModule } from '../whatsapp/whatsapp.module';

@Module({
  imports: [ConfigTenantModule, EmailModule, WhatsappModule],
  providers: [NotificacoesProativasService, NotificacoesProativasJob, PrismaService],
  exports: [NotificacoesProativasService],
})
export class NotificacoesProativasModule {}
