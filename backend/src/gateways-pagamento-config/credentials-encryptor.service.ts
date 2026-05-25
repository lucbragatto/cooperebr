import { Injectable, Logger } from '@nestjs/common';
import * as crypto from 'node:crypto';

/**
 * CredentialsEncryptor — AES-256-GCM symmetric encryption pros secrets
 * guardados em `ConfigGateway.credenciais` (api keys, senhas, client secrets).
 *
 * Sub-Sprint Gateways de Pagamento — Fatia F1 Etapa B (M27, 2026-05-26).
 *
 * Padrao reutilizado do `AsaasService.encrypt/decrypt` (linha 22-55 do
 * arquivo legado), extraido pra service injetavel separado.
 *
 * Formato do ciphertext: `iv:cipher:tag` (base64). 12 bytes IV (96 bits —
 * recomendado pra GCM), tag 16 bytes (128 bits) authenticated. Cada chamada
 * gera IV novo aleatorio — mesmo plaintext encriptado N vezes produz
 * ciphertexts distintos, mas todos decriptam pro mesmo valor.
 *
 * 🚨 RISCO R2 (catalogado no relatorio Fase 1):
 * Perda da `GATEWAY_ENCRYPT_KEY` = TODOS os gateways configurados ficam
 * ilegiveis. Recovery exige 2 backups offline (papel + gerenciador de
 * senhas confiavel). Backup OBRIGATORIO antes da Fatia F2 migrar dados reais.
 *
 * Chave master: 32 bytes (256 bits) em base64, fornecida via
 * `process.env.GATEWAY_ENCRYPT_KEY`. Gerar com `openssl rand -base64 32`.
 */
@Injectable()
export class CredentialsEncryptor {
  private readonly logger = new Logger(CredentialsEncryptor.name);
  private static readonly IV_LENGTH_BYTES = 12;
  private static readonly TAG_LENGTH_BYTES = 16;
  private static readonly KEY_LENGTH_BYTES = 32;

  private getKey(): Buffer {
    const raw = process.env.GATEWAY_ENCRYPT_KEY;
    if (!raw || raw.trim() === '') {
      throw new Error(
        'GATEWAY_ENCRYPT_KEY nao configurada. Defina no .env (32 bytes base64). ' +
          'Gerar com: openssl rand -base64 32',
      );
    }

    let decoded: Buffer;
    try {
      decoded = Buffer.from(raw, 'base64');
    } catch {
      throw new Error('GATEWAY_ENCRYPT_KEY com formato base64 invalido.');
    }

    if (decoded.length !== CredentialsEncryptor.KEY_LENGTH_BYTES) {
      throw new Error(
        `GATEWAY_ENCRYPT_KEY deve ter 32 bytes (256 bits) apos base64-decode. ` +
          `Recebido: ${decoded.length} bytes. Gerar com: openssl rand -base64 32`,
      );
    }

    return decoded;
  }

  encrypt(plaintext: string): string {
    const key = this.getKey();
    const iv = crypto.randomBytes(CredentialsEncryptor.IV_LENGTH_BYTES);
    const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
    const encrypted = Buffer.concat([
      cipher.update(plaintext, 'utf8'),
      cipher.final(),
    ]);
    const tag = cipher.getAuthTag();
    return [
      iv.toString('base64'),
      encrypted.toString('base64'),
      tag.toString('base64'),
    ].join(':');
  }

  decrypt(ciphertext: string): string {
    const parts = ciphertext.split(':');
    if (parts.length !== 3) {
      throw new Error(
        'Ciphertext invalido: formato esperado "iv:cipher:tag" em base64.',
      );
    }

    const [ivB64, encB64, tagB64] = parts;
    const key = this.getKey();
    const iv = Buffer.from(ivB64, 'base64');
    const enc = Buffer.from(encB64, 'base64');
    const tag = Buffer.from(tagB64, 'base64');

    if (iv.length !== CredentialsEncryptor.IV_LENGTH_BYTES) {
      throw new Error(
        `Ciphertext invalido: IV deve ter ${CredentialsEncryptor.IV_LENGTH_BYTES} bytes.`,
      );
    }
    if (tag.length !== CredentialsEncryptor.TAG_LENGTH_BYTES) {
      throw new Error(
        `Ciphertext invalido: tag GCM deve ter ${CredentialsEncryptor.TAG_LENGTH_BYTES} bytes.`,
      );
    }

    const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
    decipher.setAuthTag(tag);
    // .final() lanca exception se a tag GCM nao valida (proteção contra tampering)
    const decrypted = Buffer.concat([decipher.update(enc), decipher.final()]);
    return decrypted.toString('utf8');
  }

  /**
   * Mascara um valor sensivel pra exibir na UI sem expor o segredo.
   * Mantem os ultimos 4 chars (suficiente pra confirmar visualmente
   * "e a chave que cadastrei").
   */
  mask(value: string | null | undefined): string {
    if (!value || value.length === 0) return '****';
    if (value.length <= 4) return '****';
    return '****' + value.slice(-4);
  }
}
