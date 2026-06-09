import { Matches } from 'class-validator';

/**
 * F1 (09/06/2026) — Payload do POST /meu-perfil/definir-pin.
 *
 * - 6 digitos numericos exatos (regex).
 * - pinConfirmacao tem que bater com pin no service (defesa simples contra
 *   erro de digitacao). Validacao de igualdade fica no service (depende de
 *   ambos os campos — class-validator nao tem cross-field nativo sem
 *   custom decorator).
 */
export class DefinirPinDto {
  @Matches(/^\d{6}$/, {
    message: 'PIN deve ter exatamente 6 digitos numericos.',
  })
  pin!: string;

  @Matches(/^\d{6}$/, {
    message: 'Confirmacao deve ter exatamente 6 digitos numericos.',
  })
  pinConfirmacao!: string;
}
