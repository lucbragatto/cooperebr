import { Module } from '@nestjs/common';
import { SolicitacoesContratoController } from './solicitacoes-contrato.controller';
import { SolicitacoesContratoService } from './solicitacoes-contrato.service';
import { PrismaService } from '../prisma.service';
import { ContratosModule } from '../contratos/contratos.module';
import { WhatsappModule } from '../whatsapp/whatsapp.module';
import { NotificacoesModule } from '../notificacoes/notificacoes.module';

@Module({
  imports: [ContratosModule, WhatsappModule, NotificacoesModule],
  controllers: [SolicitacoesContratoController],
  providers: [SolicitacoesContratoService, PrismaService],
  exports: [SolicitacoesContratoService],
})
export class SolicitacoesContratoModule {}
