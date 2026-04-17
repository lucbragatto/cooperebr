import { Module } from '@nestjs/common';
import { BandeiraTarifariaService } from './bandeira-tarifaria.service';
import { BandeiraTarifariaController } from './bandeira-tarifaria.controller';
import { PrismaService } from '../prisma.service';

@Module({
  controllers: [BandeiraTarifariaController],
  providers: [BandeiraTarifariaService, PrismaService],
  exports: [BandeiraTarifariaService],
})
export class BandeiraTarifariaModule {}
