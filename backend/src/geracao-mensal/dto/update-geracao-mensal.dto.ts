import { IsNumber, IsOptional, IsString, IsDateString } from 'class-validator';

export class UpdateGeracaoMensalDto {
  @IsOptional()
  @IsDateString()
  competencia?: string;

  @IsOptional()
  @IsNumber()
  kwhGerado?: number;

  @IsOptional()
  @IsString()
  fonte?: string;

  @IsOptional()
  @IsString()
  observacao?: string;
}
