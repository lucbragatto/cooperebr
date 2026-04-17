import { IsOptional, IsString, IsNumber, IsBoolean, IsIn, IsArray, Min, Max } from 'class-validator';

export class UpdatePlanoDto {
  @IsOptional() @IsString()
  nome?: string;

  @IsOptional() @IsString()
  descricao?: string;

  @IsOptional() @IsIn(['FIXO_MENSAL', 'CREDITOS_COMPENSADOS', 'CREDITOS_DINAMICO'])
  modeloCobranca?: 'FIXO_MENSAL' | 'CREDITOS_COMPENSADOS' | 'CREDITOS_DINAMICO';

  @IsOptional() @IsNumber() @Min(1, { message: 'Desconto base deve ser pelo menos 1%' }) @Max(100)
  descontoBase?: number;

  @IsOptional() @IsBoolean()
  temPromocao?: boolean;
  descontoPromocional?: number;
  mesesPromocao?: number;
  publico?: boolean;
  ativo?: boolean;
  tipoCampanha?: 'PADRAO' | 'CAMPANHA';
  dataInicioVigencia?: string;
  dataFimVigencia?: string;

  // Base de Cálculo
  baseCalculo?: 'KWH_CHEIO' | 'SEM_TRIBUTO' | 'COM_ICMS' | 'CUSTOM';
  componentesCustom?: string[];
  referenciaValor?: 'ULTIMA_FATURA' | 'MEDIA_3M' | 'MEDIA_6M' | 'MEDIA_12M';
  fatorIncremento?: number;
  mostrarDiscriminado?: boolean;

  // CooperToken
  cooperTokenAtivo?: boolean;
  tokenOpcaoCooperado?: 'OPCAO_A' | 'OPCAO_B' | 'AMBAS';
  tokenValorTipo?: 'FIXO' | 'KWH_APURADO';
  tokenValorFixo?: number;
  tokenDescontoMaxPerc?: number;
  tokenExpiracaoMeses?: number;
}
