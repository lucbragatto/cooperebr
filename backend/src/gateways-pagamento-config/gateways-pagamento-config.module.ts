import { Module } from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { EncryptionModule } from './encryption.module';
import { GatewaysPagamentoConfigService } from './gateways-pagamento-config.service';
import { GatewaysPagamentoConfigController } from './gateways-pagamento-config.controller';
import { GatewayPagamentoModule } from '../gateway-pagamento/gateway-pagamento.module';

/**
 * Sub-Sprint Gateways de Pagamento — Fatia F1 Backend (M27, 2026-05-26).
 *
 * Módulo administrativo (CRUD) das credenciais por tenant.
 * Separado do `gateway-pagamento/` que é o motor de emissão (factory + adapters).
 *
 * Trabalha sobre o schema atual de `ConfigGateway` (sem mudança em F1).
 * Schema rename + add `metadados` virão na Fatia F2 com migration cuidadosa.
 *
 * Decisões travadas (relatório Fase 1):
 * 1. Encryption (a): CredentialsEncryptor + GATEWAY_ENCRYPT_KEY (AES-256-GCM)
 * 2. .pfx em disco (path em metadados quando F2 chegar; em F1 vai junto em credenciais)
 * 3. Coexistência AsaasConfig + ConfigGateway 30 dias com dual-write (F2)
 * 4. ConfigGatewayPlataforma adiada
 * 5. Sicoob/BB fora do registry
 * 6. @@unique([cooperativaId, gateway]) mantido
 */
@Module({
  imports: [EncryptionModule, GatewayPagamentoModule],
  controllers: [GatewaysPagamentoConfigController],
  providers: [GatewaysPagamentoConfigService, PrismaService],
  exports: [GatewaysPagamentoConfigService, EncryptionModule],
})
export class GatewaysPagamentoConfigModule {}
