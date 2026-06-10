/**
 * Sprint Clube P1 — Fase 1.5 Bloco 4 (10/06/2026).
 *
 * DTO formal pra PUT /cooper-token/admin/config. Substitui o body inline
 * que tinha so 8 campos (controller:322). Agora cobre os 19 campos
 * editaveis (8 antigos + 8 taxas Bloco 2 + 3 oxidacao Bloco 3).
 *
 * `oxidacaoAtivadaEm` NAO esta no DTO — eh carimbado/limpo automaticamente
 * pelo service em `upsertConfig` quando `oxidacaoPercMes` cruza zero.
 *
 * Class-validator + IsOptional pra permitir update parcial; @Min(0) em
 * todos os monetarios; @Max(100) nos percentuais.
 */
import { IsBoolean, IsInt, IsNumber, IsOptional, IsString, Max, Min } from 'class-validator';

export class UpsertCooperTokenConfigDto {
  // ── Geral ──────────────────────────────────────────────────────────
  @IsOptional()
  @IsString()
  modoGeracao?: string;

  @IsOptional()
  @IsString()
  modeloVida?: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  limiteTokenMensal?: number | null;

  @IsOptional()
  @IsNumber()
  @Min(0)
  valorTokenReais?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(100)
  descontoMaxPerc?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  bonusIndicacao?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  tetoCoop?: number | null;

  @IsOptional()
  @IsBoolean()
  ativo?: boolean;

  // ── Taxa de Operacao (Bloco 2) ─────────────────────────────────────
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(100)
  taxaEmissaoPerc?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  taxaEmissaoFixa?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(100)
  taxaQrPerc?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  taxaQrFixa?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(100)
  taxaTransferenciaPerc?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  taxaTransferenciaFixa?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(100)
  taxaResgatePerc?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  taxaResgateFixa?: number;

  // ── Oxidacao DECAY_CONTINUO (Bloco 3) — gate juridico via env ─────
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(100)
  oxidacaoPercMes?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  oxidacaoPeriodoGracaDias?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  oxidacaoPiso?: number;
}
