import { Module } from '@nestjs/common';
import { CobrancasController } from './cobrancas.controller';
import { CobrancasService } from './cobrancas.service';
import { CobrancasJob } from './cobrancas.job';
import { CobrancaPdfService } from './cobranca-pdf.service';
import { CalculoMultaJurosService } from './calculo-multa-juros.service';
import { PdfGeneratorService } from '../motor-proposta/pdf-generator.service';
import { PrismaService } from '../prisma.service';
import { GatewayPagamentoModule } from '../gateway-pagamento/gateway-pagamento.module';
import { ClubeVantagensModule } from '../clube-vantagens/clube-vantagens.module';
import { WhatsappModule } from '../whatsapp/whatsapp.module';
import { EmailModule } from '../email/email.module';
import { CooperTokenModule } from '../cooper-token/cooper-token.module';
import { FinanceiroModule } from '../financeiro/financeiro.module';
// Sprint Onboarding Bloco 0 Fatia 0.4 (06/06/2026)
import { CooperadoClubeModule } from '../cooperado-clube/cooperado-clube.module';

@Module({
  imports: [GatewayPagamentoModule, ClubeVantagensModule, WhatsappModule, EmailModule, CooperTokenModule, FinanceiroModule, CooperadoClubeModule],
  controllers: [CobrancasController],
  providers: [CobrancasService, CobrancasJob, CobrancaPdfService, CalculoMultaJurosService, PdfGeneratorService, PrismaService],
  exports: [CobrancasService, CalculoMultaJurosService],
})
export class CobrancasModule {}
