import { Module, forwardRef } from '@nestjs/common';
import { MulterModule } from '@nestjs/platform-express';
import { PublicoController } from './publico.controller';
import { PrismaService } from '../prisma.service';
import { WhatsappModule } from '../whatsapp/whatsapp.module';
import { CooperTokenModule } from '../cooper-token/cooper-token.module';
import { FaturasModule } from '../faturas/faturas.module';
import { CooperadosModule } from '../cooperados/cooperados.module';
import { UcsModule } from '../ucs/ucs.module';
import { MotorPropostaModule } from '../motor-proposta/motor-proposta.module';
import { IndicacoesModule } from '../indicacoes/indicacoes.module';
import { ConveniosModule } from '../convenios/convenios.module';

const multerLib = require('multer') as { memoryStorage: () => object };

@Module({
  imports: [
    WhatsappModule,
    CooperTokenModule,
    FaturasModule,
    forwardRef(() => CooperadosModule),
    UcsModule,
    forwardRef(() => MotorPropostaModule),
    IndicacoesModule,
    ConveniosModule,
    MulterModule.register({ storage: multerLib.memoryStorage() }),
  ],
  controllers: [PublicoController],
  providers: [PrismaService],
})
export class PublicoModule {}
