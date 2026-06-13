/**
 * Sprint Clube P1 — F6 Bloco C.0 (13/06/2026).
 *
 * Payload do PUT /meu-perfil/dados-bancarios.
 *
 * REFORÇO ANTI-FRAUDE Luciano (centro do C.0): trocar a chave PIX exige
 * PIN — mesma postura de dinheiro-saindo (porque a chave É a âncora do
 * dinheiro saindo no F6). Sessão sequestrada sem PIN ≠ resgate fraudado.
 *
 * Multi-tenant: cooperadoId + cooperativaId SEMPRE do JWT — NUNCA do body
 * (anti-IDOR; padrão F4/F6).
 *
 * Validação por tipo PIX no service (`DadosBancariosService`):
 *  - CPF       → 11 dígitos numéricos (sem formatação)
 *  - CNPJ      → 14 dígitos numéricos (sem formatação)
 *  - EMAIL     → RFC simples (regex)
 *  - TELEFONE  → E.164 (+ + DDI + número, ex: +5527981341348)
 *  - ALEATORIA → UUID v4 (Asaas gera EVP nesse formato)
 *
 * class-validator faz formato bruto + regex PIN. Service ratifica por tipo.
 */
import { IsEnum, IsString, Matches, MinLength } from 'class-validator';

export enum PixTipoEnum {
  CPF = 'CPF',
  CNPJ = 'CNPJ',
  EMAIL = 'EMAIL',
  TELEFONE = 'TELEFONE',
  ALEATORIA = 'ALEATORIA',
}

export class UpdateDadosBancariosDto {
  @IsEnum(PixTipoEnum, {
    message: 'pixTipo inválido. Use: CPF | CNPJ | EMAIL | TELEFONE | ALEATORIA.',
  })
  pixTipo!: PixTipoEnum;

  @IsString()
  @MinLength(3, { message: 'pixChave muito curta.' })
  pixChave!: string;

  @Matches(/^\d{6}$/, {
    message: 'PIN deve ter exatamente 6 dígitos numéricos.',
  })
  pin!: string;
}
