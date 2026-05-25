import { Module } from '@nestjs/common';
import { BanestesConfigService } from './banestes-config.service';

/**
 * Modulo Banestes — adapter PIX. Cenario Minimo (M26, 2026-05-26).
 *
 * Provides:
 *   - BanestesConfigService: carrega .pfx + cache OAuth token + mTLS agent
 *
 * Sera ampliado com BanestesAdapter na Etapa B + endpoint testarConexao
 * na Etapa C.
 */
@Module({
  providers: [BanestesConfigService],
  exports: [BanestesConfigService],
})
export class BanestesModule {}
