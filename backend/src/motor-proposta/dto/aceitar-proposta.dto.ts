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

  /**
   * D-FISCAL-2.4.3 — Caso 1: membro custeado por convênio (empresa paga total).
   * Quando presente:
   *   1. planoId é IGNORADO — força o plano global "Custeado por convênio"
   *      (Plano.custeadoPorConvenio=true, cooperativaId=null).
   *   2. Após criar o Contrato, vincula o cooperado ao ContratoConvenio
   *      como ConvenioCooperado ATIVO, dentro da mesma transação.
   *   3. Enforça 1:1 (cooperado só pode estar em UM convênio ativo).
   *   4. Enforça convenio.pagador=EMPRESA (Caso 1) e mesma cooperativa.
   * Quando ausente: fluxo normal (planoId usado / fallback).
   */
  @IsOptional()
  @IsString()
  convenioCusteioId?: string;
}
