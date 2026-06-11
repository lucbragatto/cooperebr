import type { DistribuidoraEnum } from '@prisma/client';
import type { FaturaCanonica, FaturaRawInput } from './fatura-canonica.types';

/**
 * Resultado do parseamento - sucesso ou falha categorizada.
 */
export type ResultadoAdapter =
  | { sucesso: true; fatura: FaturaCanonica }
  | { sucesso: false; motivo: MotivoFalhaAdapter; detalhe: string };

/**
 * Motivos categorizados de falha do adapter.
 *
 * NAO_IMPLEMENTADO       - adapter esqueleto (ELFSM, ENERGISA_TO no MVP)
 * INPUT_INSUFICIENTE     - faltam dados obrigatorios no input
 * RUBRICA_DESCONHECIDA   - rubrica que o adapter nao consegue classificar
 * INCONSISTENCIA_VALORES - soma de rubricas nao bate com totais declarados
 */
export type MotivoFalhaAdapter =
  | 'NAO_IMPLEMENTADO'
  | 'INPUT_INSUFICIENTE'
  | 'RUBRICA_DESCONHECIDA'
  | 'INCONSISTENCIA_VALORES';

/**
 * Strategy interface - cada concessionaria implementa.
 */
export interface FaturaAdapter {
  readonly distribuidora: DistribuidoraEnum;
  parsear(input: FaturaRawInput): ResultadoAdapter;
}
