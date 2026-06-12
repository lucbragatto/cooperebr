import { Module } from '@nestjs/common';
import { FinanceiroController } from './financeiro.controller';
import { PlanoContasService } from './plano-contas.service';
import { LancamentosService } from './lancamentos.service';
import { ContratosUsoService } from './contratos-uso.service';
import { ConveniosService } from './convenios.service';
import { FormaPagamentoService } from './forma-pagamento.service';
import { PixExcedenteService } from './pix-excedente.service';
// Sprint Clube P1 — F6 Bloco A (12/06/2026): helper PIX-out extraído do
// pix-excedente. F6 consome; migração do próprio pix-excedente pra este
// helper = carry-over P3 (Decisão Q8 do F6).
import { AsaasPixOutService } from './asaas-pix-out.service';
import { TokenContabilService } from './token-contabil.service';
import { FinanceiroTokenListener } from './financeiro-token.listener';
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
    AsaasPixOutService,
    TokenContabilService,
    FinanceiroTokenListener,
    PrismaService,
  ],
  exports: [
    PlanoContasService,
    LancamentosService,
    ContratosUsoService,
    ConveniosService,
    FormaPagamentoService,
    PixExcedenteService,
    AsaasPixOutService,
    TokenContabilService,
  ],
})
export class FinanceiroModule {}
