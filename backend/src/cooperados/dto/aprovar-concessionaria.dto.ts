import { IsString, IsNotEmpty, MinLength } from 'class-validator';
import { Transform } from 'class-transformer';

/**
 * DTO da transição AGUARDANDO_CONCESSIONARIA → APROVADO.
 *
 * Aplicado em 11/05/2026 (D-J-1 da sessão 05/05 manhã, reformulada
 * em 05/05 tarde após reframe da etapa 11).
 */
export class AprovarConcessionariaDto {
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @IsNotEmpty({ message: 'Protocolo é obrigatório' })
  @MinLength(3, { message: 'Protocolo deve ter ao menos 3 caracteres' })
  protocoloConcessionaria!: string;
}
