import { Module } from '@nestjs/common';
import { ProprietarioService } from './proprietario.service';
import { ProprietarioController } from './proprietario.controller';
import { RelatorioMensalService } from './relatorio-mensal.service';
import { PdfGeneratorService } from '../motor-proposta/pdf-generator.service';
import { PrismaService } from '../prisma.service';

/**
 * Sub-Sprint F MVP+ Etapas D + F (M30, 2026-05-26).
 *
 * Module dedicado ao Portal Proprietario.
 * - ProprietarioService: agrega Dashboard, detalheUsina, repasses, contratos, despesas
 * - RelatorioMensalService: cron mensal + endpoint sob demanda PDF
 * - PdfGeneratorService: stateless, reusado de motor-proposta como provider direto
 *   (sem ciclo de dependencia)
 */
@Module({
  controllers: [ProprietarioController],
  providers: [
    ProprietarioService,
    RelatorioMensalService,
    PdfGeneratorService,
    PrismaService,
  ],
  exports: [ProprietarioService, RelatorioMensalService],
})
export class ProprietarioModule {}
