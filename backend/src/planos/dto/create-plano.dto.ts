import { IsNotEmpty, IsString, IsNumber, IsOptional, IsBoolean, IsIn, IsArray, Min, Max } from 'class-validator';

export class CreatePlanoDto {
  @IsNotEmpty() @IsString()
  nome!: string;

  @IsOptional() @IsString()
  descricao?: string;

  @IsNotEmpty() @IsIn(['FIXO_MENSAL', 'CREDITOS_COMPENSADOS', 'CREDITOS_DINAMICO'])
  modeloCobranca!: 'FIXO_MENSAL' | 'CREDITOS_COMPENSADOS' | 'CREDITOS_DINAMICO';

  @IsNotEmpty() @IsNumber() @Min(1, { message: 'Desconto base deve ser pelo menos 1%' }) @Max(100)
  descontoBase!: number;

  @IsOptional() @IsBoolean()
  temPromocao?: boolean;

  @IsOptional() @IsNumber()
  descontoPromocional?: number;

  @IsOptional() @IsNumber()
  mesesPromocao?: number;

  @IsOptional()
  @IsIn(['APLICAR_SOBRE_BASE', 'ABATER_DA_CHEIA'])
  tipoDesconto?: 'APLICAR_SOBRE_BASE' | 'ABATER_DA_CHEIA';

  @IsOptional() @IsBoolean()
  publico?: boolean;

  @IsOptional() @IsBoolean()
  ativo?: boolean;

  @IsOptional() @IsIn(['PADRAO', 'CAMPANHA'])
  tipoCampanha?: 'PADRAO' | 'CAMPANHA';

  @IsOptional() @IsString()
  dataInicioVigencia?: string;

  @IsOptional() @IsString()
  dataFimVigencia?: string;

  // Base de Cálculo
  @IsOptional() @IsIn(['KWH_CHEIO', 'SEM_TRIBUTO', 'COM_ICMS', 'CUSTOM'])
  baseCalculo?: 'KWH_CHEIO' | 'SEM_TRIBUTO' | 'COM_ICMS' | 'CUSTOM';

  @IsOptional() @IsArray()
  componentesCustom?: string[];

  @IsOptional() @IsIn(['ULTIMA_FATURA', 'MEDIA_3M', 'MEDIA_6M', 'MEDIA_12M'])
  referenciaValor?: 'ULTIMA_FATURA' | 'MEDIA_3M' | 'MEDIA_6M' | 'MEDIA_12M';

  @IsOptional() @IsNumber()
  fatorIncremento?: number;

  @IsOptional() @IsBoolean()
  mostrarDiscriminado?: boolean;

  // CooperToken
  @IsOptional() @IsBoolean()
  cooperTokenAtivo?: boolean;

  @IsOptional() @IsIn(['OPCAO_A', 'OPCAO_B', 'AMBAS'])
  tokenOpcaoCooperado?: 'OPCAO_A' | 'OPCAO_B' | 'AMBAS';

  @IsOptional() @IsIn(['FIXO', 'KWH_APURADO'])
  tokenValorTipo?: 'FIXO' | 'KWH_APURADO';

  @IsOptional() @IsNumber()
  tokenValorFixo?: number;

  @IsOptional() @IsNumber()
  tokenDescontoMaxPerc?: number;

  @IsOptional() @IsNumber()
  tokenExpiracaoMeses?: number;

  // Multi-tenant (Fase A)
  // Apenas SUPER_ADMIN pode definir explicitamente. ADMIN tem este campo
  // automaticamente preenchido com sua cooperativa pelo service (ignora valor enviado).
  // null = plano global (visível a todos os parceiros).
  @IsOptional() @IsString()
  cooperativaId?: string | null;
}
