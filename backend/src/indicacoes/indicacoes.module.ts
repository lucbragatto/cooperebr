import { Module } from '@nestjs/common';
import { IndicacoesController } from './indicacoes.controller';
import { IndicacoesService } from './indicacoes.service';
import { PrismaService } from '../prisma.service';

@Module({
  controllers: [IndicacoesController],
  providers: [IndicacoesService, PrismaService],
  exports: [IndicacoesService],
})
export class IndicacoesModule {}
