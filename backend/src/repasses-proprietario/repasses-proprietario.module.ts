import { Module } from '@nestjs/common';
import { RepassesProprietarioService } from './repasses-proprietario.service';
import { PrismaService } from '../prisma.service';

/**
 * D-novo-AN AN.1 (M42, 2026-05-30) — Módulo RepasseProprietario.
 *
 * AN.2 (próxima fatia) adiciona controller REST + integração cron BH.5.
 * AN.3 adiciona telas frontend.
 */
@Module({
  providers: [RepassesProprietarioService, PrismaService],
  exports: [RepassesProprietarioService],
})
export class RepassesProprietarioModule {}
