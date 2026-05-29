import { IsDateString, IsEnum, IsOptional, IsString, MaxLength } from 'class-validator';
import { MetodoPagamentoRepasse } from '@prisma/client';

export class MarcarRepassePagoDto {
  @IsEnum(MetodoPagamentoRepasse, {
    message:
      'metodoPagamento deve ser um dos: PIX, TED, MANUAL, OUTRO.',
  })
  metodoPagamento!: MetodoPagamentoRepasse;

  @IsDateString({}, { message: 'dataPagamento deve ser ISO 8601 (YYYY-MM-DD).' })
  dataPagamento!: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  comprovante?: string;

  /**
   * Obrigatório quando `metodoPagamento === 'OUTRO'`. Validação cross-field
   * fica no service (class-validator sozinho não cobre essa dependência sem
   * validator custom — KISS aqui).
   */
  @IsOptional()
  @IsString()
  @MaxLength(500)
  observacao?: string;
}
