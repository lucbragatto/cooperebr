import { Module } from '@nestjs/common';
import { FaturasController } from './faturas.controller';
import { FaturasService } from './faturas.service';
import { PrismaService } from '../prisma.service';
import { NotificacoesModule } from '../notificacoes/notificacoes.module';

@Module({
  imports: [NotificacoesModule],
  controllers: [FaturasController],
  providers: [FaturasService, PrismaService],
})
export class FaturasModule {}
