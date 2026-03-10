import { Module } from '@nestjs/common';
import { CobrancasController } from './cobrancas.controller';
import { CobrancasService } from './cobrancas.service';
import { PrismaService } from '../prisma.service';

@Module({
  controllers: [CobrancasController],
  providers: [CobrancasService, PrismaService],
})
export class CobrancasModule {}
