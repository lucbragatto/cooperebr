import { Module } from '@nestjs/common';
import { PublicoController } from './publico.controller';
import { PrismaService } from '../prisma.service';
import { WhatsappModule } from '../whatsapp/whatsapp.module';
import { CooperTokenModule } from '../cooper-token/cooper-token.module';

@Module({
  imports: [WhatsappModule, CooperTokenModule],
  controllers: [PublicoController],
  providers: [PrismaService],
})
export class PublicoModule {}
