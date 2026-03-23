import { IsDateString, IsNotEmpty, IsNumber, IsOptional, IsString } from 'class-validator';

export class CreateContratoDto {
  @IsString()
  @IsNotEmpty()
  cooperadoId!: string;

  @IsString()
  @IsNotEmpty()
  ucId!: string;

  @IsOptional()
  @IsString()
  usinaId?: string;

  @IsOptional()
  @IsString()
  planoId?: string;

  @IsDateString()
  @IsNotEmpty()
  dataInicio!: string;

  @IsOptional()
  @IsDateString()
  dataFim?: string;

  @IsNumber()
  percentualDesconto!: number;

  @IsOptional()
  @IsNumber()
  kwhContratoAnual?: number;

  @IsOptional()
  @IsNumber()
  kwhContrato?: number;
}
