import { IsBoolean, IsDateString, IsEnum, IsOptional, IsString, MinLength } from 'class-validator';
import { FluxoConvenio, TipoBeneficioConvenio } from '@prisma/client';

/**
 * D-novo-BR-CT CT.2 — DTO de criação de Convenio.
 * cooperativaId NÃO vem do body (vem do JWT no controller — anti body-injection).
 */
export class CreateConvenioDto {
  @IsString()
  @MinLength(3)
  nome!: string;

  @IsString()
  @IsOptional()
  descricao?: string;

  /**
   * MVP CT.2 — só ENERGIA_SCEE liberado em produção (decisão Luciano 17/05).
   * Outros tipos = stub schema-only.
   */
  @IsEnum(TipoBeneficioConvenio)
  @IsOptional()
  tipoBeneficio?: TipoBeneficioConvenio;

  @IsEnum(FluxoConvenio)
  fluxoFinanceiro!: FluxoConvenio;

  /**
   * Texto livre citando fundamento legal + classificação fiscal.
   * Ex: "Ato Auxiliar Art. 88 Lei 5.764/71 + STF Tema 536".
   */
  @IsString()
  @MinLength(10)
  classificacaoFiscal!: string;

  @IsDateString()
  vigenciaInicio!: string;

  @IsDateString()
  @IsOptional()
  vigenciaFim?: string;

  @IsString()
  @IsOptional()
  observacoes?: string;
}
