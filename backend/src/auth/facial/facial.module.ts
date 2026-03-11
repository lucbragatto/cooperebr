import { Module } from '@nestjs/common';
import { FacialController } from './facial.controller';
import { FacialService } from './facial.service';
import { PrismaService } from '../../prisma.service';

@Module({
  controllers: [FacialController],
  providers: [FacialService, PrismaService],
})
export class FacialModule {}
