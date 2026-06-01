import { IsString, IsOptional, IsBoolean, IsInt, IsNumber, IsEnum, IsArray, ValidateNested, Min, Max, MinLength, MaxLength, IsDateString } from 'class-validator';
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

/** D-FISCAL-2.3 — enums fiscais reutilizados do Prisma (mirror) */
export enum NaturezaAtoCooperativoDto {
  PROPRIO = 'PROPRIO',
  AUXILIAR = 'AUXILIAR',
  NAO_COOPERATIVO = 'NAO_COOPERATIVO',
}

export enum FluxoFinanceiroDto {
  INGRESSO_CUSTEIO_AUXILIAR = 'INGRESSO_CUSTEIO_AUXILIAR',
  REPASSE_PROVEDOR_EXTERNO = 'REPASSE_PROVEDOR_EXTERNO',
  CUSTO_OPERACIONAL_INTERNO = 'CUSTO_OPERACIONAL_INTERNO',
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

  @IsOptional()
  @IsString()
  tierMinimoClube?: string;

  @IsOptional()
  @IsString()
  modalidade?: string;

  @IsOptional()
  @IsNumber()
  taxaAprovacaoSisgd?: number;

  // D-FISCAL-2.3 — bloco fiscal opcional na criação (admin pode marcar já no /novo)
  @IsOptional()
  @IsBoolean()
  geraLancamentoContabil?: boolean;

  @IsOptional()
  @IsEnum(NaturezaAtoCooperativoDto)
  naturezaAtoCooperativo?: NaturezaAtoCooperativoDto;

  @IsOptional()
  @IsEnum(FluxoFinanceiroDto)
  fluxoFinanceiro?: FluxoFinanceiroDto;

  @IsOptional()
  @IsString()
  @MaxLength(300)
  classificacaoFiscal?: string;

  @IsOptional()
  @IsDateString({}, { message: 'vigenciaInicio deve ser ISO date (YYYY-MM-DD)' })
  vigenciaInicio?: string;

  @IsOptional()
  @IsDateString({}, { message: 'vigenciaFim deve ser ISO date (YYYY-MM-DD)' })
  vigenciaFim?: string;
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

  @IsOptional()
  @IsString()
  tierMinimoClube?: string | null;

  @IsOptional()
  @IsString()
  modalidade?: string;

  @IsOptional()
  @IsNumber()
  taxaAprovacaoSisgd?: number | null;

  // D-FISCAL-2.3 — bloco fiscal editável
  @IsOptional()
  @IsBoolean()
  geraLancamentoContabil?: boolean;

  @IsOptional()
  naturezaAtoCooperativo?: NaturezaAtoCooperativoDto | null;

  @IsOptional()
  fluxoFinanceiro?: FluxoFinanceiroDto | null;

  @IsOptional()
  @MaxLength(300)
  classificacaoFiscal?: string | null;

  @IsOptional()
  vigenciaInicio?: string | null;

  @IsOptional()
  vigenciaFim?: string | null;
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
