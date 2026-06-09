import { Module } from '@nestjs/common';
import { CooperadosModule } from '../cooperados/cooperados.module';
import { MeuPerfilController } from './meu-perfil.controller';

/**
 * F1 (09/06/2026) — Recursos do cooperado autenticado.
 *
 * Importa CooperadosModule (provê PinCooperadoService) em vez de declarar
 * o service direto — evita duplicacao + mantem CooperadosModule como fonte
 * unica do ciclo de vida do PIN.
 */
@Module({
  imports: [CooperadosModule],
  controllers: [MeuPerfilController],
})
export class MeuPerfilModule {}
