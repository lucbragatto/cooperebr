import { Module } from '@nestjs/common';
import { BanestesConfigService } from './banestes-config.service';
import { BanestesAdapter } from './banestes.adapter';
import { BanestesController } from './banestes.controller';
import { PrismaService } from '../../prisma.service';
import { EncryptionModule } from '../../gateways-pagamento-config/encryption.module';

/**
 * Modulo Banestes — adapter PIX.
 *
 * Sub-Sprint Gateways de Pagamento — Fatia F3 (M28, 2026-05-26):
 * agora le ConfigGateway BANESTES por tenant (em vez de .env globais).
 * Importa EncryptionModule pra decriptar secrets armazenados via
 * CredentialsEncryptor.
 *
 * Cenario Minimo M26: cancelarCobranca + processarWebhook sao stubs
 * (D-novo-AH catalogado: baixa manual via painel admin Bloco 8).
 */
@Module({
  imports: [EncryptionModule],
  controllers: [BanestesController],
  providers: [BanestesConfigService, BanestesAdapter, PrismaService],
  exports: [BanestesConfigService, BanestesAdapter],
})
export class BanestesModule {}
