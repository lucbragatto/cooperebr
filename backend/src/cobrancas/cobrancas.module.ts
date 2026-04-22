import { Module } from '@nestjs/common';
import { CobrancasController } from './cobrancas.controller';
import { CobrancasService } from './cobrancas.service';
import { CobrancasJob } from './cobrancas.job';
import { CalculoMultaJurosService } from './calculo-multa-juros.service';
import { PrismaService } from '../prisma.service';
import { GatewayPagamentoModule } from '../gateway-pagamento/gateway-pagamento.module';
import { ClubeVantagensModule } from '../clube-vantagens/clube-vantagens.module';
import { WhatsappModule } from '../whatsapp/whatsapp.module';
import { EmailModule } from '../email/email.module';
import { CooperTokenModule } from '../cooper-token/cooper-token.module';
import { FinanceiroModule } from '../financeiro/financeiro.module';

@Module({
  imports: [GatewayPagamentoModule, ClubeVantagensModule, WhatsappModule, EmailModule, CooperTokenModule, FinanceiroModule],
  controllers: [CobrancasController],
  providers: [CobrancasService, CobrancasJob, CalculoMultaJurosService, PrismaService],
  exports: [CobrancasService, CalculoMultaJurosService],
})
export class CobrancasModule {}
