/**
 * D-novo-BH (M37, 29/05/2026) — DTO de proposta/lançamento de despesa operacional.
 *
 * Usado por:
 *   - PROPRIETARIO: cria com statusAprovacao=PROPOSTA (admin precisa aprovar depois)
 *   - ADMIN/SUPER_ADMIN: cria com statusAprovacao=APROVADA direto + aprovadoEm=now()
 *
 * MVP anexos: aceita string URL externa em `comprovante`. Upload nativo = D-novo-BI futuro.
 */
import {
  IsDateString,
  IsEnum,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  MaxLength,
  Min,
} from 'class-validator';
import {
  CategoriaContaAPagar,
  QuemPagouTipo,
  TratamentoDespesa,
} from '@prisma/client';

export class ProporDespesaDto {
  @IsString()
  @IsNotEmpty({ message: 'usinaId obrigatório' })
  usinaId!: string;

  @IsDateString({}, { message: 'dataOcorrencia inválida (use ISO 8601)' })
  dataOcorrencia!: string;

  @IsEnum(CategoriaContaAPagar, {
    message: 'categoria inválida (use uma das 15 do enum CategoriaContaAPagar)',
  })
  categoria!: CategoriaContaAPagar;

  @IsNumber({ maxDecimalPlaces: 2 }, { message: 'valor inválido' })
  @Min(0.01, { message: 'valor deve ser > 0' })
  valor!: number;

  @IsString()
  @IsNotEmpty({ message: 'descrição obrigatória' })
  @MaxLength(500, { message: 'descrição até 500 chars' })
  descricao!: string;

  @IsEnum(QuemPagouTipo, {
    message: 'quemPagouTipo deve ser PARCEIRO | PROPRIETARIO | COMPARTILHADO | TERCEIRO',
  })
  quemPagouTipo!: QuemPagouTipo;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  quemPagouNome?: string;

  @IsEnum(TratamentoDespesa, {
    message: 'tratamento deve ser REEMBOLSO | DESCONTO_NO_REPASSE | ASSUMIDO',
  })
  tratamento!: TratamentoDespesa;

  // BH.3.1 (29/05): aceita URL absoluta (http://...) ou path relativo
  // (/uploads/comprovantes/...) — o endpoint /upload-comprovante retorna
  // path relativo que é validado downstream pelo frontend ao servir.
  @IsOptional()
  @IsString()
  @MaxLength(500)
  comprovante?: string;
}
