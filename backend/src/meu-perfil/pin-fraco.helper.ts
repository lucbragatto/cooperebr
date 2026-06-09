/**
 * F1 (09/06/2026) — Detecção de PIN fraco.
 *
 * Reprova:
 *  - 6 dígitos iguais (000000, 111111, ..., 999999).
 *  - Sequência ascendente contínua de 6 (012345, 123456, ..., 456789).
 *  - Sequência descendente contínua de 6 (987654, ..., 543210).
 *
 * Decisão Luciano (09/06): manter SIMPLES nesta primeira entrega; datas e
 * aniversários ficam como hardening opcional futuro (não bloqueante).
 */

const SEIS_DIGITOS = /^\d{6}$/;

const ehMonotonoComStep = (pin: string, step: 1 | -1): boolean => {
  for (let i = 1; i < pin.length; i++) {
    if (Number(pin[i]) - Number(pin[i - 1]) !== step) return false;
  }
  return true;
};

export const isPinFraco = (pin: string): boolean => {
  if (!SEIS_DIGITOS.test(pin)) return true; // formato invalido conta como "fraco"
  if (new Set(pin).size === 1) return true; // 6 iguais
  if (ehMonotonoComStep(pin, 1)) return true; // ascendente
  if (ehMonotonoComStep(pin, -1)) return true; // descendente
  return false;
};
