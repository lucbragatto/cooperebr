import { Module } from '@nestjs/common';
import { MulterModule } from '@nestjs/platform-express';
import { DocumentosController } from './documentos.controller';
import { DocumentosService } from './documentos.service';
import { PrismaService } from '../prisma.service';
import { NotificacoesModule } from '../notificacoes/notificacoes.module';
import { CooperadosModule } from '../cooperados/cooperados.module';
import { WhatsappModule } from '../whatsapp/whatsapp.module';

// eslint-disable-next-line @typescript-eslint/no-require-imports
const multerLib = require('multer') as { memoryStorage: () => object };

@Module({
  imports: [
    NotificacoesModule,
    CooperadosModule,
    WhatsappModule,
    MulterModule.register({ storage: multerLib.memoryStorage() }),
  ],
  controllers: [DocumentosController],
  providers: [DocumentosService, PrismaService],
})
export class DocumentosModule {}
