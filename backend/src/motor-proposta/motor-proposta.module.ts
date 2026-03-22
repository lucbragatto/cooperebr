import { Module } from '@nestjs/common';
import { MotorPropostaController } from './motor-proposta.controller';
import { MotorPropostaService } from './motor-proposta.service';
import { PropostaPdfService } from './proposta-pdf.service';
import { PdfGeneratorService } from './pdf-generator.service';
import { PrismaService } from '../prisma.service';
import { NotificacoesModule } from '../notificacoes/notificacoes.module';
import { CooperadosModule } from '../cooperados/cooperados.module';
import { ContratosModule } from '../contratos/contratos.module';
import { UsinasModule } from '../usinas/usinas.module';
import { ConfigTenantModule } from '../config-tenant/config-tenant.module';

@Module({
  imports: [NotificacoesModule, CooperadosModule, ContratosModule, UsinasModule, ConfigTenantModule],
  controllers: [MotorPropostaController],
  providers: [MotorPropostaService, PropostaPdfService, PdfGeneratorService, PrismaService],
  exports: [MotorPropostaService],
})
export class MotorPropostaModule {}
