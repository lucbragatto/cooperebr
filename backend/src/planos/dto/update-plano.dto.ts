import { IsOptional, IsString, IsNumber, IsBoolean, IsIn, IsArray, Min, Max, ValidateIf, ArrayNotEmpty, registerDecorator, ValidationOptions, ValidationArguments } from 'class-validator';

/** V2 (Fase B): descontoPromocional > descontoBase quando temPromocao=true. */
function IsPromoMaiorQueBase(validationOptions?: ValidationOptions) {
  return function (object: any, propertyName: string) {
    registerDecorator({
      name: 'isPromoMaiorQueBase',
      target: object.constructor,
      propertyName,
      options: validationOptions,
      validator: {
        validate(value: any, args: ValidationArguments) {
          const obj = args.object as any;
          if (obj.temPromocao !== true) return true;
          if (value === undefined || value === null) return true;
          const base = Number(obj.descontoBase ?? 0);
          return Number(value) > base;
        },
        defaultMessage(args: ValidationArguments) {
          const obj = args.object as any;
          return `descontoPromocional (${args.value}) deve ser maior que descontoBase (${obj.descontoBase})`;
        },
      },
    });
  };
}

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

  // V1+V2: idêntico ao Create. Aplicam apenas se temPromocao=true vier no payload.
  @ValidateIf((o) => o.temPromocao === true)
  @IsNumber({}, { message: 'Promoção ativada exige descontoPromocional numérico' })
  @Min(1, { message: 'Promoção ativada exige descontoPromocional > 0' })
  @IsPromoMaiorQueBase()
  descontoPromocional?: number;

  @ValidateIf((o) => o.temPromocao === true)
  @IsNumber({}, { message: 'Promoção ativada exige mesesPromocao numérico' })
  @Min(1, { message: 'Promoção ativada exige mesesPromocao > 0' })
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

  // V3: idêntico ao Create.
  @ValidateIf((o) => o.baseCalculo === 'CUSTOM')
  @IsArray()
  @ArrayNotEmpty({ message: 'baseCalculo=CUSTOM exige componentesCustom não-vazio' })
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
  // Apenas SUPER_ADMIN pode alterar. Tentativa de mudança por ADMIN gera ForbiddenException.
  @IsOptional() @IsString()
  cooperativaId?: string | null;
}
