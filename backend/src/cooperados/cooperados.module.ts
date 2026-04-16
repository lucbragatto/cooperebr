import { Module, forwardRef } from '@nestjs/common';
import { MulterModule } from '@nestjs/platform-express';
import { CooperadosController } from './cooperados.controller';
import { CooperadosService } from './cooperados.service';
import { CooperadosJob } from './cooperados.job';
import { PrismaService } from '../prisma.service';
import { NotificacoesService } from '../notificacoes/notificacoes.service';
import { UsinasModule } from '../usinas/usinas.module';
import { UcsModule } from '../ucs/ucs.module';
import { WhatsappModule } from '../whatsapp/whatsapp.module';
import { EmailModule } from '../email/email.module';
import { FaturasModule } from '../faturas/faturas.module';
import { MotorPropostaModule } from '../motor-proposta/motor-proposta.module';

// eslint-disable-next-line @typescript-eslint/no-require-imports
const multerLib = require('multer') as { memoryStorage: () => object };

@Module({
  imports: [
    UsinasModule,
    UcsModule,
    WhatsappModule,
    EmailModule,
    FaturasModule,
    forwardRef(() => MotorPropostaModule),
    MulterModule.register({ storage: multerLib.memoryStorage() }),
  ],
  controllers: [CooperadosController],
  providers: [CooperadosService, CooperadosJob, PrismaService, NotificacoesService],
  exports: [CooperadosService],
})
export class CooperadosModule {}
