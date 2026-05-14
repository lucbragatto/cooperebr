import { IsString, IsOptional, IsObject, IsNotEmpty } from 'class-validator';

/**
 * D-45 fix sub-fix 3: tipagem do body de POST /motor-proposta/aceitar.
 * Antes: @Body() body: any — validação só no service, erros 400 genéricos.
 * Agora: class-validator pega erros estruturados no boundary HTTP.
 *
 * Mantém shape esperado pelo MotorPropostaService.aceitar():
 *   { cooperadoId, resultado, mesReferencia, planoId? }
 */
export class AceitarPropostaDto {
  @IsString()
  @IsNotEmpty()
  cooperadoId!: string;

  /**
   * Resultado completo do cálculo do motor (objeto serializado).
   * Validação detalhada dos campos internos (descontoPercentual, kwhContrato,
   * valorCooperado, economiaMensal etc) acontece no service em
   * motor-proposta.service.ts:496-515.
   */
  @IsObject()
  resultado!: Record<string, any>;

  @IsString()
  @IsNotEmpty()
  mesReferencia!: string;

  @IsOptional()
  @IsString()
  planoId?: string;
}
