import { IsDateString, IsNumber, IsOptional, IsString, MaxLength, Min } from 'class-validator';
import { Type } from 'class-transformer';

/**
 * D-novo-CT-CT.9 (01/06/2026) — DTO pra registrar movimento manual de Convênio.
 *
 * Sentido (RECEITA/DESPESA) é derivado de `Convenio.fluxoFinanceiro` no service.
 * Aqui captamos só o que o admin lança: valor, data, descrição opcional.
 */
export class RegistrarMovimentoConvenioDto {
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0.01, { message: 'Valor deve ser maior que zero' })
  valor!: number;

  @IsDateString({}, { message: 'dataMovimento deve ser ISO date (YYYY-MM-DD)' })
  dataMovimento!: string;

  @IsOptional()
  @IsString()
  @MaxLength(300)
  descricao?: string;
}
