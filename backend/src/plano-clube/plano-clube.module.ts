/**
 * Sprint Onboarding Bloco 0 Fatia 0.1 (06/06/2026).
 *
 * Módulo PlanoClube. Exporta `PlanoClubeService` pra ser injetado em
 * Fatia 0.4 (cobrancas + convenios-custeio).
 */
import { Module } from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { PlanoClubeService } from './plano-clube.service';
import { PlanoClubeController } from './plano-clube.controller';

@Module({
  controllers: [PlanoClubeController],
  providers: [PlanoClubeService, PrismaService],
  exports: [PlanoClubeService],
})
export class PlanoClubeModule {}
