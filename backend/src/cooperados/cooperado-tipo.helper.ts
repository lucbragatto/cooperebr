/**
 * F1 (09/06/2026) — Helpers de tipo do cooperado.
 *
 * Cooperado.tipoPessoa eh string opcional default "PF" no schema. Centraliza
 * a leitura semantica pra evitar comparacoes ad-hoc espalhadas pelo codigo.
 */

export interface CooperadoTipo {
  tipoPessoa?: string | null;
}

export const isEmpresaCooperada = (c: CooperadoTipo): boolean =>
  (c.tipoPessoa ?? 'PF').toUpperCase() === 'PJ';

export const isPessoaFisica = (c: CooperadoTipo): boolean =>
  !isEmpresaCooperada(c);
