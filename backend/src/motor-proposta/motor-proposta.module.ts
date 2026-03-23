import { Module } from '@nestjs/common';
import { MulterModule } from '@nestjs/platform-express';
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
import { WhatsappSenderService } from '../whatsapp/whatsapp-sender.service';

// eslint-disable-next-line @typescript-eslint/no-require-imports
const multerLib = require('multer') as { memoryStorage: () => object };

@Module({
  imports: [NotificacoesModule, CooperadosModule, ContratosModule, UsinasModule, ConfigTenantModule, MulterModule.register({ storage: multerLib.memoryStorage() })],
  controllers: [MotorPropostaController],
  providers: [MotorPropostaService, PropostaPdfService, PdfGeneratorService, WhatsappSenderService, PrismaService],
  exports: [MotorPropostaService],
})
export class MotorPropostaModule {}
