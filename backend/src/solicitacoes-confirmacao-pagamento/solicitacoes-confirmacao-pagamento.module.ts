import { Module } from '@nestjs/common';
import { SolicitacoesConfirmacaoPagamentoController } from './solicitacoes-confirmacao-pagamento.controller';
import { SolicitacoesConfirmacaoPagamentoService } from './solicitacoes-confirmacao-pagamento.service';
import { PrismaService } from '../prisma.service';
import { WhatsappModule } from '../whatsapp/whatsapp.module';
import { NotificacoesModule } from '../notificacoes/notificacoes.module';

@Module({
  imports: [WhatsappModule, NotificacoesModule],
  controllers: [SolicitacoesConfirmacaoPagamentoController],
  providers: [SolicitacoesConfirmacaoPagamentoService, PrismaService],
  exports: [SolicitacoesConfirmacaoPagamentoService],
})
export class SolicitacoesConfirmacaoPagamentoModule {}
