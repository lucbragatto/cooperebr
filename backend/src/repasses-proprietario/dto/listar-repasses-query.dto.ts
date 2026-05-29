import { IsEnum, IsISO8601, IsIn, IsOptional, IsString } from 'class-validator';
import { StatusRepasseProprietario } from '@prisma/client';

export class ListarRepassesQueryDto {
  @IsOptional()
  @IsEnum(StatusRepasseProprietario)
  status?: StatusRepasseProprietario;

  @IsOptional()
  @IsString()
  usinaId?: string;

  @IsOptional()
  @IsISO8601()
  periodoInicio?: string;

  @IsOptional()
  @IsISO8601()
  periodoFim?: string;

  /** Ordenação: 'periodoFim:desc' (default) | 'periodoFim:asc' | 'createdAt:desc' | 'createdAt:asc' */
  @IsOptional()
  @IsIn(['periodoFim:desc', 'periodoFim:asc', 'createdAt:desc', 'createdAt:asc'])
  ordenacao?: string;
}
