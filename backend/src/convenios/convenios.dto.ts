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

/** D-FISCAL-2.4.4e — enums Caso 1 (custeio) mirror do Prisma. */
export enum PagadorConvenioDto {
  CADA_MEMBRO = 'CADA_MEMBRO',
  EMPRESA = 'EMPRESA',
}

export enum BaseCobrancaCusteioDto {
  CONSUMO_REAL = 'CONSUMO_REAL',
  ALOCACAO_FIXA = 'ALOCACAO_FIXA',
}

/** D-novo-CT-TARIFA-FIXA-EMPRESA (02/06/2026) — modo de cobrança da empresa */
export enum TipoTarifaEmpresaDto {
  PERCENTUAL_DESCONTO = 'PERCENTUAL_DESCONTO',
  VALOR_FIXO = 'VALOR_FIXO',
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

  // D-FISCAL-2.4.4e — bloco de custeio (Caso 1: empresa paga total).
  // Quando pagador=EMPRESA, pagadorCooperadoId + baseCobrancaCusteio são
  // obrigatórios (validados no service). Default CADA_MEMBRO mantém
  // backward-compat com os 2 convênios legados MLM (Hangar/Moradas).
  @IsOptional()
  @IsEnum(PagadorConvenioDto)
  pagador?: PagadorConvenioDto;

  @IsOptional()
  @IsString()
  pagadorCooperadoId?: string;

  @IsOptional()
  @IsEnum(BaseCobrancaCusteioDto)
  baseCobrancaCusteio?: BaseCobrancaCusteioDto;

  @IsOptional()
  @IsInt()
  @Min(1)
  kwhAlocadoMensal?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(100)
  descontoKwhCusteio?: number;

  // D-novo-CT-TARIFA-FIXA-EMPRESA (02/06/2026)
  @IsOptional()
  @IsEnum(TipoTarifaEmpresaDto)
  tipoTarifaEmpresa?: TipoTarifaEmpresaDto;

  @IsOptional()
  @IsNumber()
  @Min(0)
  tarifaFixaKwhEmpresa?: number;

  // Sprint Onboarding Bloco 0 Fatia 0.2 (06/06/2026) — Plano de Clube vinculado.
  // null/vazio = convênio sem clube. Quando presente, empresa paga mensalidade
  // do clube de todos os membros ativos (adesão obrigatória — funcionário de
  // conveniado). Service valida que pertence ao tenant e está ativo.
  @IsOptional()
  @IsString()
  planoClubeId?: string;
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

  // D-FISCAL-2.4.4e — bloco de custeio editável (idem CreateConvenioDto).
  @IsOptional()
  @IsEnum(PagadorConvenioDto)
  pagador?: PagadorConvenioDto;

  @IsOptional()
  pagadorCooperadoId?: string | null;

  @IsOptional()
  baseCobrancaCusteio?: BaseCobrancaCusteioDto | null;

  @IsOptional()
  @IsInt()
  @Min(1)
  kwhAlocadoMensal?: number | null;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(100)
  descontoKwhCusteio?: number | null;

  // D-novo-CT-TARIFA-FIXA-EMPRESA (02/06/2026)
  @IsOptional()
  @IsEnum(TipoTarifaEmpresaDto)
  tipoTarifaEmpresa?: TipoTarifaEmpresaDto | null;

  @IsOptional()
  @IsNumber()
  @Min(0)
  tarifaFixaKwhEmpresa?: number | null;

  // Sprint Onboarding Bloco 0 Fatia 0.2 (06/06/2026) — Plano de Clube vinculado.
  // null/vazio explícito desvincula. Service valida tenant/ativo.
  @IsOptional()
  @IsString()
  planoClubeId?: string | null;
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
