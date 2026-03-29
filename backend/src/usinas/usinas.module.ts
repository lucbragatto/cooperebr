import { Module } from '@nestjs/common';
import { UsinasController } from './usinas.controller';
import { UsinasService } from './usinas.service';
import { UsinasAnaliticoService } from './usinas-analitico.service';
import { PrismaService } from '../prisma.service';

@Module({
  controllers: [UsinasController],
  providers: [UsinasService, UsinasAnaliticoService, PrismaService],
  exports: [UsinasService],
})
export class UsinasModule {}