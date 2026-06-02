import { IsEmail, IsNotEmpty, IsOptional, IsString, IsEnum, IsBoolean, IsNumber, Min, Max } from 'class-validator';
import { StatusCooperado, TipoCooperado } from '@prisma/client';

export class CreateCooperadoDto {
  @IsString()
  @IsNotEmpty()
  nomeCompleto!: string;

  @IsString()
  @IsNotEmpty()
  cpf!: string;

  @IsEmail()
  email!: string;

  @IsOptional()
  @IsString()
  telefone?: string;

  @IsOptional()
  @IsEnum(StatusCooperado)
  status?: StatusCooperado;

  @IsOptional()
  @IsEnum(TipoCooperado)
  tipoCooperado?: TipoCooperado;

  @IsOptional()
  @IsBoolean()
  termoAdesaoAceito?: boolean;

  @IsOptional()
  @IsString()
  termoAdesaoAceitoEm?: string;

  @IsOptional()
  @IsString()
  tipoPessoa?: string;

  @IsOptional()
  @IsString()
  representanteLegalNome?: string;

  @IsOptional()
  @IsString()
  representanteLegalCpf?: string;

  @IsOptional()
  @IsString()
  representanteLegalCargo?: string;

  @IsOptional()
  @IsString()
  cooperativaId?: string;

  @IsOptional()
  @IsString()
  usinaPropriaId?: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(100)
  percentualRepasse?: number;

  @IsOptional()
  @IsString()
  preferenciaCobranca?: string;

  /**
   * D-novo-CAD-CUSTEADO-FATURA (02/06/2026) — Marca cooperado como ambiente
   * de teste. Ativado pelo toggle "Modo teste" no Wizard quando cadastrado
   * SEM fatura. Reusa a flag existente Cooperado.ambienteTeste (já bypassa
   * validação de numeroUC na ativação — cooperados.service.ts:720).
   *
   * Bloqueia ativação como ATIVO (regra existente). Não entra em billing
   * real. Catalogado D-novo-SEC-AMBIENTE-TESTE (P3) — futuramente gatear
   * este campo só fora de produção / auditável.
   */
  @IsOptional()
  @IsBoolean()
  ambienteTeste?: boolean;
}
