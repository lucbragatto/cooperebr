import { IsString, MaxLength, MinLength } from 'class-validator';

/**
 * Sprint D2.1 v2 (16/06/2026) — DTO de criação de versão nova do
 * disclaimer. Cliente envia SÓ TEXTO. Versão é auto-gerada server-side
 * (Decisão Luciano Q2: elimina colisão NULL no @@unique + validação
 * manual). Multi-tenant: cooperativaId NÃO vem do body — global force-set
 * por @Roles(SUPER_ADMIN); tenant override force-set pelo JWT do ADMIN.
 */
export class CriarDisclaimerDto {
  @IsString()
  @MinLength(50)
  @MaxLength(5000)
  texto!: string;
}
