import { NaturezaCooperativa } from '@prisma/client';

/**
 * D-novo-BR-CT CT.2 (31/05/2026) — Abstração multi-regime contábil.
 *
 * Garante NÃO-HERANÇA SILENCIOSA: cada regime DEVE implementar
 * explicitamente sua lógica. Tentar usar isenção cooperativa em
 * CONSORCIO/ASSOCIACAO/CONDOMINIO sem implementação dedicada lança
 * NotImplementedException — risco P0-1 do parecer subagent
 * (aproveitamento indevido de benefício fiscal = autuação retroativa
 * 5 anos CTN Art. 173).
 *
 * MVP CT.2: COOPERATIVO implementado; outros 3 = stubs explícitos.
 */

export interface FonteCobranca {
  tipo: 'COBRANCA';
  cooperadoTipoCooperado: string | null; // TipoCooperado | null se cooperado deletado
}

export interface FonteContaAPagar {
  tipo: 'CONTA_A_PAGAR';
  // Despesa operacional usina; categoria detalhada vem do enum CategoriaContaAPagar
  // mas pra classificação cooperativa basta saber que é despesa operacional.
}

export interface FonteRepasseProprietario {
  tipo: 'REPASSE_PROPRIETARIO';
  usinaFormaAquisicao: 'CESSAO' | 'ALUGUEL' | 'PROPRIA' | null;
}

export interface FonteConvenio {
  tipo: 'CONVENIO';
}

export type FonteLancamento =
  | FonteCobranca
  | FonteContaAPagar
  | FonteRepasseProprietario
  | FonteConvenio;

/**
 * Contrato que TODO regime contábil deve implementar.
 * Stub-by-default pros 3 regimes não-cooperativos garante que a Receita
 * Federal não pode argumentar "aproveitamento por extensão indevida" —
 * cada regime tem implementação consciente OU bloqueio explícito.
 */
export interface RegimeContabil {
  readonly nome: string;

  /**
   * Classifica a natureza cooperativa do lançamento conforme a fonte.
   * Determinístico — mesma fonte = mesma natureza. Sem IA.
   */
  classificarLancamento(fonte: FonteLancamento): NaturezaCooperativa;
}

/**
 * Lançada quando regime não-implementado é invocado.
 * Mensagem explícita pra rastreabilidade — Receita Federal deve ver no
 * log que o sistema BLOQUEIA ao invés de simular.
 */
export class RegimeNaoImplementadoException extends Error {
  constructor(regime: string) {
    super(
      `Regime contábil '${regime}' ainda não implementado. ` +
        `Implementação dedicada obrigatória — não herdar de COOPERATIVO ` +
        `(risco P0-1: aproveitamento indevido de isenção fiscal). ` +
        `Vide docs/relatorios/2026-05-31-conformidade-contabil-multi-regime.md.`,
    );
    this.name = 'RegimeNaoImplementadoException';
  }
}
