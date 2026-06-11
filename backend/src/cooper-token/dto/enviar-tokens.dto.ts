/**
 * Sprint Clube P1 — F4 Bloco C (12/06/2026).
 *
 * DTO de "enviar tokens" — bifurca em 2 caminhos no controller:
 *
 *   COOPERADO → COOPERADO (req.user.cooperadoId presente):
 *     - `pin` obrigatório (PIN do remetente)
 *     - Aplica `calcularTaxa('transferencia')` (default 0% = comportamento
 *       idêntico ao legado; configurável via ConfigCooperToken)
 *     - jti via `criarTokenTransacao` (anti-replay)
 *
 *   ADMIN/OPERADOR/SUPER_ADMIN/AGREGADOR (sem cooperadoId — crédito direto):
 *     - tier BAIXO (≤R$50) → segue só com auth da sessão
 *     - tier ALTO (>R$50)  → exige `otpDesafioId` + `otpCodigo` (step-up
 *       via `OtpDesafioService` — motivo `TOKEN_TRANSACAO_STEP_UP`)
 *
 * Validação fina (qual caminho, qual campo é obrigatório) fica no controller
 * + service — o DTO só permite as combinações possíveis.
 */
import { IsNumber, IsOptional, IsString, Matches, Min } from 'class-validator';

export class EnviarTokensDto {
  /** ID do cooperado destinatário. Sempre obrigatório. */
  @IsString()
  cooperadoId: string;

  /** Quantidade de tokens (unidades, não centavos). */
  @IsNumber()
  @Min(0.0001)
  quantidade: number;

  /** Descrição opcional pra extrato/ledger. */
  @IsOptional()
  @IsString()
  descricao?: string;

  /**
   * PIN do REMETENTE (6 dígitos). Obrigatório no caminho
   * cooperado→cooperado. Ignorado no caminho admin (crédito direto).
   */
  @IsOptional()
  @IsString()
  @Matches(/^\d{6}$/, { message: 'PIN deve ter exatamente 6 dígitos numéricos.' })
  pin?: string;

  /**
   * ID do desafio OTP criado previamente via `POST /cooper-token/otp-step-up`
   * (não existe ainda — controller F4 Bloco C cria stub se necessário).
   * Obrigatório quando admin path + tier ALTO.
   */
  @IsOptional()
  @IsString()
  otpDesafioId?: string;

  /** Código OTP de 6 dígitos. Validado via `OtpDesafioService.validarOuLancar`. */
  @IsOptional()
  @IsString()
  @Matches(/^\d{6}$/, { message: 'OTP deve ter exatamente 6 dígitos numéricos.' })
  otpCodigo?: string;
}
