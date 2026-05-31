import { Module } from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { ContabilidadeTributariaService } from './contabilidade-tributaria.service';
import { ConveniosCtController } from './convenios-ct.controller';
import { ConveniosCtService } from './convenios-ct.service';
import { RegimeContabilFactory } from './regimes/regime.factory';
import { ApuracaoController } from './apuracao.controller';
import { ApuracaoService } from './apuracao.service';
import { DreController } from './dre.controller';
import { DreService } from './dre.service';
import { RelatoriosCtController } from './relatorios-ct.controller';
import { RelatoriosCtService } from './relatorios-ct.service';
import { PdfGeneratorService } from '../motor-proposta/pdf-generator.service';

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
  controllers: [
    ConveniosCtController,
    ApuracaoController,
    DreController,
    RelatoriosCtController,
  ],
  providers: [
    PrismaService,
    RegimeContabilFactory,
    ContabilidadeTributariaService,
    ConveniosCtService,
    ApuracaoService,
    DreService,
    RelatoriosCtService,
    PdfGeneratorService,
  ],
  exports: [
    ContabilidadeTributariaService,
    RegimeContabilFactory,
    ApuracaoService,
    DreService,
    RelatoriosCtService,
  ],
})
export class ContabilidadeTributariaModule {}
