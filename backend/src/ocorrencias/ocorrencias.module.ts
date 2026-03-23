import { Module } from '@nestjs/common';
import { OcorrenciasController } from './ocorrencias.controller';
import { OcorrenciasService } from './ocorrencias.service';
import { PrismaService } from '../prisma.service';

@Module({
  controllers: [OcorrenciasController],
  providers: [OcorrenciasService, PrismaService],
  exports: [OcorrenciasService],
})
export class OcorrenciasModule {}
