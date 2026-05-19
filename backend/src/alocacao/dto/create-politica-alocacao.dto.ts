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

export class CreatePoliticaAlocacaoDto {
  @IsString()
  @MaxLength(120)
  nome!: string;

  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  faixaMin!: number;

  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  faixaMax?: number | null;

  @IsOptional()
  @IsEnum(ClasseGdAplicada, { message: 'classeGdPreferida deve ser GD_I, GD_II ou GD_III.' })
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
