import { IsBoolean, IsDateString, IsEnum, IsOptional, IsString, MinLength } from 'class-validator';
import { FluxoConvenio, TipoBeneficioConvenio } from '@prisma/client';

export class UpdateConvenioDto {
  @IsString()
  @MinLength(3)
  @IsOptional()
  nome?: string;

  @IsString()
  @IsOptional()
  descricao?: string;

  @IsEnum(TipoBeneficioConvenio)
  @IsOptional()
  tipoBeneficio?: TipoBeneficioConvenio;

  @IsEnum(FluxoConvenio)
  @IsOptional()
  fluxoFinanceiro?: FluxoConvenio;

  @IsString()
  @MinLength(10)
  @IsOptional()
  classificacaoFiscal?: string;

  @IsDateString()
  @IsOptional()
  vigenciaInicio?: string;

  @IsDateString()
  @IsOptional()
  vigenciaFim?: string;

  @IsBoolean()
  @IsOptional()
  ativo?: boolean;

  @IsString()
  @IsOptional()
  observacoes?: string;
}
