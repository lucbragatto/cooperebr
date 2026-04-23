import { Module } from '@nestjs/common';
import { CooperTokenController } from './cooper-token.controller';
import { ContabilidadeClubeController } from './contabilidade-clube.controller';
import { CooperTokenService } from './cooper-token.service';
import { CooperTokenJob } from './cooper-token.job';
import { PrismaService } from '../prisma.service';

@Module({
  controllers: [CooperTokenController, ContabilidadeClubeController],
  providers: [CooperTokenService, CooperTokenJob, PrismaService],
  exports: [CooperTokenService],
})
export class CooperTokenModule {}
