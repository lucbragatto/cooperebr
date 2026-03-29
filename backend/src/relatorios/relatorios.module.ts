import { Module } from '@nestjs/common';
import { RelatoriosController } from './relatorios.controller';
import { RelatoriosService } from './relatorios.service';
import { PrismaService } from '../prisma.service';

@Module({
  controllers: [RelatoriosController],
  providers: [RelatoriosService, PrismaService],
  exports: [RelatoriosService],
})
export class RelatoriosModule {}
