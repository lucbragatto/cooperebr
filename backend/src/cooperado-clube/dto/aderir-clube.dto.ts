/**
 * Sprint Onboarding Bloco 0 Fatia 0.3 (06/06/2026).
 *
 * DTO de adesão opt-in ao Clube (cooperado comum / sem-UC). Admin marca
 * a adesão; o cooperado em si NÃO faz isso pelo portal (decisão Luciano:
 * Fatia 0.3 é só campo + endpoint, sem auto-inscrição).
 */
import { IsString, MinLength } from 'class-validator';

export class AderirClubeDto {
  /** ID do PlanoClube ATIVO do mesmo tenant do cooperado. */
  @IsString()
  @MinLength(1)
  planoClubeId!: string;
}
