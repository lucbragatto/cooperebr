import { IsEmail, IsNotEmpty, IsOptional, IsString, IsEnum, IsBoolean } from 'class-validator';
import { StatusCooperado } from '@prisma/client';

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
  @IsString()
  tipoCooperado?: string;

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
}
