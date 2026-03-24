import { Module } from '@nestjs/common';
import { ModelosMensagemController } from './modelos-mensagem.controller';
import { ModelosMensagemService } from './modelos-mensagem.service';
import { PrismaService } from '../prisma.service';
import { WhatsappSenderService } from '../whatsapp/whatsapp-sender.service';

@Module({
  controllers: [ModelosMensagemController],
  providers: [ModelosMensagemService, PrismaService, WhatsappSenderService],
  exports: [ModelosMensagemService],
})
export class ModelosMensagemModule {}
