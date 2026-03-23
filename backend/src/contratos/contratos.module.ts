import { Module } from '@nestjs/common';
import { ContratosController } from './contratos.controller';
import { ContratosService } from './contratos.service';
import { PrismaService } from '../prisma.service';
import { CooperadosModule } from '../cooperados/cooperados.module';
import { UsinasModule } from '../usinas/usinas.module';
import { NotificacoesModule } from '../notificacoes/notificacoes.module';

@Module({
  imports: [CooperadosModule, UsinasModule, NotificacoesModule],
  controllers: [ContratosController],
  providers: [ContratosService, PrismaService],
  exports: [ContratosService],
})
export class ContratosModule {}
