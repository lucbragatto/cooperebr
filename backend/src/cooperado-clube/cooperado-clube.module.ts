/**
 * Sprint Onboarding Bloco 0 Fatia 0.3 (06/06/2026).
 *
 * Módulo CooperadoClube. Exporta `CooperadoClubeService` pra ser injetado
 * em Fatia 0.4 (cobrancas.service somar mensalidade individual quando
 * cooperado tem adesão ativa).
 */
import { Module } from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { CooperadoClubeService } from './cooperado-clube.service';
import { CooperadoClubeController } from './cooperado-clube.controller';

@Module({
  controllers: [CooperadoClubeController],
  providers: [CooperadoClubeService, PrismaService],
  exports: [CooperadoClubeService],
})
export class CooperadoClubeModule {}
