import { IsDateString, IsNumber, IsOptional, IsString, MaxLength, Min } from 'class-validator';
import { Type } from 'class-transformer';

/**
 * D-FISCAL-2.2 (01/06/2026 noite) — DTO pra registrar movimento contábil
 * do CONVÊNIO CONSOLIDADO (ContratoConvenio + flags fiscais da 2.1).
 *
 * Sentido (RECEITA/DESPESA) + natureza fiscal são derivados do convênio
 * (`fluxoFinanceiro` + `naturezaAtoCooperativo`). DTO só captura o que o
 * admin lança no momento: valor + data + descrição opcional.
 */
export class RegistrarMovimentoConvenioContratoDto {
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
