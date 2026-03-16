import { Module } from '@nestjs/common';
import { PlanosController } from './planos.controller';
import { PlanosService } from './planos.service';
import { PrismaService } from '../prisma.service';

@Module({
  controllers: [PlanosController],
  providers: [PlanosService, PrismaService],
  exports: [PlanosService],
})
export class PlanosModule {}
