/**
 * Mini-Bloco H'.9 (17/05/2026) — DTO de atualização parcial de Usina.
 *
 * Todos os campos opcionais. Validação cruzada
 * valorAluguelFixo/percentualGeracaoDono só dispara se formaPagamentoDono
 * estiver presente no payload (via @ValidateIf).
 */
import {
  IsBoolean,
  IsEnum,
  IsNumber,
  IsObject,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  ValidateIf,
} from 'class-validator';
import { FormaAquisicao, FormaPagamentoDono, StatusOperacional } from '@prisma/client';

export class UpdateUsinaDto {
  @IsOptional() @IsString() nome?: string;
  @IsOptional() @IsString() @MaxLength(80) apelidoInterno?: string;

  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  potenciaKwp?: number;

  @IsOptional() @IsNumber({ maxDecimalPlaces: 2 }) @Min(0)
  capacidadeKwh?: number | null;

  @IsOptional() @IsNumber({ maxDecimalPlaces: 2 }) @Min(0)
  producaoMensalKwh?: number | null;

  @IsOptional() @IsString() cidade?: string;
  @IsOptional() @IsString() @MaxLength(2) estado?: string;

  @IsOptional() @IsString() enderecoLogradouro?: string | null;
  @IsOptional() @IsString() enderecoNumero?: string | null;
  @IsOptional() @IsString() enderecoBairro?: string | null;
  @IsOptional() @IsString() enderecoCep?: string | null;

  @IsOptional() @IsString() statusHomologacao?: string;
  @IsOptional() @IsString() dataHomologacao?: string;
  @IsOptional() @IsString() dataInicioProducao?: string;
  @IsOptional() @IsString() observacoes?: string;
  @IsOptional() @IsString() modeloCobrancaOverride?: string | null;
  @IsOptional() @IsString() distribuidora?: string;

  @IsOptional() @IsString() proprietarioNome?: string | null;
  @IsOptional() @IsString() proprietarioCpfCnpj?: string | null;
  @IsOptional() @IsString() proprietarioTelefone?: string | null;
  @IsOptional() @IsString() proprietarioEmail?: string | null;
  @IsOptional() @IsString() proprietarioTipo?: string;
  @IsOptional() @IsString() proprietarioCooperadoId?: string | null;

  @IsOptional() @IsString() @MaxLength(18) cnpjUsina?: string | null;

  @IsOptional()
  @IsEnum(FormaAquisicao)
  formaAquisicao?: FormaAquisicao | null;

  @IsOptional()
  @IsEnum(FormaPagamentoDono, {
    message: 'Forma de pagamento ao dono deve ser FIXO, PERCENTUAL ou HIBRIDO',
  })
  formaPagamentoDono?: FormaPagamentoDono | null;

  @ValidateIf(o => o.formaPagamentoDono === 'FIXO' || o.formaPagamentoDono === 'HIBRIDO')
  @IsNumber({ maxDecimalPlaces: 2 }, {
    message: 'Valor fixo (R$/mês) é obrigatório quando forma é FIXO ou HIBRIDO',
  })
  @Min(0.01, { message: 'Valor fixo deve ser maior que zero' })
  valorAluguelFixo?: number | null;

  @ValidateIf(o => o.formaPagamentoDono === 'PERCENTUAL' || o.formaPagamentoDono === 'HIBRIDO')
  @IsNumber({ maxDecimalPlaces: 2 }, {
    message: 'Percentual da geração ao dono (%) é obrigatório quando forma é PERCENTUAL ou HIBRIDO',
  })
  @Min(0.01, { message: 'Percentual deve ser ≥ 0,01%' })
  @Max(100, { message: 'Percentual deve ser ≤ 100%' })
  percentualGeracaoDono?: number | null;

  @IsOptional() @IsString() numeroContratoEdp?: string | null;
  @IsOptional() @IsString() dataContratoEdp?: string | null;

  /// Sprint 8 (M14.B) — anotação de classe GD por usina (string, sem enum hard
  /// até dossiê regulatório fechar). Valores aceitos: 'GD_I', 'GD_II', 'GD_III'.
  @IsOptional() @IsString() classeGdAnotada?: string | null;

  // Sub-Sprint F (M30, 2026-05-26) — Portal Proprietario
  @IsOptional()
  @IsEnum(StatusOperacional, {
    message: 'statusOperacional deve ser OPERANDO | MANUTENCAO_PLANEJADA | MANUTENCAO_EMERGENCIAL | DESLIGADA | OFFLINE',
  })
  statusOperacional?: StatusOperacional;

  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 5 }, { message: 'valorKwhPadrao deve ser numero com ate 5 casas' })
  @Min(0.00001, { message: 'valorKwhPadrao deve ser > 0' })
  valorKwhPadrao?: number | null;

  @IsOptional()
  @IsObject({ message: 'responsabilidadeDespesas deve ser objeto { categoria: responsavel }' })
  responsabilidadeDespesas?: Record<string, string>;
}
