import { Module } from '@nestjs/common';
import { SaasController } from './saas.controller';
import { SaasService } from './saas.service';
import { MetricasSaasService } from './metricas-saas.service';
import { PrismaService } from '../prisma.service';

@Module({
  controllers: [SaasController],
  providers: [SaasService, MetricasSaasService, PrismaService],
  exports: [SaasService, MetricasSaasService],
})
export class SaasModule {}
