import { IsBoolean, IsDateString, IsEmail, IsEnum, IsOptional, IsString } from 'class-validator';
import { StatusCooperado } from '@prisma/client';

export class UpdateCooperadoDto {
  @IsOptional()
  @IsString()
  nomeCompleto?: string;

  @IsOptional()
  @IsEmail()
  email?: string;

  @IsOptional()
  @IsString()
  telefone?: string;

  @IsOptional()
  @IsEnum(StatusCooperado)
  status?: StatusCooperado;

  @IsOptional()
  @IsString()
  preferenciaCobranca?: string;

  @IsOptional()
  @IsString()
  tipoCooperado?: string;

  @IsOptional()
  @IsBoolean()
  termoAdesaoAceito?: boolean;

  @IsOptional()
  @IsDateString()
  termoAdesaoAceitoEm?: string;

  @IsOptional()
  @IsDateString()
  dataInicioCreditos?: string;

  @IsOptional()
  @IsString()
  protocoloConcessionaria?: string;

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
