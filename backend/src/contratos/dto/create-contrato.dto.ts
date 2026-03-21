import { IsDateString, IsNotEmpty, IsNumber, IsOptional, IsString, IsUUID } from 'class-validator';

export class CreateContratoDto {
  @IsUUID()
  cooperadoId!: string;

  @IsUUID()
  ucId!: string;

  @IsOptional()
  @IsUUID()
  usinaId?: string;

  @IsOptional()
  @IsUUID()
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
