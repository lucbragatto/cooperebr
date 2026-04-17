import { IsIn, IsNumber, Min, IsDateString, IsOptional, IsString } from 'class-validator';

export class UpdateBandeiraDto {
  @IsOptional()
  @IsIn(['VERDE', 'AMARELA', 'VERMELHA_P1', 'VERMELHA_P2'])
  tipo?: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  valorPor100Kwh?: number;

  @IsOptional()
  @IsDateString()
  dataInicio?: string;

  @IsOptional()
  @IsDateString()
  dataFim?: string;

  @IsOptional()
  @IsString()
  observacao?: string;
}
