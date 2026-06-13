import { Module } from '@nestjs/common';
import { CooperadosModule } from '../cooperados/cooperados.module';
import { MeuPerfilController } from './meu-perfil.controller';
import { PrismaService } from '../prisma.service';
// Sprint Clube P1 — F6 Bloco C.0 (13/06/2026): cadastro PIX com PIN
// (REFORÇO ANTI-FRAUDE). AuditService vem do AuditModule @Global.
import { DadosBancariosService } from './dados-bancarios.service';

/**
 * F1 (09/06/2026) — Recursos do cooperado autenticado.
 *
 * Importa CooperadosModule (provê PinCooperadoService) em vez de declarar
 * o service direto — evita duplicacao + mantem CooperadosModule como fonte
 * unica do ciclo de vida do PIN.
 *
 * F6 Bloco C.0 (13/06/2026): adiciona DadosBancariosService pra cadastro
 * da chave PIX. AuditService já é @Global (AuditModule).
 */
@Module({
  imports: [CooperadosModule],
  controllers: [MeuPerfilController],
  providers: [DadosBancariosService, PrismaService],
})
export class MeuPerfilModule {}
