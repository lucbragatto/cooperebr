import { IsEmail, IsNotEmpty, IsOptional, IsString, IsEnum, IsBoolean, IsNumber, Min, Max } from 'class-validator';
import { StatusCooperado, TipoCooperado } from '@prisma/client';

export class CreateCooperadoDto {
  @IsString()
  @IsNotEmpty()
  nomeCompleto!: string;

  @IsString()
  @IsNotEmpty()
  cpf!: string;

  @IsEmail()
  email!: string;

  @IsOptional()
  @IsString()
  telefone?: string;

  @IsOptional()
  @IsEnum(StatusCooperado)
  status?: StatusCooperado;

  @IsOptional()
  @IsEnum(TipoCooperado)
  tipoCooperado?: TipoCooperado;

  @IsOptional()
  @IsBoolean()
  termoAdesaoAceito?: boolean;

  @IsOptional()
  @IsString()
  termoAdesaoAceitoEm?: string;

  @IsOptional()
  @IsString()
  tipoPessoa?: string;

  @IsOptional()
  @IsString()
  representanteLegalNome?: string;

  @IsOptional()
  @IsString()
  representanteLegalCpf?: string;

  @IsOptional()
  @IsString()
  representanteLegalCargo?: string;

  @IsOptional()
  @IsString()
  usinaPropriaId?: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(100)
  percentualRepasse?: number;

  @IsOptional()
  @IsString()
  preferenciaCobranca?: string;
}
