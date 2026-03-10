import { Module } from '@nestjs/common';
import { ContratosController } from './contratos.controller';
import { ContratosService } from './contratos.service';
import { PrismaService } from '../prisma.service';

@Module({
  controllers: [ContratosController],
  providers: [ContratosService, PrismaService],
})
export class ContratosModule {}
