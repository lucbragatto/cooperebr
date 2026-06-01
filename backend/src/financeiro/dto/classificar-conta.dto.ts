import { IsEnum, IsOptional, IsString, MaxLength } from 'class-validator';
import { NaturezaContabil, NaturezaCooperativa } from '@prisma/client';

/**
 * D-novo-CT-CT.8 (01/06/2026) — Classificação de conta do plano segregado.
 *
 * Os 3 campos são INDEPENDENTES e OPCIONAIS — UI pode patch só um deles
 * (ex: só naturezaCooperativa). Service não sobrescreve com `undefined`.
 *
 * Permitir `null` em string vazia? Não — pra "limpar" classificação, mandar
 * null explícito (ou omitir). MaxLength 300 espelha o `@db.VarChar` do schema.
 */
export class ClassificarContaDto {
  @IsOptional()
  @IsEnum(NaturezaCooperativa)
  naturezaCooperativa?: NaturezaCooperativa | null;

  @IsOptional()
  @IsEnum(NaturezaContabil)
  naturezaContabil?: NaturezaContabil | null;

  @IsOptional()
  @IsString()
  @MaxLength(300)
  fundamentoLegal?: string | null;
}
