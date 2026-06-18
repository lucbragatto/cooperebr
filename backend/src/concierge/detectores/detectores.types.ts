import type { FaturaCanonica } from '../fatura-canonica/fatura-canonica.types';

/**
 * Identificacao canonica do padrao detectado.
 *
 * Cada codigo carrega:
 *  - fundamento juridico (tema/sumula/lei)
 *  - tipo de tributo afetado
 *  - acao recomendada (T1-T4 do dossie CoopereBR)
 */
export type CodigoPadrao =
  | 'TEMA_69_STRICTO_DIVERGENCIA'
  | 'TESE_3_PIS_COFINS_SOBRE_SCEE'
  | 'TESE_2_ICMS_TUSD_GERACAO'
  | 'TESE_4_ICMS_RUBRICAS_EXCLUIDAS_GERAR'
  | 'TESE_6_ICMS_TUSD_TE_SOBRE_SCEE'
  | 'TESE_CDE_ESCASSEZ_HIDRICA'
  | 'TESE_ICMS_GROSS_UP'
  | 'TESE_DEMANDA_NAO_UTILIZADA';

/**
 * Sinal do indebito encontrado pelo detector.
 *
 * FAVORAVEL_AO_CLIENTE - concessionaria cobrou MENOS do que deveria
 *                        (raro, mas catalogamos pra audit). Nao gera acao.
 * INDEBITO_TRIBUTARIO  - concessionaria cobrou MAIS do que deveria.
 *                        Cliente paga em excesso. Acao judicial cabivel.
 * SEM_DIVERGENCIA      - cobrancas em linha com tese majoritaria. Nada a fazer.
 */
export type SinalDeteccao =
  | 'INDEBITO_TRIBUTARIO'
  | 'FAVORAVEL_AO_CLIENTE'
  | 'SEM_DIVERGENCIA';

/**
 * Fundamento juridico pra alimentar o BriefingAdvogado (Sprint C6).
 */
export interface FundamentoJuridico {
  /** Tema STF / Sumula STJ / artigo de lei principal */
  tema: string;
  /** Numero do RE / processo lider, quando aplicavel */
  numero?: string;
  /** Descricao curta da tese */
  ementa: string;
  /** Catalogacao do dossie CoopereBR (T1/T2/T3/T4) */
  classificacaoDossie?: 'T1' | 'T2' | 'T3' | 'T4_RETAGUARDA';
  /** Risco juridico declarado no dossie */
  risco: 'BAIXO' | 'MEDIO' | 'ALTO';
}

/**
 * Padrao detectado por um detector.
 * Compoe o array `padroesDetectados` do DiagnosticoIndebito (Sprint C1).
 */
export interface PadraoDetectado {
  codigo: CodigoPadrao;
  sinal: SinalDeteccao;

  /** Valor do indebito mensal em R$ (positivo se indebito; 0 se sem divergencia) */
  valorIndebitoMensal: number;

  /** Estimativa 60 meses + SELIC (multiplicador conservador 1.25 = ~25%) */
  valorIndebito60mSelic: number;

  /** Fundamento juridico aplicavel */
  fundamento: FundamentoJuridico;

  /** Detalhe textual auditavel (mostra os calculos) */
  detalhe: string;

  /** Rubricas envolvidas (descricaoOriginal) - rastreabilidade */
  rubricasEnvolvidas: string[];
}

/**
 * Resultado de um detector sobre uma fatura.
 */
export interface ResultadoDeteccao {
  /** Detector que rodou */
  detector: CodigoPadrao;
  /** Padrao encontrado (ou null se nao aplica) */
  padrao: PadraoDetectado | null;
}

/**
 * Interface Strategy de detector.
 */
export interface DetectorPadraoTributario {
  readonly codigo: CodigoPadrao;
  detectar(fatura: FaturaCanonica): ResultadoDeteccao;
}

/**
 * Helper: projeta indebito mensal pra 60 meses + SELIC ~25%.
 * Multiplicador conservador. C4 podera afinar com calculo de SELIC real.
 */
export function projetar60mSelic(indebitoMensal: number): number {
  if (indebitoMensal <= 0) return 0;
  return Math.round(indebitoMensal * 60 * 1.25 * 100) / 100;
}
