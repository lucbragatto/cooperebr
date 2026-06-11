/**
 * Sprint Clube P1 — F4 Bloco C (12/06/2026).
 *
 * DTO de "processar pagamento QR" cooperado→cooperado. PIN do PAGADOR é
 * obrigatório (o cliente apresenta o PIN do pagador no momento do
 * processamento — UX: pagador autoriza explicitamente o consumo do QR).
 *
 * O caminho `processarQrParceiro` (parceiro recebe QR de cooperado)
 * REUSA `processarPagamentoQr` no service, mas SEM passar PIN — o pagador
 * está em outro contexto/tenant e o parceiro confia no QR já assinado.
 * Documentado como trade-off no comentário do método.
 */
import { IsString, Matches } from 'class-validator';

export class ProcessarPagamentoQrDto {
  /** QR JWT gerado por `gerarQrPagamento` (TTL 5min). */
  @IsString()
  qrToken: string;

  /**
   * PIN do PAGADOR (6 dígitos numéricos). Validado contra
   * `Cooperado.pinHash` do `decoded.pagadorId` extraído do QR JWT.
   */
  @IsString()
  @Matches(/^\d{6}$/, { message: 'PIN deve ter exatamente 6 dígitos numéricos.' })
  pin: string;
}
