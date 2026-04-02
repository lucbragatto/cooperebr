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

  // WA-BOT-04: Limpar cooperados PROXY_* zumbi (CPFs temporários com status PENDENTE há mais de 24h)
  @Cron('0 3 * * *')
  async limparCooperadosProxyZumbi() {
    const limite24h = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const { count } = await this.prisma.cooperado.deleteMany({
      where: {
        cpf: { startsWith: 'PROXY_' },
        status: 'PENDENTE',
        createdAt: { lt: limite24h },
        contratos: { none: {} },
      },
    });
    if (count > 0) this.logger.log(`${count} cooperado(s) PROXY_* zumbi removidos`);
  }
}
