import { Module, forwardRef } from '@nestjs/common';
import { WhatsappFaturaController } from './whatsapp-fatura.controller';
import { WhatsappFaturaService } from './whatsapp-fatura.service';
import { WhatsappBotService } from './whatsapp-bot.service';
import { WhatsappCobrancaService } from './whatsapp-cobranca.service';
import { WhatsappMlmService } from './whatsapp-mlm.service';
import { WhatsappSenderService } from './whatsapp-sender.service';
import { ModeloMensagemService } from './modelo-mensagem.service';
import { WhatsappFluxoMotorService } from './whatsapp-fluxo-motor.service';
import { WhatsappCicloVidaService } from './whatsapp-ciclo-vida.service';
import { WhatsappNotificacoesService } from './whatsapp-notificacoes.service';
import { PrismaService } from '../prisma.service';
import { FaturasModule } from '../faturas/faturas.module';
import { MotorPropostaModule } from '../motor-proposta/motor-proposta.module';
import { ConfigTenantModule } from '../config-tenant/config-tenant.module';
import { IndicacoesModule } from '../indicacoes/indicacoes.module';
import { AsaasModule } from '../asaas/asaas.module';
@Module({
  imports: [FaturasModule, MotorPropostaModule, ConfigTenantModule, forwardRef(() => IndicacoesModule), AsaasModule],
  controllers: [WhatsappFaturaController],
  providers: [
    WhatsappFaturaService,
    WhatsappBotService,
    WhatsappCobrancaService,
    WhatsappMlmService,
    WhatsappSenderService,
    ModeloMensagemService,
    WhatsappFluxoMotorService,
    WhatsappCicloVidaService,
    WhatsappNotificacoesService,
    PrismaService,
  ],
  exports: [WhatsappSenderService, WhatsappBotService, WhatsappCobrancaService, WhatsappMlmService, ModeloMensagemService, WhatsappFluxoMotorService, WhatsappCicloVidaService, WhatsappNotificacoesService],
})
export class WhatsappModule {}
