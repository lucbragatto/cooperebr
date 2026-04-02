import { IsString, IsOptional, IsBoolean, IsInt, IsNumber, IsEnum, IsArray, ValidateNested, Min, Max, MinLength, MaxLength } from 'class-validator';
import { Type } from 'class-transformer';

export enum TipoConvenioDto {
  CONDOMINIO = 'CONDOMINIO',
  ADMINISTRADORA = 'ADMINISTRADORA',
  ASSOCIACAO = 'ASSOCIACAO',
  SINDICATO = 'SINDICATO',
  EMPRESA = 'EMPRESA',
  CLUBE = 'CLUBE',
  OUTRO = 'OUTRO',
}

export class FaixaDto {
  @IsInt()
  @Min(0)
  minMembros: number;

  @IsOptional()
  @IsInt()
  maxMembros: number | null;

  @IsNumber()
  @Min(0)
  @Max(100)
  descontoMembros: number;

  @IsNumber()
  @Min(0)
  @Max(100)
  descontoConveniado: number;
}

export class ConfigBeneficioDto {
  @IsOptional()
  @IsString()
  criterio?: string;

  @IsOptional()
  @IsString()
  efeitoMudancaFaixa?: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(100)
  maxAcumuloConveniado?: number;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => FaixaDto)
  faixas: FaixaDto[];
}

export class CreateConvenioDto {
  @IsString()
  @MinLength(3)
  @MaxLength(200)
  nome: string;

  @IsEnum(TipoConvenioDto)
  tipo: TipoConvenioDto;

  @IsOptional()
  @IsString()
  cnpj?: string;

  @IsOptional()
  @IsString()
  email?: string;

  @IsOptional()
  @IsString()
  telefone?: string;

  @IsOptional()
  @IsString()
  conveniadoId?: string;

  @IsOptional()
  @IsString()
  conveniadoNome?: string;

  @IsOptional()
  @IsString()
  conveniadoCpf?: string;

  @IsOptional()
  @IsString()
  conveniadoEmail?: string;

  @IsOptional()
  @IsString()
  conveniadoTelefone?: string;

  @IsOptional()
  @IsString()
  condominioId?: string;

  @IsOptional()
  @IsString()
  administradoraId?: string;

  @IsOptional()
  @ValidateNested()
  @Type(() => ConfigBeneficioDto)
  configBeneficio?: ConfigBeneficioDto;

  @IsOptional()
  @IsBoolean()
  registrarComoIndicacao?: boolean;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(28)
  diaEnvioRelatorio?: number;

  @IsOptional()
  @IsBoolean()
  criarCooperadoSemUc?: boolean;
}

export enum StatusConvenioDto {
  ATIVO = 'ATIVO',
  SUSPENSO = 'SUSPENSO',
  ENCERRADO = 'ENCERRADO',
}

export class UpdateConvenioDto {
  @IsOptional()
  @IsString()
  @MinLength(3)
  @MaxLength(200)
  nome?: string;

  @IsOptional()
  @IsEnum(TipoConvenioDto)
  tipo?: TipoConvenioDto;

  @IsOptional()
  @IsString()
  cnpj?: string;

  @IsOptional()
  @IsString()
  email?: string;

  @IsOptional()
  @IsString()
  telefone?: string;

  @IsOptional()
  @IsString()
  conveniadoId?: string | null;

  @IsOptional()
  @IsString()
  conveniadoNome?: string;

  @IsOptional()
  @IsString()
  conveniadoCpf?: string;

  @IsOptional()
  @IsString()
  conveniadoEmail?: string;

  @IsOptional()
  @IsString()
  conveniadoTelefone?: string;

  @IsOptional()
  @IsString()
  condominioId?: string | null;

  @IsOptional()
  @IsString()
  administradoraId?: string | null;

  @IsOptional()
  @ValidateNested()
  @Type(() => ConfigBeneficioDto)
  configBeneficio?: ConfigBeneficioDto;

  @IsOptional()
  @IsBoolean()
  registrarComoIndicacao?: boolean;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(28)
  diaEnvioRelatorio?: number;

  @IsOptional()
  @IsEnum(StatusConvenioDto)
  status?: StatusConvenioDto;
}

export class AddMembroDto {
  @IsString()
  cooperadoId: string;

  @IsOptional()
  @IsString()
  matricula?: string;
}

export class UpdateMembroDto {
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(100)
  descontoOverride?: number | null;

  @IsOptional()
  @IsString()
  matricula?: string;
}
