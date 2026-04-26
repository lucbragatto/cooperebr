import { Module } from '@nestjs/common';
import { EmailService } from './email.service';
import { EmailConfigService } from './email-config.service';
import { EmailRecebimentoService } from './email-recebimento.service';
import { EmailController } from './email.controller';
import { EmailConfigController } from './email-config.controller';
import { PrismaService } from '../prisma.service';
import { ConfigTenantModule } from '../config-tenant/config-tenant.module';

@Module({
  imports: [ConfigTenantModule],
  controllers: [EmailController, EmailConfigController],
  providers: [EmailService, EmailConfigService, EmailRecebimentoService, PrismaService],
  exports: [EmailService, EmailConfigService],
})
export class EmailModule {}
