import { Module, forwardRef } from '@nestjs/common';
import { ConviteIndicacaoController } from './convite-indicacao.controller';
import { ConviteIndicacaoService } from './convite-indicacao.service';
import { ConviteIndicacaoJob } from './convite-indicacao.job';
import { PrismaService } from '../prisma.service';
import { WhatsappModule } from '../whatsapp/whatsapp.module';
// Fatia F-G1 (05/06/2026)
import { CooperadoInstitucionalService } from './cooperado-institucional.service';

@Module({
  imports: [forwardRef(() => WhatsappModule)],
  controllers: [ConviteIndicacaoController],
  providers: [
    ConviteIndicacaoService,
    ConviteIndicacaoJob,
    PrismaService,
    CooperadoInstitucionalService,
  ],
  exports: [ConviteIndicacaoService, CooperadoInstitucionalService],
})
export class ConviteIndicacaoModule {}
