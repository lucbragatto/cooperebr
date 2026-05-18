/**
 * Eventos emitidos pelo módulo envio-lista-concessionaria.
 *
 * Sub-Fase 1 Fase 4 (M12, 18/05/2026): trigger ativação automática Contrato
 * PENDENTE_ATIVACAO → ATIVO quando cooperado é HOMOLOGADO pela concessionária.
 */

export const ENVIO_LISTA_EVENTS = {
  COOPERADO_HOMOLOGADO: 'envio-lista.cooperado-homologado',
} as const;

export interface CooperadoHomologadoEvent {
  cooperativaId: string;
  cooperadoId: string;
  contratoId: string;
  envioListaId: string;
  envioListaCooperadoId: string;
  usinaId: string;
  numeroProtocolo: string | null;
  dataHomologacao: Date;
  /** Se true, o contrato foi transitado PENDENTE_ATIVACAO → ATIVO neste evento. */
  contratoAtivadoAgora: boolean;
}
