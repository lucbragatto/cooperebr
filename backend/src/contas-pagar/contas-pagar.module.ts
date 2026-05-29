import { Module } from '@nestjs/common';
import { ContasPagarController } from './contas-pagar.controller';
import { ContasPagarService } from './contas-pagar.service';
import { RepasseMensalCron } from './repasse-mensal.cron';
import { PrismaService } from '../prisma.service';
import { NotificacoesProativasModule } from '../notificacoes-proativas/notificacoes-proativas.module';

@Module({
  imports: [NotificacoesProativasModule],
  controllers: [ContasPagarController],
  providers: [ContasPagarService, RepasseMensalCron, PrismaService],
  exports: [ContasPagarService],
})
export class ContasPagarModule {}
