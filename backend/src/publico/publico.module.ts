import { Module } from '@nestjs/common';
import { MulterModule } from '@nestjs/platform-express';
import { PublicoController } from './publico.controller';
import { PrismaService } from '../prisma.service';
import { WhatsappModule } from '../whatsapp/whatsapp.module';
import { CooperTokenModule } from '../cooper-token/cooper-token.module';
import { FaturasModule } from '../faturas/faturas.module';

const multerLib = require('multer') as { memoryStorage: () => object };

@Module({
  imports: [WhatsappModule, CooperTokenModule, FaturasModule, MulterModule.register({ storage: multerLib.memoryStorage() })],
  controllers: [PublicoController],
  providers: [PrismaService],
})
export class PublicoModule {}
