import { Module } from '@nestjs/common';
import { RelatoriosController } from './relatorios.controller';
import { RelatoriosService } from './relatorios.service';
import { PosicaoCooperadoService } from './posicao-cooperado.service';
import { PosicaoCooperadoJob } from './posicao-cooperado.job';
import { PrismaService } from '../prisma.service';

@Module({
  controllers: [RelatoriosController],
  providers: [RelatoriosService, PosicaoCooperadoService, PosicaoCooperadoJob, PrismaService],
  exports: [RelatoriosService, PosicaoCooperadoService],
})
export class RelatoriosModule {}
