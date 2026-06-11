/**
 * Sprint Clube P1 — Fase 2 Bloco 2 (11/06/2026).
 *
 * DTO da compra de tokens pelo cooperado-PJ (empresa cooperada).
 * Espelha shape do legado parceiro/comprar mas com class-validator estrito
 * (substitui body inline). cooperadoId vem do JWT — nunca do body
 * (multi-tenant rigoroso).
 */
import { IsIn, IsNumber, Min } from 'class-validator';

export class ComprarTokensCooperadoDto {
  /** Quantidade de tokens (em unidades; nao centavos). */
  @IsNumber()
  @Min(0.0001)
  quantidade: number;

  /** Forma de pagamento Asaas. */
  @IsIn(['PIX', 'BOLETO'])
  formaPagamento: 'PIX' | 'BOLETO';
}
