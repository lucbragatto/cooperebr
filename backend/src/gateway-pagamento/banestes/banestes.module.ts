import { Module } from '@nestjs/common';
import { BanestesConfigService } from './banestes-config.service';
import { BanestesAdapter } from './banestes.adapter';
import { BanestesController } from './banestes.controller';
import { PrismaService } from '../../prisma.service';

/**
 * Modulo Banestes — adapter PIX. Cenario Minimo (M26, 2026-05-26).
 *
 * Provides:
 *   - BanestesConfigService: carrega .pfx + cache OAuth token + mTLS agent
 *   - BanestesAdapter: implementa GatewayPagamentoAdapter (emite PIX,
 *     testarConexao; cancelar+webhook sao stubs do Cenario Completo)
 *
 * Stubs deliberados: cancelarCobranca + processarWebhook → Cenario Completo
 * futuro (D-novo-AH catalogado: baixa manual via painel admin Bloco 8).
 */
@Module({
  controllers: [BanestesController],
  providers: [BanestesConfigService, BanestesAdapter, PrismaService],
  exports: [BanestesConfigService, BanestesAdapter],
})
export class BanestesModule {}
