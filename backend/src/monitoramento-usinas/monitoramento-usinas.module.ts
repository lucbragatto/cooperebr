import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { MonitoramentoUsinasController } from './monitoramento-usinas.controller';
import { MonitoramentoUsinasService } from './monitoramento-usinas.service';
import { SungrowService } from './sungrow.service';
import { PrismaService } from '../prisma.service';
import { OcorrenciasModule } from '../ocorrencias/ocorrencias.module';
import { EncryptionModule } from '../gateways-pagamento-config/encryption.module';

/**
 * Sub-Sprint F Etapa E (M30, 2026-05-26):
 * Importa EncryptionModule pra encriptar/decriptar sungrowSenha
 * com CredentialsEncryptor (GATEWAY_ENCRYPT_KEY).
 */
@Module({
  imports: [HttpModule, OcorrenciasModule, EncryptionModule],
  controllers: [MonitoramentoUsinasController],
  providers: [MonitoramentoUsinasService, SungrowService, PrismaService],
})
export class MonitoramentoUsinasModule {}
