import { Module } from '@nestjs/common';
import { CooperativasController } from './cooperativas.controller';
import { CooperativasService } from './cooperativas.service';
import { PrismaService } from '../prisma.service';

@Module({
  controllers: [CooperativasController],
  providers: [CooperativasService, PrismaService],
  exports: [CooperativasService],
})
export class CooperativasModule {}
