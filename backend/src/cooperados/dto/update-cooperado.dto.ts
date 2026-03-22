import { IsBoolean, IsDateString, IsEmail, IsEnum, IsNumber, IsOptional, IsString, Min, Max } from 'class-validator';
import { StatusCooperado, TipoCooperado } from '@prisma/client';

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
  @IsEnum(TipoCooperado)
  tipoCooperado?: TipoCooperado;

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

  @IsOptional()
  @IsString()
  usinaPropriaId?: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(100)
  percentualRepasse?: number;
}
