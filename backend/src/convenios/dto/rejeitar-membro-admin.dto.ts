import { IsNotEmpty, IsString, MaxLength, MinLength } from 'class-validator';

/**
 * Sprint Convite-Convênio Fatia 3 (03/06/2026) — Admin rejeita membro
 * PENDENTE_APROVACAO_ADMIN. Motivo obrigatório (auditoria + notif).
 */
export class RejeitarMembroAdminDto {
  @IsString()
  @IsNotEmpty()
  @MinLength(2)
  @MaxLength(500)
  motivo!: string;
}
