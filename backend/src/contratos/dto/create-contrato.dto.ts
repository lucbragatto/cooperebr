import { IsDateString, IsEnum, IsNotEmpty, IsNumber, IsOptional, IsString, registerDecorator, ValidationOptions } from 'class-validator';
import { ModeloCobranca } from '@prisma/client';

/**
 * Sprint 5: bloqueia CREDITOS_COMPENSADOS e CREDITOS_DINAMICO enquanto
 * a engine de cobrança está em refatoração.
 * Controlado por env var BLOQUEIO_MODELOS_NAO_FIXO (default: true).
 * Remover este decorator ao concluir o Sprint 5.
 */
function IsModeloNaoBloqueado(options?: ValidationOptions) {
  return function (object: object, propertyName: string) {
    registerDecorator({
      name: 'isModeloNaoBloqueado',
      target: object.constructor,
      propertyName,
      options,
      validator: {
        validate(value: unknown) {
          if (process.env.BLOQUEIO_MODELOS_NAO_FIXO === 'false') return true;
          const bloqueados = ['CREDITOS_COMPENSADOS', 'CREDITOS_DINAMICO'];
          return !value || !bloqueados.includes(value as string);
        },
        defaultMessage() {
          return 'Modelo em refatoração (Sprint 5). Disponível em breve. Use FIXO_MENSAL por enquanto.';
        },
      },
    });
  };
}

export class CreateContratoDto {
  @IsString()
  @IsNotEmpty()
  cooperadoId!: string;

  @IsString()
  @IsNotEmpty()
  ucId!: string;

  @IsOptional()
  @IsString()
  usinaId?: string;

  @IsOptional()
  @IsString()
  planoId?: string;

  @IsDateString()
  @IsNotEmpty()
  dataInicio!: string;

  @IsOptional()
  @IsDateString()
  dataFim?: string;

  @IsNumber()
  percentualDesconto!: number;

  @IsOptional()
  @IsNumber()
  kwhContratoAnual?: number;

  @IsOptional()
  @IsNumber()
  kwhContrato?: number;

  @IsOptional()
  @IsEnum(ModeloCobranca)
  @IsModeloNaoBloqueado()
  modeloCobrancaOverride?: ModeloCobranca | null;
}
