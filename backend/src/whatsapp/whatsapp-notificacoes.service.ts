/**
 * WhatsappNotificacoesService
 *
 * Facade centralizado de notificações WhatsApp por evento do ciclo de vida.
 * Agrupa todos os disparos automáticos da plataforma em um único ponto de
 * referência, delegando ao WhatsappCicloVidaService.
 *
 * Eventos cobertos:
 *  - Cadastro concluído
 *  - Documentos aprovados / reprovados
 *  - Contrato gerado / assinado/ativo
 *  - Concessionária aprovada
 *  - Créditos iniciados
 *  - Primeira fatura paga
 *  - Cobrança gerada (aviso de vencimento)
 *  - Pagamento confirmado
 *  - Cobrança vencida
 *  - Indicado cadastrou / pagou
 *  - Nível promovido no Clube de Vantagens
 *  - Resumo mensal do Clube
 */

import { Injectable } from '@nestjs/common';
import { WhatsappCicloVidaService } from './whatsapp-ciclo-vida.service';

type CooperadoBasico = {
  id: string;
  nomeCompleto: string;
  telefone?: string | null;
  cooperativaId?: string | null;
};

@Injectable()
export class WhatsappNotificacoesService {
  constructor(private readonly cicloVida: WhatsappCicloVidaService) {}

  /** Evento: Membro cadastrado (wizard ou bot) */
  membroCriado(cooperado: CooperadoBasico) {
    return this.cicloVida.notificarMembroCriado(cooperado);
  }

  /** Evento: Documento aprovado */
  documentoAprovado(cooperado: CooperadoBasico) {
    return this.cicloVida.notificarDocumentoAprovado(cooperado);
  }

  /** Evento: Documento reprovado */
  documentoReprovado(cooperado: CooperadoBasico, motivo: string) {
    return this.cicloVida.notificarDocumentoReprovado(cooperado, motivo);
  }

  /** Evento: Contrato gerado / pronto para assinatura */
  contratoGerado(cooperado: CooperadoBasico, linkContrato?: string) {
    return this.cicloVida.notificarContratoGerado(cooperado, linkContrato);
  }

  /** Evento: Concessionária aprovou / contrato ativo */
  concessionariaAprovada(cooperado: CooperadoBasico) {
    return this.cicloVida.notificarConcessionariaAprovada(cooperado);
  }

  /** Evento: Créditos solares iniciados (primeira injeção) */
  creditosIniciados(cooperado: CooperadoBasico) {
    return this.cicloVida.notificarCreditosIniciados(cooperado);
  }

  /** Evento: Pagamento de fatura confirmado */
  pagamentoConfirmado(cooperado: CooperadoBasico, valor: number, mesRef: string) {
    return this.cicloVida.notificarPagamentoConfirmado(cooperado, valor, mesRef);
  }

  /** Evento: Cobrança gerada (aviso de vencimento) */
  cobrancaGerada(cooperado: CooperadoBasico, mesRef: string, valor: number, vencimento: string) {
    return this.cicloVida.notificarCobrancaGerada(cooperado, mesRef, valor, vencimento);
  }

  /** Evento: Cobrança vencida */
  cobrancaVencida(cooperado: CooperadoBasico, valor: number, diasAtraso: number) {
    return this.cicloVida.notificarCobrancaVencida(cooperado, valor, diasAtraso);
  }

  /** Evento (para o indicador): Indicado concluiu cadastro */
  indicadoCadastrou(indicador: CooperadoBasico, nomeIndicado: string) {
    return this.cicloVida.notificarIndicadoCadastrou(indicador, nomeIndicado);
  }

  /** Evento (para o indicador): Indicado pagou fatura */
  indicadoPagou(indicador: CooperadoBasico, nomeIndicado: string, beneficio: string) {
    return this.cicloVida.notificarIndicadoPagou(indicador, nomeIndicado, beneficio);
  }

  /** Evento: Cooperado promovido de nível no Clube de Vantagens */
  nivelPromovido(
    cooperado: CooperadoBasico,
    nivelAnterior: string,
    nivelNovo: string,
    beneficioPercentual: number,
  ) {
    return this.cicloVida.notificarNivelPromovido(cooperado, nivelAnterior, nivelNovo, beneficioPercentual);
  }

  /** Evento: Resumo mensal do Clube de Vantagens (cron dia 1) */
  resumoMensal(
    cooperado: CooperadoBasico,
    dados: {
      nivelAtual: string;
      indicadosAtivos: number;
      beneficioMes: number;
      beneficioTotal: number;
      kwhAcumulado: number;
      linkIndicacao: string;
    },
  ) {
    return this.cicloVida.notificarResumoMensal(cooperado, dados);
  }
}
