import { Module, forwardRef } from '@nestjs/common';
import { ConviteIndicacaoController } from './convite-indicacao.controller';
import { ConviteIndicacaoService } from './convite-indicacao.service';
import { ConviteIndicacaoJob } from './convite-indicacao.job';
import { PrismaService } from '../prisma.service';
import { WhatsappModule } from '../whatsapp/whatsapp.module';

@Module({
  imports: [forwardRef(() => WhatsappModule)],
  controllers: [ConviteIndicacaoController],
  providers: [ConviteIndicacaoService, ConviteIndicacaoJob, PrismaService],
  exports: [ConviteIndicacaoService],
})
export class ConviteIndicacaoModule {}
