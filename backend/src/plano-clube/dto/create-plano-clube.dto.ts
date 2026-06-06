/**
 * Sprint Onboarding Bloco 0 Fatia 0.1 (06/06/2026).
 *
 * DTO de criação de PlanoClube. cooperativaId vem do JWT (ou body pra
 * SUPER_ADMIN cross-tenant) — controller resolve.
 */
import { IsBoolean, IsNumber, IsOptional, IsString, Max, MaxLength, Min, MinLength } from 'class-validator';

export class CreatePlanoClubeDto {
  @IsString()
  @MinLength(2)
  @MaxLength(120)
  nome!: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  descricao?: string;

  /**
   * Valor mensal R$. Aceita 0 quando `cobra=false` (clube grátis).
   * Quando `cobra=true`, service exige > 0 (validação semântica).
   */
  @IsNumber({ maxDecimalPlaces: 2 }, { message: 'valorMensal deve ter no máximo 2 casas decimais' })
  @Min(0, { message: 'valorMensal não pode ser negativo' })
  @Max(999999.99, { message: 'valorMensal excede limite (999999.99)' })
  valorMensal!: number;

  /**
   * Se true (default), gera linha "valorMensalidadeClube" na cobrança
   * (individual ou consolidada da empresa). Se false, clube grátis: matricula
   * sem cobrar.
   */
  @IsOptional()
  @IsBoolean()
  cobra?: boolean;

  @IsOptional()
  @IsBoolean()
  ativo?: boolean;

  /**
   * Tier mínimo opcional ('BRONZE' | 'PRATA' | 'OURO' | 'DIAMANTE').
   * Vínculo com ProgressaoClube fica pra sprints futuros — campo já provisionado.
   */
  @IsOptional()
  @IsString()
  @MaxLength(20)
  tierMinimo?: string;

  /**
   * Override de tenant (SUPER_ADMIN only — controller valida).
   */
  @IsOptional()
  @IsString()
  cooperativaId?: string;
}
