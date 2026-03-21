import { IsNotEmpty, IsString, IsNumber, IsOptional, IsDateString } from 'class-validator';

export class CreateGeracaoMensalDto {
  @IsString()
  @IsNotEmpty()
  usinaId!: string;

  @IsDateString()
  @IsNotEmpty()
  competencia!: string;

  @IsNumber()
  @IsNotEmpty()
  kwhGerado!: number;

  @IsOptional()
  @IsString()
  fonte?: string;

  @IsOptional()
  @IsString()
  observacao?: string;
}
