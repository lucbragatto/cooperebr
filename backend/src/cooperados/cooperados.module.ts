import { Module } from '@nestjs/common';
import { MulterModule } from '@nestjs/platform-express';
import { CooperadosController } from './cooperados.controller';
import { CooperadosService } from './cooperados.service';
import { PrismaService } from '../prisma.service';
import { NotificacoesService } from '../notificacoes/notificacoes.service';
import { UsinasModule } from '../usinas/usinas.module';

// eslint-disable-next-line @typescript-eslint/no-require-imports
const multerLib = require('multer') as { memoryStorage: () => object };

@Module({
  imports: [UsinasModule, MulterModule.register({ storage: multerLib.memoryStorage() })],
  controllers: [CooperadosController],
  providers: [CooperadosService, PrismaService, NotificacoesService],
  exports: [CooperadosService],
})
export class CooperadosModule {}
