import { Module } from '@nestjs/common';
import { RelatoriosController } from './relatorios.controller';
import { RelatoriosService } from './relatorios.service';
import { RelatoriosQueryService } from './relatorios-query.service';
import { PrismaService } from '../prisma.service';
@Module({
  controllers: [RelatoriosController],
  providers: [RelatoriosService, RelatoriosQueryService, PrismaService],
  exports: [RelatoriosService, RelatoriosQueryService],
})
export class RelatoriosModule {}
