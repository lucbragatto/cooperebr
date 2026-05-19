import {
  ArrayUnique,
  IsArray,
  IsBoolean,
  IsEnum,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  MaxLength,
  Min,
} from 'class-validator';
import { ClasseGdAplicada } from '@prisma/client';

export class UpdatePoliticaAlocacaoDto {
  @IsOptional()
  @IsString()
  @MaxLength(120)
  nome?: string;

  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  faixaMin?: number;

  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  faixaMax?: number | null;

  @IsOptional()
  @IsEnum(ClasseGdAplicada)
  classeGdPreferida?: ClasseGdAplicada | null;

  @IsOptional()
  @IsArray()
  @ArrayUnique()
  @IsString({ each: true })
  usinasElegiveis?: string[];

  @IsOptional()
  @IsInt()
  @Min(0)
  prioridade?: number;

  @IsOptional()
  @IsBoolean()
  ativa?: boolean;
}
