import { Module } from '@nestjs/common';
import { FluxoEtapasController } from './fluxo-etapas.controller';
import { FluxoEtapasService } from './fluxo-etapas.service';
import { PrismaService } from '../prisma.service';

@Module({
  controllers: [FluxoEtapasController],
  providers: [FluxoEtapasService, PrismaService],
  exports: [FluxoEtapasService],
})
export class FluxoEtapasModule {}
