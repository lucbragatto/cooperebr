import { Module } from '@nestjs/common';
import { AsaasController } from './asaas.controller';
import { AsaasService } from './asaas.service';
import { PrismaService } from '../prisma.service';

@Module({
  controllers: [AsaasController],
  providers: [AsaasService, PrismaService],
  exports: [AsaasService],
})
export class AsaasModule {}
