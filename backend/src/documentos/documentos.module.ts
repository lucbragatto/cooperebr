import { Module, forwardRef } from '@nestjs/common';
import { MulterModule } from '@nestjs/platform-express';
import { DocumentosController } from './documentos.controller';
import { DocumentosService } from './documentos.service';
import { DocumentosAprovacaoJob } from './documentos-aprovacao.job';
import { PrismaService } from '../prisma.service';
import { NotificacoesModule } from '../notificacoes/notificacoes.module';
import { CooperadosModule } from '../cooperados/cooperados.module';
import { WhatsappModule } from '../whatsapp/whatsapp.module';
import { ConfigTenantModule } from '../config-tenant/config-tenant.module';
import { MotorPropostaModule } from '../motor-proposta/motor-proposta.module';

// eslint-disable-next-line @typescript-eslint/no-require-imports
const multerLib = require('multer') as { memoryStorage: () => object };

@Module({
  imports: [
    NotificacoesModule,
    CooperadosModule,
    WhatsappModule,
    ConfigTenantModule,
    forwardRef(() => MotorPropostaModule),
    MulterModule.register({ storage: multerLib.memoryStorage() }),
  ],
  controllers: [DocumentosController],
  providers: [DocumentosService, DocumentosAprovacaoJob, PrismaService],
})
export class DocumentosModule {}
