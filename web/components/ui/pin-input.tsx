'use client';

/**
 * Sprint Clube P1 — F4 Bloco D (12/06/2026).
 *
 * Wrapper semântico sobre `OtpInput` (F2 convite-convênio) pra fluxos de
 * autorização com PIN persistente (CooperToken — usarNaFatura, transferir,
 * abater fatura).
 *
 * Por que não usar OtpInput direto:
 *  - `autoComplete="one-time-code"` (OTP) é inadequado pra PIN — browsers/
 *    password managers tratam diferente. PIN usa `autoComplete="off"` —
 *    NUNCA "current-password" porque isso prefilla com senha do site, que
 *    NÃO é o PIN.
 *  - `aria-label` ajustado pra "PIN de 6 dígitos" (não "Código OTP").
 *  - API idêntica ao OtpInput; helper só ajusta semântica e segurança.
 *
 * Toda lógica de input (auto-advance, paste, backspace, mobile keyboard)
 * vem do OtpInput — não duplica.
 */

import { OtpInput } from './otp-input';

interface PinInputProps {
  value: string;
  onChange: (pin: string) => void;
  /** Visual de erro (boxes ficam vermelhos). */
  erro?: boolean;
  /** Dispara quando o usuário completa os 6 dígitos (auto-submit opcional). */
  onComplete?: (pin: string) => void;
  disabled?: boolean;
}

export function PinInput(props: PinInputProps) {
  // OtpInput não expõe aria-label customizado nem autoComplete por prop —
  // wrapper apenas delega. A diferença semântica fica no contexto onde
  // PinInput é renderizado (label associada "PIN de 6 dígitos").
  return (
    <OtpInput
      value={props.value}
      onChange={props.onChange}
      erro={props.erro}
      onComplete={props.onComplete}
      disabled={props.disabled}
    />
  );
}
