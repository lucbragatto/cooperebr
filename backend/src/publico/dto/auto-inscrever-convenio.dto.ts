import {
  IsEmail,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  Length,
  Min,
} from 'class-validator';

/**
 * Sprint Convite-Convênio Fatia 2 (03/06/2026) — DTO da auto-inscrição pública.
 *
 * Body MÍNIMO de quem cadastra via link `?conv={convenioId}` divulgado pela
 * empresa pagadora. Sem fatura/UC/planoId — auto-inscrição custeada não exige
 * fatura (admin/empresa anexa depois se for SEM_UC).
 *
 * `cooperativaId` + `convenioId` são obrigatórios pra validar multi-tenant
 * cross-check ANTES de criar Cooperado (endpoint é @Public — não há JWT).
 *
 * `consumoMedioKwh` opcional: usado pra quota energética em CONSUMO_REAL
 * (estimativa de alocação prevista). Default 0 = sem quota energética.
 */
export class AutoInscreverConvenioDto {
  @IsString()
  @IsNotEmpty()
  cooperativaId!: string;

  @IsString()
  @IsNotEmpty()
  convenioId!: string;

  @IsString()
  @IsNotEmpty()
  @Length(2, 200)
  nome!: string;

  @IsString()
  @IsNotEmpty()
  @Length(11, 14) // CPF 11 dígitos ou formatado xxx.xxx.xxx-xx
  cpf!: string;

  @IsEmail()
  email!: string;

  @IsString()
  @IsNotEmpty()
  telefone!: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  consumoMedioKwh?: number;
}
