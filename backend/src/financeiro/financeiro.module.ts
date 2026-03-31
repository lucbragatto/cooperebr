import { Module } from '@nestjs/common';
import { FinanceiroController } from './financeiro.controller';
import { PlanoContasService } from './plano-contas.service';
import { LancamentosService } from './lancamentos.service';
import { ContratosUsoService } from './contratos-uso.service';
import { ConveniosService } from './convenios.service';
import { FormaPagamentoService } from './forma-pagamento.service';
import { PixExcedenteService } from './pix-excedente.service';
import { PrismaService } from '../prisma.service';
import { AsaasModule } from '../asaas/asaas.module';

@Module({
  imports: [AsaasModule],
  controllers: [FinanceiroController],
  providers: [
    PlanoContasService,
    LancamentosService,
    ContratosUsoService,
    ConveniosService,
    FormaPagamentoService,
    PixExcedenteService,
    PrismaService,
  ],
  exports: [
    PlanoContasService,
    LancamentosService,
    ContratosUsoService,
    ConveniosService,
    FormaPagamentoService,
    PixExcedenteService,
  ],
})
export class FinanceiroModule {}
