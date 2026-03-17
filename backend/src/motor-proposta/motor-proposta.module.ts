import { Module } from '@nestjs/common';
import { MotorPropostaController } from './motor-proposta.controller';
import { MotorPropostaService } from './motor-proposta.service';
import { PrismaService } from '../prisma.service';
import { NotificacoesModule } from '../notificacoes/notificacoes.module';

@Module({
  imports: [NotificacoesModule],
  controllers: [MotorPropostaController],
  providers: [MotorPropostaService, PrismaService],
  exports: [MotorPropostaService],
})
export class MotorPropostaModule {}
