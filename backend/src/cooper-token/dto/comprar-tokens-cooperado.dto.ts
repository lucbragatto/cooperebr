/**
 * Sprint Clube P1 — Fase 2 Bloco 2 (11/06/2026).
 *
 * DTO da compra de tokens pelo cooperado-PJ (empresa cooperada).
 * Espelha shape do legado parceiro/comprar mas com class-validator estrito
 * (substitui body inline). cooperadoId vem do JWT — nunca do body
 * (multi-tenant rigoroso).
 */
import { IsIn, IsNotEmpty, IsNumber, IsOptional, IsString, Matches, Min } from 'class-validator';

export class ComprarTokensCooperadoDto {
  /** Quantidade de tokens (em unidades; nao centavos). */
  @IsNumber()
  @Min(0.0001)
  quantidade: number;

  /** Forma de pagamento Asaas. */
  @IsIn(['PIX', 'BOLETO'])
  formaPagamento: 'PIX' | 'BOLETO';

  /**
   * Sprint Convênio-Token-Cooperado (20/06/2026) — vincula a compra a um
   * convênio específico (programa de benefício da empresa-PJ aos
   * funcionários). Opcional. Quando preenchido, service valida que
   * convênio existe E pertence ao MESMO tenant (defense in depth multi-
   * tenant — Prisma força FK mas não filtra cross-tenant).
   * Salvaguarda 4 do parecer 19/06: rastreio anti-confusão
   * token-de-empregador vs token-próprio.
   */
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  // P2 review multitenant + financeiro Sprint slice (20/06): valida CUID
  // antes de chegar no findFirst (evita timing leak + protege contra
  // payloads inválidos consumindo banco).
  @Matches(/^c[a-z0-9]{24}$/, { message: 'convenioId deve ser um CUID válido' })
  convenioId?: string;
}
