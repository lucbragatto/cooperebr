import { Module } from '@nestjs/common';
import { SaasController } from './saas.controller';
import { SaasService } from './saas.service';
import { PrismaService } from '../prisma.service';

@Module({
  controllers: [SaasController],
  providers: [SaasService, PrismaService],
  exports: [SaasService],
})
export class SaasModule {}
