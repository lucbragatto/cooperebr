/**
 * F1 (09/06/2026) — Detecao de PIN fraco espelhada do backend
 * (backend/src/meu-perfil/pin-fraco.helper.ts). Mantenha as 2 versoes
 * sincronizadas.
 *
 * Reprova:
 *  - 6 digitos iguais (000000, 111111, ..., 999999).
 *  - Sequencia ascendente continua de 6 (012345, 123456, ..., 456789).
 *  - Sequencia descendente continua de 6 (987654, ..., 543210).
 */
const SEIS_DIGITOS = /^\d{6}$/;

const ehMonotonoComStep = (pin: string, step: 1 | -1): boolean => {
  for (let i = 1; i < pin.length; i++) {
    if (Number(pin[i]) - Number(pin[i - 1]) !== step) return false;
  }
  return true;
};

export const isPinFraco = (pin: string): boolean => {
  if (!SEIS_DIGITOS.test(pin)) return true;
  if (new Set(pin).size === 1) return true;
  if (ehMonotonoComStep(pin, 1)) return true;
  if (ehMonotonoComStep(pin, -1)) return true;
  return false;
};
