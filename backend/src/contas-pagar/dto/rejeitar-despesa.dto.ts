/**
 * D-novo-BH (M37, 29/05/2026) — DTO de rejeição de despesa proposta.
 *
 * Motivo obrigatório pra preservar contexto pro proprietário.
 */
import { IsNotEmpty, IsString, MaxLength } from 'class-validator';

export class RejeitarDespesaDto {
  @IsString()
  @IsNotEmpty({ message: 'motivo da rejeição é obrigatório' })
  @MaxLength(500, { message: 'motivo até 500 chars' })
  motivo!: string;
}
