/**
 * TokenNotificacaoService — Sprint Token-WA Fase 2 (F2.6, 07/06/2026).
 *
 * Camada fina de notificação pra fluxo CooperToken. Três responsabilidades:
 *
 * 1. notificarPagador: confirma transação pro lado que paga (via WA do
 *    cooperado pagador). Disparo pós-CONFIRMADA.
 *
 * 2. notificarRecebedor: confirma transação pro lado que recebe (cooperado
 *    estabelecimento). Inclui nome do pagador anonimizado se LGPD exigir.
 *
 * 3. enviarOtpAltoValorPorEmail: pra transações tier ALTO (>R$50 ou 1º
 *    uso/destinatário novo), além do OTP por WhatsApp, envia também por
 *    email do cooperado (defesa em profundidade — se WA estiver
 *    comprometido, email continua canal separado).
 *
 * Não persiste estado próprio — só orquestra envios. Idempotência é
 * responsabilidade do chamador (TokenTransacaoService da Fase 3).
 */

import { Injectable, Logger } from '@nestjs/common';
import { WhatsappSenderService } from '../whatsapp/whatsapp-sender.service';
import { EmailService } from '../email/email.service';

export interface NotificacaoPagadorParams {
  telefonePagador: string;
  nomePagador: string;
  cooperadoId: string;
  cooperativaId: string;
  valorReais: number;
  quantidadeTokens: number;
  nomeRecebedor: string;
  transacaoId: string;
  confirmadaEm: Date;
}

export interface NotificacaoRecebedorParams {
  telefoneRecebedor: string;
  nomeRecebedor: string;
  cooperadoRecebedorId: string;
  cooperativaId: string;
  valorReais: number;
  quantidadeTokens: number;
  /** Nome do pagador. Para LGPD em contextos públicos, pode vir parcial. */
  nomePagador: string;
  transacaoId: string;
  confirmadaEm: Date;
}

export interface OtpAltoValorPorEmailParams {
  emailDestino: string;
  nomeCooperado: string;
  cooperativaId: string;
  codigoOtp: string;
  valorReais: number;
  nomeRecebedor: string;
  expiraEm: Date;
  motivoStepUp: 'PRIMEIRO_USO' | 'DESTINATARIO_NOVO' | 'VALOR_ALTO';
}

function fmtReais(v: number): string {
  return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function fmtTokens(v: number): string {
  return v.toLocaleString('pt-BR', { minimumFractionDigits: 0, maximumFractionDigits: 4 });
}

function fmtDataHora(d: Date): string {
  return d.toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' });
}

@Injectable()
export class TokenNotificacaoService {
  private readonly logger = new Logger(TokenNotificacaoService.name);

  constructor(
    private readonly waSender: WhatsappSenderService,
    private readonly email: EmailService,
  ) {}

  /**
   * Envia confirmação de pagamento pro PAGADOR via WhatsApp.
   * Não lança em falha de WA — só loga (notificação é best-effort).
   */
  async notificarPagador(params: NotificacaoPagadorParams): Promise<void> {
    const texto =
      `✅ Pagamento confirmado\n\n` +
      `Olá, ${params.nomePagador}!\n\n` +
      `Você pagou ${fmtReais(params.valorReais)} (${fmtTokens(params.quantidadeTokens)} CooperTokens) ` +
      `para ${params.nomeRecebedor}.\n\n` +
      `Data: ${fmtDataHora(params.confirmadaEm)}\n` +
      `Comprovante: ${params.transacaoId}\n\n` +
      `Se não foi você, responda *NÃO FUI EU* para abrir contestação.`;

    try {
      await this.waSender.enviarMensagem(params.telefonePagador, texto, {
        tipoDisparo: 'TOKEN_PAGAMENTO_CONFIRMADO_PAGADOR',
        disparoId: params.transacaoId,
        cooperadoId: params.cooperadoId,
        cooperativaId: params.cooperativaId,
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      this.logger.warn(
        `[token-notif] Falha ao notificar pagador transacaoId=${params.transacaoId} erro=${msg}`,
      );
    }
  }

  /**
   * Envia confirmação de recebimento pro RECEBEDOR via WhatsApp.
   * Best-effort (não lança).
   */
  async notificarRecebedor(params: NotificacaoRecebedorParams): Promise<void> {
    const texto =
      `💰 Pagamento recebido\n\n` +
      `Olá, ${params.nomeRecebedor}!\n\n` +
      `Você recebeu ${fmtReais(params.valorReais)} ` +
      `(${fmtTokens(params.quantidadeTokens)} CooperTokens) de ${params.nomePagador}.\n\n` +
      `Data: ${fmtDataHora(params.confirmadaEm)}\n` +
      `Comprovante: ${params.transacaoId}`;

    try {
      await this.waSender.enviarMensagem(params.telefoneRecebedor, texto, {
        tipoDisparo: 'TOKEN_PAGAMENTO_CONFIRMADO_RECEBEDOR',
        disparoId: params.transacaoId,
        cooperadoId: params.cooperadoRecebedorId,
        cooperativaId: params.cooperativaId,
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      this.logger.warn(
        `[token-notif] Falha ao notificar recebedor transacaoId=${params.transacaoId} erro=${msg}`,
      );
    }
  }

  /**
   * Envia OTP de step-up alto valor por EMAIL (além do WhatsApp). Defesa em
   * profundidade — se WA está comprometido, email continua canal separado.
   *
   * Retorna true se envio foi aceito pelo SMTP; false se falhou.
   */
  async enviarOtpAltoValorPorEmail(params: OtpAltoValorPorEmailParams): Promise<boolean> {
    const motivoTexto = (() => {
      switch (params.motivoStepUp) {
        case 'PRIMEIRO_USO':
          return 'Esta é sua primeira transação CooperToken.';
        case 'DESTINATARIO_NOVO':
          return 'Você ainda não havia pago para este estabelecimento.';
        case 'VALOR_ALTO':
          return 'Esta transação está acima do limite de segurança automática.';
      }
    })();

    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #16a34a;">🔐 Confirmação de Pagamento CooperToken</h2>
        <p>Olá, <strong>${params.nomeCooperado}</strong>!</p>
        <p>${motivoTexto}</p>
        <p>Para autorizar o pagamento de <strong>${fmtReais(params.valorReais)}</strong> para <strong>${params.nomeRecebedor}</strong>, use o código abaixo no app:</p>
        <div style="background: #f0fdf4; border: 2px solid #16a34a; border-radius: 8px; padding: 16px; text-align: center; margin: 16px 0;">
          <span style="font-size: 32px; font-weight: bold; letter-spacing: 8px; color: #14532d;">${params.codigoOtp}</span>
        </div>
        <p style="color: #6b7280; font-size: 13px;">Este código expira em ${fmtDataHora(params.expiraEm)}.</p>
        <hr style="border: 0; border-top: 1px solid #e5e7eb; margin: 24px 0;">
        <p style="color: #b91c1c; font-size: 13px;">
          ⚠️ <strong>Não foi você?</strong> Responda <em>NÃO FUI EU</em> no WhatsApp ou ignore este e-mail.
          A transação será cancelada automaticamente em 10 minutos sem o código.
        </p>
      </div>
    `;

    try {
      const ok = await this.email.enviarEmail(
        params.emailDestino,
        `Código de confirmação CooperToken — ${fmtReais(params.valorReais)}`,
        html,
        undefined,
        params.cooperativaId,
      );
      if (!ok) {
        this.logger.warn(
          `[token-notif] Email OTP alto valor NÃO enviado destino=${params.emailDestino} cooperativaId=${params.cooperativaId}`,
        );
      }
      return ok;
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      this.logger.error(
        `[token-notif] Erro ao enviar email OTP alto valor destino=${params.emailDestino} erro=${msg}`,
      );
      return false;
    }
  }
}
