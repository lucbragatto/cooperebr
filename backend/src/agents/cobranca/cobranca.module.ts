import { Module } from '@nestjs/common';
import { CobrancaService } from './cobranca.service';

/**
 * CobrancaModule — Prioridade E (Inconsistências de Cobrança/Faturamento)
 *
 * Tools de diagnóstico cruzando:
 * - Faturas (FaturaProcessada), Cobranças, ModeloCobrancaConfig, ConfiguracaoCobranca
 * - Pagamentos parciais (SolicitacaoConfirmacaoPagamento), multas, juros, gateways (Asaas/CobrancaBancaria)
 *
 * Fase 1: apenas Tools L0 (leitura pura). Expande para L1 (simulação de modelos não-FIXO) em iterações seguintes.
 */
@Module({
  imports: [],
  providers: [CobrancaService],
  exports: [CobrancaService],
})
export class CobrancaModule {}
