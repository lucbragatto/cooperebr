import { Module } from '@nestjs/common';
import { UsinasController } from './usinas.controller';
import { UsinasService } from './usinas.service';
import { PrismaService } from '../prisma.service';

@Module({
  controllers: [UsinasController],
  providers: [UsinasService, PrismaService],
})
export class UsinasModule {}