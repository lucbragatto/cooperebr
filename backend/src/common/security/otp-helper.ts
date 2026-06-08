/**
 * OTP Helper — funções puras pra geração/hash/comparação de códigos OTP de 6 dígitos.
 *
 * Sprint Token-WA Fase 2 (F2.2) — extraído de ConvitesConvenioService (F1.4
 * Sprint Convite-Convênio 03/06/2026) pra reuso em:
 * - ConvitesConvenioService (já em produção)
 * - AparelhoVinculadoService (device binding — F2.4)
 * - TokenTransacaoService (step-up alto valor — Fase 3, fora deste sprint)
 * - PinResetService (recuperação PIN — fluxo futuro)
 *
 * Crypto:
 * - Geração: crypto.randomInt (CSPRNG)
 * - Hash: sha256(codigo + salt) — suficiente pra 6 dígitos × TTL curto
 * - Comparação: crypto.timingSafeEqual (evita timing attack)
 * - Salt rotativo: novo a cada solicitar-otp (16 bytes hex = 32 chars)
 */

import * as crypto from 'crypto';

/**
 * Gera código OTP de 6 dígitos (000000 a 999999) usando crypto.randomInt
 * (CSPRNG). Zero-padded à esquerda pra sempre 6 chars.
 */
export function gerarCodigoOtp(): string {
  const num = crypto.randomInt(0, 1_000_000);
  return num.toString().padStart(6, '0');
}

/**
 * Gera salt rotativo (16 bytes hex = 32 chars) novo a cada solicitar-otp.
 * Garante que mesmo se o atacante conseguir o hash de um OTP antigo, não
 * pode reusar entre reenvios.
 */
export function gerarSaltOtp(): string {
  return crypto.randomBytes(16).toString('hex');
}

/**
 * Hash sha256(codigo + salt). Suficiente pra 6 dígitos × TTL 10min (não
 * justifica work factor bcrypt). Output 64 chars hex.
 */
export function hashOtp(codigo: string, salt: string): string {
  return crypto.createHash('sha256').update(codigo + salt).digest('hex');
}

/**
 * Comparação constant-time via crypto.timingSafeEqual. Evita timing attack
 * que vazaria info por diferença de tempo de resposta entre código próximo
 * vs distante.
 *
 * @returns true se código bate com hash; false caso contrário (inclui erro de tamanho).
 */
export function compararOtp(codigo: string, salt: string, hashEsperado: string): boolean {
  const calculado = hashOtp(codigo, salt);
  if (calculado.length !== hashEsperado.length) return false;
  const bufA = Buffer.from(calculado, 'hex');
  const bufB = Buffer.from(hashEsperado, 'hex');
  if (bufA.length !== bufB.length) return false;
  return crypto.timingSafeEqual(bufA, bufB);
}

/**
 * Gera token genérico (32 bytes hex = 64 chars). Reusável pra:
 * - Token de convite-convênio (já em produção)
 * - jti de TokenTransacao (anti-replay — Fase 3)
 */
export function gerarTokenHex(bytes: number = 32): string {
  return crypto.randomBytes(bytes).toString('hex');
}

/**
 * Gera ID curto (12 bytes hex = 24 chars) pra correlação de lote, etc.
 */
export function gerarIdCurto(): string {
  return crypto.randomBytes(12).toString('hex');
}
