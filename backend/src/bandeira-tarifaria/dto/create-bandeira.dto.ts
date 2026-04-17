import { IsIn, IsNumber, Min, IsDateString, IsOptional, IsString } from 'class-validator';

export class CreateBandeiraDto {
  @IsIn(['VERDE', 'AMARELA', 'VERMELHA_P1', 'VERMELHA_P2'])
  tipo: string;

  @IsNumber()
  @Min(0)
  valorPor100Kwh: number;

  @IsDateString()
  dataInicio: string;

  @IsDateString()
  dataFim: string;

  @IsOptional()
  @IsString()
  observacao?: string;
}
