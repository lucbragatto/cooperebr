import { Module } from '@nestjs/common';
import { CooperadosController } from './cooperados.controller';
import { CooperadosService } from './cooperados.service';
import { PrismaService } from '../prisma.service';
import { NotificacoesService } from '../notificacoes/notificacoes.service';
import { UsinasModule } from '../usinas/usinas.module';

@Module({
  imports: [UsinasModule],
  controllers: [CooperadosController],
  providers: [CooperadosService, PrismaService, NotificacoesService],
  exports: [CooperadosService],
})
export class CooperadosModule {}
