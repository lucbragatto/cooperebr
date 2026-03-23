import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { MonitoramentoUsinasController } from './monitoramento-usinas.controller';
import { MonitoramentoUsinasService } from './monitoramento-usinas.service';
import { SungrowService } from './sungrow.service';
import { PrismaService } from '../prisma.service';
import { OcorrenciasModule } from '../ocorrencias/ocorrencias.module';

@Module({
  imports: [HttpModule, OcorrenciasModule],
  controllers: [MonitoramentoUsinasController],
  providers: [MonitoramentoUsinasService, SungrowService, PrismaService],
})
export class MonitoramentoUsinasModule {}
