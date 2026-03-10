import { Module } from '@nestjs/common';
import { CooperadosController } from './cooperados.controller';
import { CooperadosService } from './cooperados.service';
import { PrismaService } from '../prisma.service';

@Module({
  controllers: [CooperadosController],
  providers: [CooperadosService, PrismaService],
})
export class CooperadosModule {}