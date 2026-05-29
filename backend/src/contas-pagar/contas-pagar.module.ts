import { Module } from '@nestjs/common';
import { ContasPagarController } from './contas-pagar.controller';
import { ContasPagarService } from './contas-pagar.service';
import { PrismaService } from '../prisma.service';
import { NotificacoesProativasModule } from '../notificacoes-proativas/notificacoes-proativas.module';

@Module({
  imports: [NotificacoesProativasModule],
  controllers: [ContasPagarController],
  providers: [ContasPagarService, PrismaService],
  exports: [ContasPagarService],
})
export class ContasPagarModule {}
