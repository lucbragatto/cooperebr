import { Module, forwardRef } from '@nestjs/common';
import { MigracoesUsinaController } from './migracoes-usina.controller';
import { MigracoesUsinaService } from './migracoes-usina.service';
import { PrismaService } from '../prisma.service';
import { ContratosModule } from '../contratos/contratos.module';
import { UsinasModule } from '../usinas/usinas.module';
import { WhatsappModule } from '../whatsapp/whatsapp.module';

@Module({
  imports: [
    forwardRef(() => ContratosModule),
    UsinasModule,
    forwardRef(() => WhatsappModule),
  ],
  controllers: [MigracoesUsinaController],
  providers: [MigracoesUsinaService, PrismaService],
  exports: [MigracoesUsinaService],
})
export class MigracoesUsinaModule {}
