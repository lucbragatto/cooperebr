/**
 * Mini-Bloco H'.9 (17/05/2026) — DTO de criação de Usina com validação cruzada
 * de forma de pagamento ao dono (FIXO/PERCENTUAL/HIBRIDO).
 *
 * Regras:
 *   - formaPagamentoDono = FIXO       → valorAluguelFixo > 0
 *   - formaPagamentoDono = PERCENTUAL → percentualGeracaoDono ∈ [0,01; 100]
 *   - formaPagamentoDono = HIBRIDO    → AMBOS preenchidos com regras acima
 *   - formaPagamentoDono = null/ausente → ambos campos opcionais
 */
import {
  IsBoolean,
  IsEnum,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  ValidateIf,
} from 'class-validator';
import { FormaAquisicao, FormaPagamentoDono } from '@prisma/client';

export class CreateUsinaDto {
  @IsString()
  @IsNotEmpty({ message: 'Nome da usina é obrigatório' })
  nome!: string;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  apelidoInterno?: string;

  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0.01, { message: 'Potência kWp deve ser maior que zero' })
  potenciaKwp!: number;

  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  capacidadeKwh?: number;

  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  producaoMensalKwh?: number;

  @IsString()
  @IsNotEmpty({ message: 'Cidade é obrigatória' })
  cidade!: string;

  @IsString()
  @IsNotEmpty({ message: 'Estado é obrigatório' })
  @MaxLength(2)
  estado!: string;

  @IsOptional() @IsString() enderecoLogradouro?: string;
  @IsOptional() @IsString() enderecoNumero?: string;
  @IsOptional() @IsString() enderecoBairro?: string;
  @IsOptional() @IsString() enderecoCep?: string;

  @IsOptional() @IsString() statusHomologacao?: string;
  @IsOptional() @IsString() observacoes?: string;
  @IsOptional() @IsString() modeloCobrancaOverride?: string | null;
  @IsOptional() @IsString() distribuidora?: string;
  @IsOptional() @IsString() cooperativaId?: string;

  @IsOptional() @IsString() proprietarioNome?: string;
  @IsOptional() @IsString() proprietarioCpfCnpj?: string;
  @IsOptional() @IsString() proprietarioTelefone?: string;
  @IsOptional() @IsString() proprietarioEmail?: string;
  @IsOptional() @IsString() proprietarioTipo?: string;
  @IsOptional() @IsString() proprietarioCooperadoId?: string;

  @IsOptional() @IsString() @MaxLength(18) cnpjUsina?: string;

  @IsOptional()
  @IsEnum(FormaAquisicao)
  formaAquisicao?: FormaAquisicao;

  @IsOptional()
  @IsEnum(FormaPagamentoDono, {
    message: 'Forma de pagamento ao dono deve ser FIXO, PERCENTUAL ou HIBRIDO',
  })
  formaPagamentoDono?: FormaPagamentoDono;

  // ── Validação cruzada — valorAluguelFixo ─────────────────────────
  // Obrigatório > 0 quando formaPagamentoDono = FIXO ou HIBRIDO.
  @ValidateIf(o => o.formaPagamentoDono === 'FIXO' || o.formaPagamentoDono === 'HIBRIDO')
  @IsNumber({ maxDecimalPlaces: 2 }, {
    message: 'Valor fixo (R$/mês) é obrigatório quando forma é FIXO ou HIBRIDO',
  })
  @Min(0.01, { message: 'Valor fixo deve ser maior que zero' })
  valorAluguelFixo?: number;

  // ── Validação cruzada — percentualGeracaoDono ────────────────────
  // Obrigatório ∈ [0,01; 100] quando formaPagamentoDono = PERCENTUAL ou HIBRIDO.
  @ValidateIf(o => o.formaPagamentoDono === 'PERCENTUAL' || o.formaPagamentoDono === 'HIBRIDO')
  @IsNumber({ maxDecimalPlaces: 2 }, {
    message: 'Percentual da geração ao dono (%) é obrigatório quando forma é PERCENTUAL ou HIBRIDO',
  })
  @Min(0.01, { message: 'Percentual deve ser ≥ 0,01%' })
  @Max(100, { message: 'Percentual deve ser ≤ 100%' })
  percentualGeracaoDono?: number;

  @IsOptional() @IsString() numeroContratoEdp?: string;
  @IsOptional() @IsString() dataContratoEdp?: string;
}
