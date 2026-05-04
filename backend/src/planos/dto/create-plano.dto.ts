import { IsNotEmpty, IsString, IsNumber, IsOptional, IsBoolean, IsIn, IsArray, Min, Max, ValidateIf, ArrayNotEmpty, registerDecorator, ValidationOptions, ValidationArguments } from 'class-validator';

/**
 * V2 (Fase B): descontoPromocional > descontoBase.
 * Promoção que piora o desconto base não faz sentido de negócio.
 */
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

  // V1: Se temPromocao=true, descontoPromocional > 0 obrigatório.
  // V2: descontoPromocional > descontoBase (faz sentido de negócio).
  @ValidateIf((o) => o.temPromocao === true)
  @IsNumber({}, { message: 'Promoção ativada exige descontoPromocional numérico' })
  @Min(1, { message: 'Promoção ativada exige descontoPromocional > 0' })
  @IsPromoMaiorQueBase()
  descontoPromocional?: number;

  // V1 (parte 2): Se temPromocao=true, mesesPromocao > 0 obrigatório.
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
  @IsOptional() @IsIn(['KWH_CHEIO', 'SEM_TRIBUTO'], { message: 'baseCalculo COM_ICMS/CUSTOM ainda não disponível — fórmula não implementada (Sprint 5 v1)' })
  baseCalculo?: 'KWH_CHEIO' | 'SEM_TRIBUTO' | 'COM_ICMS' | 'CUSTOM';

  // V3: Se baseCalculo=CUSTOM, componentesCustom não pode ser vazio.
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
  // Apenas SUPER_ADMIN pode definir explicitamente. ADMIN tem este campo
  // automaticamente preenchido com sua cooperativa pelo service (ignora valor enviado).
  // null = plano global (visível a todos os parceiros).
  @IsOptional() @IsString()
  cooperativaId?: string | null;
}
