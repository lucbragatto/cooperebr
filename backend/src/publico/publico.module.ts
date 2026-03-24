import { Module } from '@nestjs/common';
import { PublicoController } from './publico.controller';
import { PrismaService } from '../prisma.service';
import { WhatsappModule } from '../whatsapp/whatsapp.module';

@Module({
  imports: [WhatsappModule],
  controllers: [PublicoController],
  providers: [PrismaService],
})
export class PublicoModule {}
