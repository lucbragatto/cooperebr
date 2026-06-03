import { IsNotEmpty, IsString, Length } from 'class-validator';

/**
 * Sprint Convite-Convênio Fatia 2a (03/06/2026).
 *
 * DTO do endpoint admin POST /convenios/:id/convites — empresa/admin cadastra
 * o destinatário { nomeConvidado, telefone } e o sistema gera o token + envia
 * o link via WhatsApp pro número informado.
 *
 * Telefone aceita formato livre BR (com/sem máscara, com/sem DDD, com/sem
 * dígito 9). Normalização em E.164 BR (55DDXXXXXXXXX) é feita no
 * ConvitesConvenioService.normalizarTelefoneBR.
 */
export class CriarConviteMembroDto {
  @IsString()
  @IsNotEmpty()
  @Length(2, 200)
  nomeConvidado!: string;

  @IsString()
  @IsNotEmpty()
  telefone!: string;
}
