import { IsDateString, IsEnum, IsNumber, IsOptional, IsString } from 'class-validator';
import { StatusContrato, ModeloCobranca } from '@prisma/client';

export class UpdateContratoDto {
  @IsOptional()
  @IsString()
  ucId?: string;

  @IsOptional()
  @IsString()
  usinaId?: string;

  @IsOptional()
  @IsString()
  planoId?: string;

  @IsOptional()
  @IsDateString()
  dataInicio?: string;

  @IsOptional()
  @IsDateString()
  dataFim?: string;

  @IsOptional()
  @IsNumber()
  percentualDesconto?: number;

  @IsOptional()
  @IsNumber()
  kwhContratoAnual?: number;

  @IsOptional()
  @IsNumber()
  kwhContrato?: number;

  @IsOptional()
  @IsEnum(StatusContrato)
  status?: StatusContrato;

  @IsOptional()
  @IsEnum(ModeloCobranca)
  modeloCobrancaOverride?: ModeloCobranca | null;
}
