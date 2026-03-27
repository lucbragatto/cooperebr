import { Module } from '@nestjs/common';
import { CondominiosController } from './condominios.controller';
import { CondominiosService } from './condominios.service';
import { PrismaService } from '../prisma.service';

@Module({
  controllers: [CondominiosController],
  providers: [CondominiosService, PrismaService],
  exports: [CondominiosService],
})
export class CondominiosModule {}
