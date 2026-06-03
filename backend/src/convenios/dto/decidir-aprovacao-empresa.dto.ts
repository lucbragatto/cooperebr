import { IsEnum, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

/**
 * Sprint Convite-Convênio Fatia 3 (03/06/2026) — DTO da empresa via magic link.
 * `decisao` é o veredito; `motivo` obrigatório quando REJEITAR (mínimo 2 chars).
 */
export enum DecisaoAprovacaoEmpresa {
  APROVAR = 'APROVAR',
  REJEITAR = 'REJEITAR',
}

export class DecidirAprovacaoEmpresaDto {
  @IsEnum(DecisaoAprovacaoEmpresa)
  decisao!: DecisaoAprovacaoEmpresa;

  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(500)
  motivo?: string;
}
