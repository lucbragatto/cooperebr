import { Module } from '@nestjs/common';
import { WhatsappFaturaController } from './whatsapp-fatura.controller';
import { WhatsappFaturaService } from './whatsapp-fatura.service';
import { PrismaService } from '../prisma.service';
import { FaturasModule } from '../faturas/faturas.module';
import { MotorPropostaModule } from '../motor-proposta/motor-proposta.module';
import { ConfigTenantModule } from '../config-tenant/config-tenant.module';

@Module({
  imports: [FaturasModule, MotorPropostaModule, ConfigTenantModule],
  controllers: [WhatsappFaturaController],
  providers: [WhatsappFaturaService, PrismaService],
})
export class WhatsappModule {}
