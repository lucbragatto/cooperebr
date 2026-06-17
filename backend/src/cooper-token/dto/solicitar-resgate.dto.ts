/**
 * Sprint Clube P1 — F6 Bloco B (12/06/2026).
 *
 * DTO de solicitação de RESGATE/LIQUIDAÇÃO de voucher pelo Estabelecimento
 * do Clube. Cooperativa quita passivo próprio (token que ela emitiu) e
 * deposita em R$ via PIX na chave pré-cadastrada do estabelecimento.
 *
 * VOCABULÁRIO TRAVADO (decisão 04/06): "resgate" / "liquidação" / "recibo".
 * NUNCA "recompra" ou "venda" — vira erro de conformidade
 * (decisao_modelo_token_voucher_sobra_resgate_2026_06_04.md).
 *
 * Multi-tenant: cooperadoId (estabelecimento) e cooperativaId SEMPRE do
 * JWT — NUNCA do body (anti-IDOR). pixChave também NUNCA do body — sai
 * do Cooperado.pixChave cadastrado em /portal/seguranca (anti-fraude).
 */
import {
  IsBoolean,
  IsNumber,
  IsOptional,
  IsString,
  Matches,
  Min,
} from 'class-validator';

export class SolicitarResgateDto {
  /**
   * Quantidade de tokens a resgatar (unidades; não centavos).
   * Mínimo 0.0001. Service ainda valida contra saldoDisponivel e limites.
   */
  @IsNumber()
  @Min(0.0001)
  quantidade: number;

  /**
   * PIN do estabelecimento (6 dígitos numéricos). Validado contra
   * Cooperado.pinHash via PinCooperadoService.validarPinComLockout
   * FORA da tx Serializable (mesmo padrão F4).
   */
  @IsString()
  @Matches(/^\d{6}$/, { message: 'PIN deve ter exatamente 6 dígitos numéricos.' })
  pin: string;

  /**
   * Idempotência por solicitação (UUID v4 recomendado — padrão F4 C.2).
   * @@unique no ResgateRecibo bloqueia 2ª request com mesmo id.
   */
  @IsString()
  clientRequestId: string;

  /**
   * Step-up tier ALTO (>R$50 — limiar do F4): exige OTP via
   * OtpDesafioService (motivo TOKEN_TRANSACAO_STEP_UP) criado previamente
   * em POST /cooper-token/otp-step-up (F4 endpoint stub).
   * tier BAIXO ignora (só PIN basta).
   */
  @IsOptional()
  @IsString()
  otpDesafioId?: string;

  @IsOptional()
  @IsString()
  @Matches(/^\d{6}$/, { message: 'OTP deve ter exatamente 6 dígitos numéricos.' })
  otpCodigo?: string;

  /**
   * Texto livre — vai pro ResgateRecibo.observacao e pro descricao do
   * Asaas PIX-out (aparece no extrato bancário do estabelecimento).
   */
  @IsOptional()
  @IsString()
  observacao?: string;

  // ── Sprint D2.1 v2 (16/06/2026) — Salvaguarda 5 versionada ──
  //
  // Aceite OBRIGATÓRIO pra colaborador comum (não-Estab). Estabelecimento
  // bypassa via flag ehEstabelecimento — service ignora estes campos.
  //
  // O cliente envia `disclaimerSaqueId` (FK pro DisclaimerSaque que estava
  // ativo no momento do aceite). Service revalida `id === getAtivo(
  // cooperativaId).id` no Guard 1.6 (anti-staleness: se ADMIN/SUPER_ADMIN
  // editar entre o GET do front e o POST do cooperado, cliente recarrega).

  /** True = li e aceito o termo de saque (Salvaguarda 5). */
  @IsOptional()
  @IsBoolean()
  disclaimerAceito?: boolean;

  /** FK pro DisclaimerSaque ativo aceito (cuid). */
  @IsOptional()
  @IsString()
  disclaimerSaqueId?: string;
}

export class RecusarResgateDto {
  /**
   * Texto humano explicando porque o admin recusou. Vai pro
   * ResgateRecibo.motivoRecusa + AuditLog.
   */
  @IsString()
  motivoRecusa: string;
}
