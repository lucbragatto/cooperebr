/**
 * Sprint Clube P1 — F4 Bloco A (12/06/2026).
 *
 * DTO de "usar tokens na fatura" do cooperado. Substitui o body inline
 * `{ cobrancaId, quantidadeTokens }` adicionando PIN obrigatório (6 dígitos
 * numéricos) — primeiro endpoint do F4 com step-up de autorização.
 *
 * cooperadoId e cooperativaId vêm SEMPRE do JWT, nunca do body (anti-IDOR).
 */
import { IsNumber, IsString, Matches, Min } from 'class-validator';

export class UsarNaFaturaDto {
  /** ID da cobrança que receberá o abatimento. Tenant é validado no service. */
  @IsString()
  cobrancaId: string;

  /**
   * Quantidade de tokens a usar (em unidades; não centavos). Service
   * clampa pelo `descontoMaxPerc` do plano e pelo saldoDisponivel — então
   * passar valor maior que o necessário simplesmente é cortado, não erro.
   */
  @IsNumber()
  @Min(0.0001)
  quantidadeTokens: number;

  /**
   * PIN do cooperado (6 dígitos numéricos). Validado contra `Cooperado.pinHash`
   * via `PinCooperadoService.validarPinComLockout` (rate-limit 5 tentativas
   * → lockout 30min, multi-tenant updateMany).
   */
  @IsString()
  @Matches(/^\d{6}$/, { message: 'PIN deve ter exatamente 6 dígitos numéricos.' })
  pin: string;
}
