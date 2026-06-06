/**
 * Sprint Onboarding Bloco 0 Fatia 0.1 (06/06/2026).
 *
 * DTO de update de PlanoClube. cooperativaId NÃO é alterável aqui (defesa
 * anti-spoof multi-tenant — service ignora qualquer body.cooperativaId em
 * update).
 */
import { IsBoolean, IsNumber, IsOptional, IsString, Max, MaxLength, Min, MinLength } from 'class-validator';

export class UpdatePlanoClubeDto {
  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(120)
  nome?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  descricao?: string;

  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @Max(999999.99)
  valorMensal?: number;

  @IsOptional()
  @IsBoolean()
  cobra?: boolean;

  @IsOptional()
  @IsBoolean()
  ativo?: boolean;

  @IsOptional()
  @IsString()
  @MaxLength(20)
  tierMinimo?: string;
}
