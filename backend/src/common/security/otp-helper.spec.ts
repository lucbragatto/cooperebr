/**
 * Specs OTP Helper — F2.2 Sprint Token-WA Fase 2 (Segurança).
 *
 * Cobre as 6 funções puras: gerarCodigoOtp, gerarSaltOtp, hashOtp,
 * compararOtp, gerarTokenHex, gerarIdCurto.
 */

import {
  gerarCodigoOtp,
  gerarSaltOtp,
  hashOtp,
  compararOtp,
  gerarTokenHex,
  gerarIdCurto,
} from './otp-helper';

describe('otp-helper', () => {
  describe('gerarCodigoOtp', () => {
    it('gera código de 6 dígitos zero-padded', () => {
      for (let i = 0; i < 100; i++) {
        const codigo = gerarCodigoOtp();
        expect(codigo).toMatch(/^\d{6}$/);
        expect(codigo.length).toBe(6);
      }
    });

    it('distribuição aleatória — 1000 gerações não colidem mais de 5%', () => {
      const gerados = new Set<string>();
      for (let i = 0; i < 1000; i++) {
        gerados.add(gerarCodigoOtp());
      }
      // Pelo birthday paradox, ~50% de colisão exige ~1180 amostras pra espaço 1M.
      // Tolera até 5% de colisão (50 duplicatas) — bem acima do esperado.
      expect(gerados.size).toBeGreaterThan(950);
    });
  });

  describe('gerarSaltOtp', () => {
    it('gera salt 32 chars hex', () => {
      const salt = gerarSaltOtp();
      expect(salt).toMatch(/^[0-9a-f]{32}$/);
    });

    it('cada chamada retorna salt diferente', () => {
      const a = gerarSaltOtp();
      const b = gerarSaltOtp();
      expect(a).not.toBe(b);
    });
  });

  describe('hashOtp', () => {
    it('retorna sha256 hex (64 chars)', () => {
      const hash = hashOtp('123456', 'salt123');
      expect(hash).toMatch(/^[0-9a-f]{64}$/);
    });

    it('hash determinístico com mesmo input', () => {
      const a = hashOtp('123456', 'salt-fixo');
      const b = hashOtp('123456', 'salt-fixo');
      expect(a).toBe(b);
    });

    it('salt diferente muda o hash', () => {
      const a = hashOtp('123456', 'salt-A');
      const b = hashOtp('123456', 'salt-B');
      expect(a).not.toBe(b);
    });

    it('código diferente muda o hash', () => {
      const a = hashOtp('123456', 'salt-fixo');
      const b = hashOtp('654321', 'salt-fixo');
      expect(a).not.toBe(b);
    });
  });

  describe('compararOtp', () => {
    it('retorna true pra código + salt + hash correlatos', () => {
      const codigo = '987654';
      const salt = gerarSaltOtp();
      const hash = hashOtp(codigo, salt);
      expect(compararOtp(codigo, salt, hash)).toBe(true);
    });

    it('retorna false pra código errado', () => {
      const salt = gerarSaltOtp();
      const hash = hashOtp('111111', salt);
      expect(compararOtp('222222', salt, hash)).toBe(false);
    });

    it('retorna false pra salt errado', () => {
      const codigo = '333333';
      const saltA = gerarSaltOtp();
      const saltB = gerarSaltOtp();
      const hash = hashOtp(codigo, saltA);
      expect(compararOtp(codigo, saltB, hash)).toBe(false);
    });

    it('retorna false pra hash de tamanho diferente', () => {
      const codigo = '444444';
      const salt = gerarSaltOtp();
      expect(compararOtp(codigo, salt, 'hash-curto')).toBe(false);
    });
  });

  describe('gerarTokenHex', () => {
    it('gera token padrão 64 chars hex (32 bytes)', () => {
      const token = gerarTokenHex();
      expect(token).toMatch(/^[0-9a-f]{64}$/);
    });

    it('respeita bytes customizado', () => {
      const token = gerarTokenHex(16);
      expect(token).toMatch(/^[0-9a-f]{32}$/);
    });

    it('cada chamada retorna token diferente', () => {
      const a = gerarTokenHex();
      const b = gerarTokenHex();
      expect(a).not.toBe(b);
    });
  });

  describe('gerarIdCurto', () => {
    it('gera id 24 chars hex (12 bytes)', () => {
      const id = gerarIdCurto();
      expect(id).toMatch(/^[0-9a-f]{24}$/);
    });

    it('cada chamada retorna id diferente', () => {
      const a = gerarIdCurto();
      const b = gerarIdCurto();
      expect(a).not.toBe(b);
    });
  });
});
