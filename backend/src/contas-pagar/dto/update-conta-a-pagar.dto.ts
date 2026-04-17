import { IsOptional, IsString, IsEnum, IsNumber, IsDateString, Min } from 'class-validator';
import { CategoriaContaAPagar, StatusContaAPagar } from '@prisma/client';

export class UpdateContaAPagarDto {
  @IsOptional()
  @IsString()
  descricao?: string;

  @IsOptional()
  @IsEnum(CategoriaContaAPagar)
  categoria?: CategoriaContaAPagar;

  @IsOptional()
  @IsNumber()
  @Min(0.01, { message: 'Valor deve ser maior que zero' })
  valor?: number;

  @IsOptional()
  @IsDateString()
  dataVencimento?: string;

  @IsOptional()
  @IsString()
  usinaId?: string;

  @IsOptional()
  @IsString()
  comprovante?: string;

  @IsOptional()
  @IsEnum(StatusContaAPagar)
  status?: StatusContaAPagar;

  @IsOptional()
  @IsDateString()
  dataPagamento?: string;
}
