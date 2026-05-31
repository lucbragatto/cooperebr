import { Module } from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { ContabilidadeTributariaService } from './contabilidade-tributaria.service';
import { ConveniosCtController } from './convenios-ct.controller';
import { ConveniosCtService } from './convenios-ct.service';
import { RegimeContabilFactory } from './regimes/regime.factory';

/**
 * D-novo-BR-CT CT.2 (31/05/2026) — Módulo de contabilidade tributária.
 *
 * Separado do `financeiro/` (cama-base permanece intocada). Consome
 * dados upstream por composição (Cobranca/ContaAPagar/RepasseProprietario),
 * não duplica.
 *
 * Exports:
 *   - ContabilidadeTributariaService: pra outros módulos chamarem
 *     classificarLancamento() (CT.3 vai wirar hooks automáticos).
 */
@Module({
  controllers: [ConveniosCtController],
  providers: [
    PrismaService,
    RegimeContabilFactory,
    ContabilidadeTributariaService,
    ConveniosCtService,
  ],
  exports: [ContabilidadeTributariaService, RegimeContabilFactory],
})
export class ContabilidadeTributariaModule {}
