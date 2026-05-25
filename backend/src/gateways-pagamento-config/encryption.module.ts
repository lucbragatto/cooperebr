import { Module } from '@nestjs/common';
import { CredentialsEncryptor } from './credentials-encryptor.service';

/**
 * Modulo dedicado pro CredentialsEncryptor — extraido pra evitar ciclo de
 * dependencia entre GatewaysPagamentoConfigModule (que provia o encryptor
 * originalmente) e BanestesModule (que agora precisa do encryptor pra
 * decriptar credenciais por tenant).
 *
 * Sub-Sprint Gateways de Pagamento — Fatia F3 (M28, 2026-05-26).
 *
 * Caminho do ciclo evitado:
 *   GatewaysPagamentoConfigModule -> GatewayPagamentoModule -> BanestesModule
 *     -> GatewaysPagamentoConfigModule (se tentasse importar diretamente).
 *
 * Solucao: EncryptionModule fica fora desse caminho, importado tanto por
 * GatewaysPagamentoConfigModule quanto por BanestesModule.
 */
@Module({
  providers: [CredentialsEncryptor],
  exports: [CredentialsEncryptor],
})
export class EncryptionModule {}
