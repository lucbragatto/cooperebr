import { Module } from '@nestjs/common';
import { MotorPropostaController } from './motor-proposta.controller';
import { MotorPropostaService } from './motor-proposta.service';
import { PrismaService } from '../prisma.service';
import { NotificacoesModule } from '../notificacoes/notificacoes.module';
import { CooperadosModule } from '../cooperados/cooperados.module';
import { ContratosModule } from '../contratos/contratos.module';
import { UsinasModule } from '../usinas/usinas.module';

@Module({
  imports: [NotificacoesModule, CooperadosModule, ContratosModule, UsinasModule],
  controllers: [MotorPropostaController],
  providers: [MotorPropostaService, PrismaService],
  exports: [MotorPropostaService],
})
export class MotorPropostaModule {}
