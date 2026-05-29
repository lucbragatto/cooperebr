import { Module } from '@nestjs/common';
import { RepassesProprietarioController } from './repasses-proprietario.controller';
import { RepassesProprietarioService } from './repasses-proprietario.service';
import { PrismaService } from '../prisma.service';
import { NotificacoesProativasModule } from '../notificacoes-proativas/notificacoes-proativas.module';

/**
 * D-novo-AN (M42, 2026-05-30) — Módulo RepasseProprietario.
 *
 * AN.1: schema + service.
 * AN.2: controller REST + integração cron BH.5.
 * AN.3: telas frontend.
 * AN.4: notificação proativa "Repasse pago" (NotificacoesProativasModule).
 */
@Module({
  imports: [NotificacoesProativasModule],
  controllers: [RepassesProprietarioController],
  providers: [RepassesProprietarioService, PrismaService],
  exports: [RepassesProprietarioService],
})
export class RepassesProprietarioModule {}
