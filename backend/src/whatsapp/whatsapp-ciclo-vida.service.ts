import { Injectable, Logger, Optional } from '@nestjs/common';
import { WhatsappSenderService } from './whatsapp-sender.service';
import { EmailService } from '../email/email.service';

@Injectable()
export class WhatsappCicloVidaService {
  private readonly logger = new Logger(WhatsappCicloVidaService.name);
  private readonly linkPortal = process.env.FRONTEND_URL ?? 'https://cooperebr.com.br';

  constructor(
    private sender: WhatsappSenderService,
    @Optional() private emailService?: EmailService,
  ) {}

  private async enviar(
    telefone: string | null | undefined,
    texto: string,
    opcoes?: { cooperadoId?: string; cooperativaId?: string; tipoDisparo?: string },
  ): Promise<boolean> {
    if (!telefone) {
      this.logger.warn('Tentativa de envio sem telefone — ignorando');
      return false;
    }
    try {
      await this.sender.enviarMensagem(telefone, texto, {
        tipoDisparo: opcoes?.tipoDisparo ?? 'CICLO_VIDA',
        cooperadoId: opcoes?.cooperadoId,
        cooperativaId: opcoes?.cooperativaId,
      });
      return true;
    } catch (err) {
      this.logger.warn(`Falha ao enviar ciclo-vida para ${telefone}: ${err.message}`);
      return false;
    }
  }

  async notificarMembroCriado(cooperado: { id: string; telefone?: string | null; nomeCompleto: string; email?: string | null; cooperativaId?: string | null }) {
    const texto = [
      `🌟 Bem-vindo à CoopereBR, ${cooperado.nomeCompleto}!`,
      ``,
      `É uma alegria ter você conosco! Você agora faz parte de uma cooperativa de energia solar que gera economia real para todos os membros.`,
      ``,
      `📋 Próximos passos:`,
      `1. Envie seus documentos pelo portal`,
      `2. Aguarde a análise da sua proposta`,
      `3. Em breve você começa a economizar!`,
      ``,
      `🔗 Acesse seu portal: ${this.linkPortal}/portal`,
      `Qualquer dúvida, estamos aqui! 😊`,
    ].join('\n');
    this.emailService?.enviarBoasVindas(cooperado).catch(() => {});
    return this.enviar(cooperado.telefone, texto, { cooperadoId: cooperado.id, cooperativaId: cooperado.cooperativaId ?? undefined });
  }

  async notificarDocumentoAprovado(cooperado: { id: string; telefone?: string | null; nomeCompleto: string; email?: string | null; cooperativaId?: string | null }) {
    const texto = [
      `✅ Boa notícia, ${cooperado.nomeCompleto}!`,
      ``,
      `Seus documentos foram aprovados! Estamos preparando seu contrato e em breve você receberá o link para assinar.`,
      ``,
      `⏳ Prazo estimado: 1-2 dias úteis`,
      ``,
      `🔗 Acompanhe pelo portal: ${this.linkPortal}/portal`,
    ].join('\n');
    this.emailService?.enviarDocumentoAprovado(cooperado).catch(() => {});
    return this.enviar(cooperado.telefone, texto, { cooperadoId: cooperado.id, cooperativaId: cooperado.cooperativaId ?? undefined });
  }

  async notificarDocumentoReprovado(cooperado: { id: string; telefone?: string | null; nomeCompleto: string; email?: string | null; cooperativaId?: string | null }, motivo: string) {
    const texto = [
      `⚠️ ${cooperado.nomeCompleto}, precisamos da sua ajuda!`,
      ``,
      `Um ou mais documentos precisam ser corrigidos:`,
      `📌 Motivo: ${motivo}`,
      ``,
      `Por favor, acesse o portal e reenvie os documentos corrigidos.`,
      ``,
      `🔗 ${this.linkPortal}/portal/documentos`,
      ``,
      `Qualquer dúvida, é só chamar! 👋`,
    ].join('\n');
    this.emailService?.enviarDocumentoReprovado(cooperado, motivo).catch(() => {});
    return this.enviar(cooperado.telefone, texto, { cooperadoId: cooperado.id, cooperativaId: cooperado.cooperativaId ?? undefined });
  }

  async notificarContratoGerado(cooperado: { id: string; telefone?: string | null; nomeCompleto: string; email?: string | null; cooperativaId?: string | null }, linkContrato?: string) {
    const link = linkContrato ?? `${this.linkPortal}/portal/documentos`;
    const texto = [
      `📄 Seu contrato está pronto, ${cooperado.nomeCompleto}!`,
      ``,
      `Acesse o link abaixo para revisar e assinar digitalmente. É rápido e seguro!`,
      ``,
      `✍️ Assinar contrato: ${link}`,
      ``,
      `Após a assinatura, iniciaremos a alocação dos seus créditos de energia. ⚡`,
    ].join('\n');
    this.emailService?.enviarContratoGerado(cooperado, linkContrato).catch(() => {});
    return this.enviar(cooperado.telefone, texto, { cooperadoId: cooperado.id, cooperativaId: cooperado.cooperativaId ?? undefined });
  }

  async notificarConcessionariaAprovada(cooperado: { id: string; telefone?: string | null; nomeCompleto: string; cooperativaId?: string | null }) {
    const texto = [
      `⚡ Tudo certo, ${cooperado.nomeCompleto}!`,
      ``,
      `Sua solicitação foi aprovada junto à distribuidora de energia. Em breve você começará a receber os créditos de energia solar na sua conta de luz!`,
      ``,
      `🌞 Bem-vindo ao clube da energia limpa!`,
    ].join('\n');
    return this.enviar(cooperado.telefone, texto, { cooperadoId: cooperado.id, cooperativaId: cooperado.cooperativaId ?? undefined });
  }

  async notificarCreditosIniciados(cooperado: { id: string; telefone?: string | null; nomeCompleto: string; cooperativaId?: string | null }) {
    const texto = [
      `🎉 Seus créditos de energia começaram, ${cooperado.nomeCompleto}!`,
      ``,
      `A partir de agora, você verá descontos na sua conta de luz todos os meses. O valor exato aparecerá na sua próxima fatura da distribuidora.`,
      ``,
      `💡 Acompanhe seus créditos no portal:`,
      `🔗 ${this.linkPortal}/portal/ucs`,
    ].join('\n');
    return this.enviar(cooperado.telefone, texto, { cooperadoId: cooperado.id, cooperativaId: cooperado.cooperativaId ?? undefined });
  }

  async notificarPagamentoConfirmado(cooperado: { id: string; telefone?: string | null; nomeCompleto: string; cooperativaId?: string | null }, valor: number, mesRef: string) {
    const agora = new Date();
    const dataHora = `${agora.toLocaleDateString('pt-BR')} ${agora.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}`;
    const texto = [
      `✅ Pagamento confirmado, ${cooperado.nomeCompleto}!`,
      ``,
      `Obrigado pelo pagamento referente a ${mesRef}.`,
      ``,
      `💰 Valor: R$ ${valor.toFixed(2)}`,
      `🕐 Confirmado em: ${dataHora}`,
      ``,
      `Seu histórico completo está disponível no portal:`,
      `🔗 ${this.linkPortal}/portal/financeiro`,
      ``,
      `Até o próximo mês! 🌞`,
    ].join('\n');
    return this.enviar(cooperado.telefone, texto, { cooperadoId: cooperado.id, cooperativaId: cooperado.cooperativaId ?? undefined });
  }

  async notificarCobrancaGerada(
    cooperado: { id: string; telefone?: string | null; nomeCompleto: string; cooperativaId?: string | null },
    mesRef: string,
    valor: number,
    vencimento: string,
    linkPortal?: string,
  ) {
    const portal = linkPortal ?? this.linkPortal;
    const texto = [
      `💡 Olá, ${cooperado.nomeCompleto}! Sua fatura chegou.`,
      ``,
      `📅 Referência: ${mesRef}`,
      `💰 Valor: R$ ${valor.toFixed(2)}`,
      `📆 Vencimento: ${vencimento}`,
      ``,
      `Lembre-se: o valor da sua fatura CoopereBR é bem menor do que você pagaria sem a cooperativa! 😊`,
      ``,
      `💳 Pague agora pelo portal:`,
      `🔗 ${portal}/portal/financeiro`,
      ``,
      `Dúvidas? É só chamar!`,
    ].join('\n');
    return this.enviar(cooperado.telefone, texto, { cooperadoId: cooperado.id, cooperativaId: cooperado.cooperativaId ?? undefined, tipoDisparo: 'COBRANCA_GERADA' });
  }

  async notificarCobrancaProximaVencer(
    cooperado: { id: string; telefone?: string | null; nomeCompleto: string; cooperativaId?: string | null },
    valor: number,
    diasParaVencer: number,
    vencimento: string,
  ) {
    const urgencia = diasParaVencer <= 1 ? '⏰ URGENTE' : '🔔 Lembrete';
    const texto = [
      `${urgencia} — ${cooperado.nomeCompleto}, sua fatura vence em ${diasParaVencer} dia(s)!`,
      ``,
      `💰 Valor: R$ ${valor.toFixed(2)}`,
      `📆 Vencimento: ${vencimento}`,
      ``,
      `Evite multa e juros pagando pelo portal:`,
      `🔗 ${this.linkPortal}/portal/financeiro`,
    ].join('\n');
    return this.enviar(cooperado.telefone, texto, {
      cooperadoId: cooperado.id,
      cooperativaId: cooperado.cooperativaId ?? undefined,
      tipoDisparo: diasParaVencer <= 1 ? 'LEMBRETE_D1' : 'LEMBRETE_D3',
    });
  }

  async notificarCobrancaVencida(cooperado: { id: string; telefone?: string | null; nomeCompleto: string; cooperativaId?: string | null }, valor: number, diasAtraso: number) {
    const texto = [
      `⚠️ ${cooperado.nomeCompleto}, sua fatura está em aberto!`,
      ``,
      `Identificamos que há ${diasAtraso} dia(s) de atraso no pagamento de R$ ${valor.toFixed(2)}.`,
      ``,
      `Para evitar juros e manter seus benefícios ativos, regularize o quanto antes:`,
      `🔗 ${this.linkPortal}/portal/financeiro`,
      ``,
      `Se tiver alguma dificuldade, podemos conversar sobre opções! É só responder esta mensagem. 🤝`,
    ].join('\n');
    return this.enviar(cooperado.telefone, texto, { cooperadoId: cooperado.id, cooperativaId: cooperado.cooperativaId ?? undefined });
  }

  async notificarIndicadoCadastrou(indicador: { id: string; telefone?: string | null; nomeCompleto: string; cooperativaId?: string | null }, nomeIndicado: string) {
    const texto = `🎉 ${indicador.nomeCompleto}, ${nomeIndicado} se cadastrou pelo seu convite! Quando pagar a primeira fatura, você receberá seu benefício.`;
    return this.enviar(indicador.telefone, texto, { cooperadoId: indicador.id, cooperativaId: indicador.cooperativaId ?? undefined });
  }

  async notificarIndicadoPagou(indicador: { id: string; telefone?: string | null; nomeCompleto: string; cooperativaId?: string | null }, nomeIndicado: string, beneficio: string) {
    const texto = `💰 ${indicador.nomeCompleto}, ${nomeIndicado} pagou a fatura! Seu benefício de ${beneficio} foi gerado.`;
    return this.enviar(indicador.telefone, texto, { cooperadoId: indicador.id, cooperativaId: indicador.cooperativaId ?? undefined });
  }

  async notificarNivelPromovido(
    cooperado: { id: string; telefone?: string | null; nomeCompleto: string; cooperativaId?: string | null },
    nivelAnterior: string,
    nivelNovo: string,
    beneficioPercentual: number,
  ) {
    const texto = [
      `🏆 Parabéns, ${cooperado.nomeCompleto}! Você subiu de nível!`,
      ``,
      `Você acabou de alcançar o nível ${nivelNovo} no Clube de Vantagens CoopereBR! 🎉`,
      ``,
      `⭐ Nível anterior: ${nivelAnterior}`,
      `🌟 Novo nível: ${nivelNovo}`,
      `💎 Novo benefício: ${beneficioPercentual}%`,
      ``,
      `Continue indicando amigos e familiares para subir ainda mais! 🚀`,
      `🔗 Ver meu nível: ${this.linkPortal}/portal/indicacoes`,
    ].join('\n');
    return this.enviar(cooperado.telefone, texto, { cooperadoId: cooperado.id, cooperativaId: cooperado.cooperativaId ?? undefined });
  }

  async notificarResumoMensal(
    cooperado: { id: string; telefone?: string | null; nomeCompleto: string; cooperativaId?: string | null },
    dados: {
      nivelAtual: string;
      indicadosAtivos: number;
      beneficioMes: number;
      beneficioTotal: number;
      kwhAcumulado: number;
      linkIndicacao: string;
    },
  ) {
    const texto = [
      `📊 Resumo mensal do Clube de Vantagens`,
      ``,
      `Olá, ${cooperado.nomeCompleto}!`,
      ``,
      `🏅 Nível atual: ${dados.nivelAtual}`,
      `👥 Indicados ativos: ${dados.indicadosAtivos}`,
      `⚡ kWh acumulados: ${dados.kwhAcumulado.toFixed(0)}`,
      `💰 Benefício este mês: R$ ${dados.beneficioMes.toFixed(2)}`,
      `💰 Benefício total: R$ ${dados.beneficioTotal.toFixed(2)}`,
      ``,
      `Indique mais amigos: ${dados.linkIndicacao}`,
    ].join('\n');
    return this.enviar(cooperado.telefone, texto, { cooperadoId: cooperado.id, cooperativaId: cooperado.cooperativaId ?? undefined });
  }

  // ─── Convênios ──────────────────────────────────────────────────────────

  async notificarFaixaConvenioAlterada(
    cooperado: { id: string; telefone?: string | null; nomeCompleto: string; cooperativaId?: string | null },
    dados: { convenioNome: string; faixaAnterior: number; faixaNova: number; descontoNovo: number },
  ) {
    const direcao = dados.faixaNova > dados.faixaAnterior ? 'subiu' : 'mudou';
    const emoji = dados.faixaNova > dados.faixaAnterior ? '📈' : '📉';
    const texto = [
      `${emoji} Convênio ${dados.convenioNome}`,
      ``,
      `Olá, ${cooperado.nomeCompleto}!`,
      ``,
      `A faixa do seu convênio ${direcao}: Faixa ${dados.faixaAnterior + 1} → Faixa ${dados.faixaNova + 1}`,
      `💎 Novo desconto: ${dados.descontoNovo}%`,
      ``,
      `🔗 Ver detalhes: ${this.linkPortal}/portal/convenio`,
    ].join('\n');
    return this.enviar(cooperado.telefone, texto, {
      cooperadoId: cooperado.id,
      cooperativaId: cooperado.cooperativaId ?? undefined,
      tipoDisparo: 'CONVENIO',
    });
  }

  async notificarMembroConvenioAdicionado(
    cooperado: { id: string; telefone?: string | null; nomeCompleto: string; cooperativaId?: string | null },
    convenioNome: string,
  ) {
    const texto = [
      `🤝 Você foi adicionado ao convênio "${convenioNome}"!`,
      ``,
      `Olá, ${cooperado.nomeCompleto}!`,
      ``,
      `Agora você faz parte deste convênio e receberá descontos adicionais na sua conta de energia.`,
      ``,
      `🔗 Ver detalhes: ${this.linkPortal}/portal`,
    ].join('\n');
    return this.enviar(cooperado.telefone, texto, {
      cooperadoId: cooperado.id,
      cooperativaId: cooperado.cooperativaId ?? undefined,
      tipoDisparo: 'CONVENIO',
    });
  }
}
