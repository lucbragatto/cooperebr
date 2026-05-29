import { Module } from '@nestjs/common';
import { RepassesProprietarioController } from './repasses-proprietario.controller';
import { RepassesProprietarioService } from './repasses-proprietario.service';
import { PrismaService } from '../prisma.service';

/**
 * D-novo-AN (M42, 2026-05-30) — Módulo RepasseProprietario.
 *
 * AN.1: schema + service.
 * AN.2: controller REST + integração cron BH.5.
 * AN.3 (próxima): telas frontend.
 */
@Module({
  controllers: [RepassesProprietarioController],
  providers: [RepassesProprietarioService, PrismaService],
  exports: [RepassesProprietarioService],
})
export class RepassesProprietarioModule {}
