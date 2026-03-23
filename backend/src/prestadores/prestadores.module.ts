import { Module } from '@nestjs/common';
import { PrestadoresController } from './prestadores.controller';
import { PrestadoresService } from './prestadores.service';
import { PrismaService } from '../prisma.service';

@Module({
  controllers: [PrestadoresController],
  providers: [PrestadoresService, PrismaService],
  exports: [PrestadoresService],
})
export class PrestadoresModule {}
