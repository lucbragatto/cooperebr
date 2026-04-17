import { IsNotEmpty, IsString, IsEnum, IsNumber, IsDateString, IsOptional, Min } from 'class-validator';
import { CategoriaContaAPagar } from '@prisma/client';

export class CreateContaAPagarDto {
  @IsNotEmpty()
  @IsString()
  descricao!: string;

  @IsEnum(CategoriaContaAPagar)
  categoria!: CategoriaContaAPagar;

  @IsNumber()
  @Min(0.01, { message: 'Valor deve ser maior que zero' })
  valor!: number;

  @IsDateString()
  dataVencimento!: string;

  @IsOptional()
  @IsString()
  usinaId?: string;

  @IsOptional()
  @IsString()
  comprovante?: string;
}
