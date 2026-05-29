/**
 * D-novo-BH (M37, 29/05/2026) — DTO de resolução de despesa aprovada.
 *
 * Marca statusResolucao=RESOLVIDA. Observação opcional pra registro
 * (ex: "reembolso pago via PIX em DD/MM"). Audit log via @AuditLog.
 */
import { IsOptional, IsString, MaxLength } from 'class-validator';

export class ResolverDespesaDto {
  @IsOptional()
  @IsString()
  @MaxLength(500, { message: 'observação até 500 chars' })
  observacao?: string;
}
