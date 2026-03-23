import { Module } from '@nestjs/common';
import { WhatsappFaturaController } from './whatsapp-fatura.controller';
import { WhatsappFaturaService } from './whatsapp-fatura.service';
import { WhatsappBotService } from './whatsapp-bot.service';
import { WhatsappSenderService } from './whatsapp-sender.service';
import { PrismaService } from '../prisma.service';
import { FaturasModule } from '../faturas/faturas.module';
import { MotorPropostaModule } from '../motor-proposta/motor-proposta.module';
import { ConfigTenantModule } from '../config-tenant/config-tenant.module';
import { IndicacoesModule } from '../indicacoes/indicacoes.module';

@Module({
  imports: [FaturasModule, MotorPropostaModule, ConfigTenantModule, IndicacoesModule],
  controllers: [WhatsappFaturaController],
  providers: [WhatsappFaturaService, WhatsappBotService, WhatsappSenderService, PrismaService],
  exports: [WhatsappSenderService, WhatsappBotService],
})
export class WhatsappModule {}
