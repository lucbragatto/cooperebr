import { Module } from '@nestjs/common';
import { BandeiraTarifariaService } from './bandeira-tarifaria.service';
import { BandeiraAneelService } from './bandeira-aneel.service';
import { BandeiraTarifariaController } from './bandeira-tarifaria.controller';
import { PrismaService } from '../prisma.service';

@Module({
  controllers: [BandeiraTarifariaController],
  providers: [BandeiraTarifariaService, BandeiraAneelService, PrismaService],
  exports: [BandeiraTarifariaService, BandeiraAneelService],
})
export class BandeiraTarifariaModule {}
