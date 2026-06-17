import { Module } from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { DisclaimerSaqueController } from './disclaimer-saque.controller';
import { DisclaimerSaqueService } from './disclaimer-saque.service';

/**
 * Sprint D2.1 v2 (16/06/2026) — Módulo do disclaimer versionado do saque
 * PIX. Service tem onModuleInit que faz seed idempotente do global v1.
 */
@Module({
  providers: [PrismaService, DisclaimerSaqueService],
  controllers: [DisclaimerSaqueController],
  exports: [DisclaimerSaqueService],
})
export class DisclaimerSaqueModule {}
