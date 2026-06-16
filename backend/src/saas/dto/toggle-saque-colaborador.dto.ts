import { IsBoolean } from 'class-validator';

/**
 * Sprint D2 (16/06/2026) — DTO do toggle Saque PIX Colaborador.
 *
 * Reviewer security P1: body inline {ativo: boolean} sem DTO permitia
 * type coercion silenciosa (ex: {ativo: "true"} ou {ativo: 1} passavam
 * pelo ValidationPipe e viravam false no service via `=== true`,
 * resultando em no-op invisível). Esse DTO força @IsBoolean estrito.
 */
export class ToggleSaqueColaboradorDto {
  @IsBoolean()
  ativo!: boolean;
}
