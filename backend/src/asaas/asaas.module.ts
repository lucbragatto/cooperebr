import { Module } from '@nestjs/common';
import { AsaasController } from './asaas.controller';
import { AsaasService } from './asaas.service';
import { PrismaService } from '../prisma.service';
import { EncryptionModule } from '../gateways-pagamento-config/encryption.module';

/**
 * Sub-Sprint Gateways de Pagamento Fatia F2 (M29, 2026-05-26):
 * Importa EncryptionModule pra acesso ao CredentialsEncryptor — usado
 * pelo dual-write em AsaasService.salvarConfig (grava simultaneamente
 * em AsaasConfig legado + ConfigGateway novo durante a coexistencia
 * de 30 dias).
 */
@Module({
  imports: [EncryptionModule],
  controllers: [AsaasController],
  providers: [AsaasService, PrismaService],
  exports: [AsaasService],
})
export class AsaasModule {}
