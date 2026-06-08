import { Module } from '@nestjs/common';
import { CooperTokenController } from './cooper-token.controller';
import { ContabilidadeClubeController } from './contabilidade-clube.controller';
import { CooperTokenService } from './cooper-token.service';
import { CooperTokenJob } from './cooper-token.job';
import { PrismaService } from '../prisma.service';
// Sprint Token-WA Fase 2 F2.5 (07/06/2026) — limites 2 níveis cooperativa×cooperado.
import { LimiteTokenService } from './limite-token.service';

@Module({
  controllers: [CooperTokenController, ContabilidadeClubeController],
  providers: [CooperTokenService, CooperTokenJob, LimiteTokenService, PrismaService],
  exports: [CooperTokenService, LimiteTokenService],
})
export class CooperTokenModule {}
