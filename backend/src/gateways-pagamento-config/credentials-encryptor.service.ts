import { Injectable, Logger } from '@nestjs/common';

/**
 * Stub Etapa A — implementação real na Etapa B.
 */
@Injectable()
export class CredentialsEncryptor {
  private readonly logger = new Logger(CredentialsEncryptor.name);

  encrypt(_plaintext: string): string {
    throw new Error('CredentialsEncryptor.encrypt — implementacao pendente (Etapa B)');
  }

  decrypt(_ciphertext: string): string {
    throw new Error('CredentialsEncryptor.decrypt — implementacao pendente (Etapa B)');
  }
}
