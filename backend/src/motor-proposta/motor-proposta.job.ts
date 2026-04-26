import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from '../prisma.service';
import { EmailService } from '../email/email.service';
import { WhatsappSenderService } from '../whatsapp/whatsapp-sender.service';

@Injectable()
export class MotorPropostaJob {
  private readonly logger = new Logger(MotorPropostaJob.name);

  constructor(
    private prisma: PrismaService,
    private email: EmailService,
    private whatsappSender: WhatsappSenderService,
  ) {}

  /**
   * Sprint 10: envia lembrete para propostas com link de assinatura ativo
   * há mais de 24h e ainda não assinadas.
   */
  @Cron(CronExpression.EVERY_DAY_AT_9AM)
  async lembretePropostasPendentes() {
    if (process.env.NOTIFICACOES_ATIVAS !== 'true') return;

    const limite = new Date();
    limite.setHours(limite.getHours() - 24);

    const isDev = process.env.NODE_ENV !== 'production';

    const pendentes = await this.prisma.propostaCooperado.findMany({
      where: {
        tokenAssinatura: { not: null },
        lembreteEnviadoEm: null,
        termoAdesaoAssinadoEm: null,
        createdAt: { lt: limite },
        ...(isDev ? { cooperado: { ambienteTeste: false } } : {}),
      },
      include: {
        cooperado: {
          select: { nomeCompleto: true, email: true, telefone: true, cooperativaId: true },
        },
      },
    });

    if (pendentes.length === 0) return;

    const baseUrl = process.env.FRONTEND_URL ?? 'https://cooperebr.com.br';
    let enviados = 0;

    for (const proposta of pendentes) {
      const cooperado = proposta.cooperado;
      const link = `${baseUrl}/portal/assinar/${proposta.tokenAssinatura}`;
      const mensagem =
        `Olá, ${cooperado.nomeCompleto}! Lembrete: sua proposta CoopereBR ainda está aguardando assinatura. ` +
        `Acesse: ${link}`;

      if (cooperado.telefone) {
        try {
          await this.whatsappSender.enviarMensagem(cooperado.telefone, mensagem);
        } catch (err: unknown) {
          const msg = err instanceof Error ? err.message : 'erro desconhecido';
          this.logger.warn(`Falha WA lembrete proposta ${proposta.id}: ${msg}`);
        }
      }

      if (cooperado.email) {
        try {
          const html =
            `<p>Olá, <strong>${cooperado.nomeCompleto}</strong>!</p>` +
            `<p>Lembrete: sua proposta CoopereBR ainda está aguardando assinatura.</p>` +
            `<p>Para finalizar sua adesão, acesse o link abaixo:</p>` +
            `<p><a href="${link}">${link}</a></p>`;
          await this.email.enviarEmail(
            cooperado.email,
            'Lembrete: proposta CoopereBR aguardando assinatura',
            html,
            mensagem,
            cooperado.cooperativaId,
          );
        } catch (err: unknown) {
          const msg = err instanceof Error ? err.message : 'erro desconhecido';
          this.logger.warn(`Falha email lembrete proposta ${proposta.id}: ${msg}`);
        }
      }

      await this.prisma.propostaCooperado.update({
        where: { id: proposta.id },
        data: { lembreteEnviadoEm: new Date() },
      });
      enviados++;

      await new Promise(r => setTimeout(r, 2000 + Math.random() * 2000));
    }

    this.logger.log(`${enviados} lembrete(s) de proposta pendente enviado(s)`);
  }
}
