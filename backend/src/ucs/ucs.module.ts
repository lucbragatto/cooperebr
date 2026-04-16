import { Module } from '@nestjs/common';
import { UcsController } from './ucs.controller';
import { UcsService } from './ucs.service';
import { PrismaService } from '../prisma.service';

@Module({
  controllers: [UcsController],
  providers: [UcsService, PrismaService],
  exports: [UcsService],
})
export class UcsModule {}