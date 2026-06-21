import { IsEmail, IsNotEmpty, IsOptional, IsString, IsEnum, IsBoolean, IsNumber, MaxLength, Matches, Min, Max } from 'class-validator';
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

  /**
   * Sprint Hardening Tenant-Spoof (20/06/2026) — aceito por compat
   * (frontend M44 ainda envia), IGNORADO server-side. Tenant é resolvido
   * a partir do JWT (`req.user.cooperativaId`). Para SUPER_ADMIN operar
   * cross-tenant, usar `cooperativaIdAlvo` (campo explícito + auditável).
   */
  @IsOptional()
  @IsString()
  cooperativaId?: string;

  /**
   * Sprint Hardening Tenant-Spoof (20/06/2026) — exclusivo SUPER_ADMIN
   * cross-tenant. Para qualquer outro perfil, é IGNORADO. Quando setado
   * e o perfil é SUPER_ADMIN, sobrescreve o tenant de criação.
   * Validação de formato CUID + existência da Cooperativa.ativo=true
   * é feita no controller antes de qualquer uso (P1 reviewers 20/06).
   */
  @IsOptional()
  @IsString()
  @Matches(/^c[a-z0-9]{24}$/, { message: 'cooperativaIdAlvo deve ser um CUID válido' })
  cooperativaIdAlvo?: string;

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

  /**
   * Sprint Convênio-Token-Cooperado (20/06/2026) — slice "recebe créditos GD
   * como DADO". Cliente declara/admin marca que já recebe créditos de
   * geração distribuída (outra cooperativa/usina/gerador). NÃO bloqueia
   * cadastro — é dado defensivo anti-double-count SCEE + insumo pro futuro
   * fluxo de migração (Fase 3 do convênio).
   */
  @IsOptional()
  @IsBoolean()
  jaRecebeCreditosGd?: boolean;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  fornecedorGdAtual?: string;
}
