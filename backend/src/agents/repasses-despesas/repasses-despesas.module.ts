import { Module } from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { ToolRegistryService } from '../common/tools/tool-registry.service';
import { RepassesDespesasService } from './repasses-despesas.service';

/**
 * RepassesDespesasModule — Prioridade B
 *
 * Tools para análise, monitoramento e simulação de:
 * - Repasses a proprietários (RepasseProprietario)
 * - Despesas operacionais (ContaAPagar), com foco no fluxo DESCONTO_NO_REPASSE
 */
@Module({
  imports: [],
  providers: [
    PrismaService,
    ToolRegistryService,
    RepassesDespesasService,
  ],
  exports: [RepassesDespesasService],
})
export class RepassesDespesasModule {}
