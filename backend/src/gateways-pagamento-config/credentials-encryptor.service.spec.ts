import { CredentialsEncryptor } from './credentials-encryptor.service';
import * as crypto from 'node:crypto';

describe('CredentialsEncryptor', () => {
  const envOriginal = { ...process.env };
  // 32 bytes base64 fixos pra reproducibilidade
  const fakeKey = crypto.randomBytes(32).toString('base64');

  beforeEach(() => {
    jest.clearAllMocks();
    process.env = { ...envOriginal, GATEWAY_ENCRYPT_KEY: fakeKey };
  });

  afterAll(() => {
    process.env = envOriginal;
  });

  function make(): CredentialsEncryptor {
    return new CredentialsEncryptor();
  }

  describe('encrypt/decrypt roundtrip', () => {
    it('decripta corretamente o que foi encriptado', () => {
      const svc = make();
      const plain = 'minha-api-key-super-secreta-123';
      const cipher = svc.encrypt(plain);
      expect(cipher).not.toEqual(plain);
      expect(svc.decrypt(cipher)).toEqual(plain);
    });

    it('formato do ciphertext: iv:cipher:tag em base64', () => {
      const svc = make();
      const cipher = svc.encrypt('teste');
      const parts = cipher.split(':');
      expect(parts).toHaveLength(3);
      // IV 12 bytes em base64 = 16 chars
      expect(parts[0]).toHaveLength(16);
      // Tag 16 bytes em base64 = 24 chars
      expect(parts[2]).toHaveLength(24);
    });

    it('cada chamada encrypt gera ciphertext distinto (IV aleatorio)', () => {
      const svc = make();
      const a = svc.encrypt('mesmo-input');
      const b = svc.encrypt('mesmo-input');
      expect(a).not.toEqual(b);
      expect(svc.decrypt(a)).toEqual(svc.decrypt(b));
    });

    it('suporta strings vazias', () => {
      const svc = make();
      const cipher = svc.encrypt('');
      expect(svc.decrypt(cipher)).toEqual('');
    });

    it('suporta strings longas (1000+ chars)', () => {
      const svc = make();
      const longString = 'x'.repeat(2000);
      const cipher = svc.encrypt(longString);
      expect(svc.decrypt(cipher)).toEqual(longString);
    });

    it('suporta caracteres unicode (acentos, emojis)', () => {
      const svc = make();
      const plain = 'Coopereção: kWh com çedilha + acentuação — 🌞';
      const cipher = svc.encrypt(plain);
      expect(svc.decrypt(cipher)).toEqual(plain);
    });
  });

  describe('validacao da chave master', () => {
    it('throw claro quando GATEWAY_ENCRYPT_KEY ausente', () => {
      delete process.env.GATEWAY_ENCRYPT_KEY;
      const svc = make();
      expect(() => svc.encrypt('x')).toThrow(/GATEWAY_ENCRYPT_KEY/);
    });

    it('throw quando GATEWAY_ENCRYPT_KEY tem tamanho errado (nao-32 bytes)', () => {
      process.env.GATEWAY_ENCRYPT_KEY = Buffer.from('chave-curta-demais').toString('base64');
      const svc = make();
      expect(() => svc.encrypt('x')).toThrow(/32 bytes|256 bits/);
    });

    it('throw quando GATEWAY_ENCRYPT_KEY tem base64 invalido', () => {
      process.env.GATEWAY_ENCRYPT_KEY = '!!!nao-eh-base64-valido!!!';
      const svc = make();
      expect(() => svc.encrypt('x')).toThrow();
    });
  });

  describe('ciphertext corrompido', () => {
    it('decrypt de string sem formato iv:cipher:tag falha', () => {
      const svc = make();
      expect(() => svc.decrypt('isso-nao-eh-um-ciphertext-valido')).toThrow();
    });

    it('decrypt de ciphertext com tag alterada falha (GCM auth fail)', () => {
      const svc = make();
      const cipher = svc.encrypt('payload');
      const parts = cipher.split(':');
      // Corrompe a tag (ultimo segmento)
      const tagBuf = Buffer.from(parts[2], 'base64');
      tagBuf[0] = tagBuf[0] ^ 0xff;
      const corrompido = `${parts[0]}:${parts[1]}:${tagBuf.toString('base64')}`;
      expect(() => svc.decrypt(corrompido)).toThrow();
    });

    it('decrypt com chave master DIFERENTE (rotacionada errado) falha', () => {
      const svc1 = make();
      const cipher = svc1.encrypt('segredo');

      // Troca chave master e cria nova instancia
      process.env.GATEWAY_ENCRYPT_KEY = crypto.randomBytes(32).toString('base64');
      const svc2 = make();

      expect(() => svc2.decrypt(cipher)).toThrow();
    });
  });
});
