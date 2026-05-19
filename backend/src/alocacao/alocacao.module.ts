import { Module } from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { AlocacaoController, PoliticaAlocacaoController } from './alocacao.controller';
import { AlocacaoService } from './alocacao.service';
import { AlocacaoEngineService } from './alocacao-engine.service';
import { AlocacaoValidadorService } from './alocacao-validador.service';
import { PoliticaAlocacaoService } from './politica-alocacao.service';

@Module({
  controllers: [AlocacaoController, PoliticaAlocacaoController],
  providers: [
    AlocacaoService,
    AlocacaoEngineService,
    AlocacaoValidadorService,
    PoliticaAlocacaoService,
    PrismaService,
  ],
  exports: [AlocacaoService, AlocacaoEngineService],
})
export class AlocacaoModule {}
