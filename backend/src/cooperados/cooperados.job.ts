import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { PrismaService } from '../prisma.service';

@Injectable()
export class CooperadosJob {
  private readonly logger = new Logger(CooperadosJob.name);

  constructor(private prisma: PrismaService) {}

  @Cron('0 3 * * *')
  async limparCooperadosProxyExpirados() {
    const { count } = await this.prisma.cooperado.deleteMany({
      where: {
        status: 'PENDENTE_ASSINATURA',
        tokenAssinaturaExp: { lt: new Date() },
        contratos: { none: {} },
      },
    });
    if (count > 0) this.logger.log(String(count) + ' cooperado(s) proxy expirado(s) removidos');
  }
}
