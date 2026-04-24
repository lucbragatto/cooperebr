import { Module, forwardRef } from '@nestjs/common';
import { MulterModule } from '@nestjs/platform-express';
import { MotorPropostaController } from './motor-proposta.controller';
import { MotorPropostaService } from './motor-proposta.service';
import { MotorPropostaJob } from './motor-proposta.job';
import { PropostaPdfService } from './proposta-pdf.service';
import { PdfGeneratorService } from './pdf-generator.service';
import { PrismaService } from '../prisma.service';
import { NotificacoesModule } from '../notificacoes/notificacoes.module';
import { CooperadosModule } from '../cooperados/cooperados.module';
import { ContratosModule } from '../contratos/contratos.module';
import { UsinasModule } from '../usinas/usinas.module';
import { ConfigTenantModule } from '../config-tenant/config-tenant.module';
import { EmailModule } from '../email/email.module';
import { WhatsappSenderService } from '../whatsapp/whatsapp-sender.service';

// eslint-disable-next-line @typescript-eslint/no-require-imports
const multerLib = require('multer') as { memoryStorage: () => object };

@Module({
  imports: [NotificacoesModule, forwardRef(() => CooperadosModule), forwardRef(() => ContratosModule), UsinasModule, ConfigTenantModule, EmailModule, MulterModule.register({ storage: multerLib.memoryStorage() })],
  controllers: [MotorPropostaController],
  providers: [MotorPropostaService, MotorPropostaJob, PropostaPdfService, PdfGeneratorService, WhatsappSenderService, PrismaService],
  exports: [MotorPropostaService],
})
export class MotorPropostaModule {}
