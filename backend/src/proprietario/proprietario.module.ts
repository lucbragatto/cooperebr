import { Module } from '@nestjs/common';
import { ProprietarioService } from './proprietario.service';
import { ProprietarioController } from './proprietario.controller';
import { RelatorioMensalService } from './relatorio-mensal.service';
import { ConviteProprietarioService } from './convite-proprietario.service';
import { ConviteEmailService } from './convite-email.service';
import { PdfGeneratorService } from '../motor-proposta/pdf-generator.service';
import { EmailModule } from '../email/email.module';
import { PrismaService } from '../prisma.service';

/**
 * Sub-Sprint F (M30 + M31, 2026-05-26).
 *
 * Module dedicado ao Portal Proprietario.
 * - ProprietarioService: Dashboard, detalheUsina, repasses, contratos, despesas
 * - RelatorioMensalService: cron mensal + endpoint sob demanda PDF
 * - ConviteProprietarioService (M31): magic link onboarding + cadastro manual
 * - ConviteEmailService (M31): template HTML pro envio do convite
 * - PdfGeneratorService + EmailService: stateless, reusados de outros modules
 *   como providers diretos (sem ciclo de dependencia)
 */
@Module({
  imports: [EmailModule],
  controllers: [ProprietarioController],
  providers: [
    ProprietarioService,
    RelatorioMensalService,
    ConviteProprietarioService,
    ConviteEmailService,
    PdfGeneratorService,
    PrismaService,
  ],
  exports: [ProprietarioService, RelatorioMensalService, ConviteProprietarioService],
})
export class ProprietarioModule {}
