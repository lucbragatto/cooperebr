import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from '../prisma.service';

@Injectable()
export class WhatsappConversaJob {
  private readonly logger = new Logger(WhatsappConversaJob.name);

  /**
   * Reseta conversas paradas em estado AGUARDANDO_* há mais de 24h (WA-16).
   * Roda a cada hora para limpar conversas mortas.
   */
  @Cron(CronExpression.EVERY_HOUR)
  async resetarConversasInativas() {
    const limite = new Date();
    limite.setHours(limite.getHours() - 24);

    const { count } = await this.prisma.conversaWhatsapp.updateMany({
      where: {
        estado: { startsWith: 'AGUARDANDO_' },
        updatedAt: { lt: limite },
      },
      data: { estado: 'INICIAL', dadosTemp: undefined, contadorFallback: 0 },
    });

    if (count > 0) {
      this.logger.log(`${count} conversa(s) inativa(s) resetada(s) para INICIAL`);
    }
  }

  constructor(private prisma: PrismaService) {}
}
