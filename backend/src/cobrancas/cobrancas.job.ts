import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from '../prisma.service';

@Injectable()
export class CobrancasJob {
  private readonly logger = new Logger(CobrancasJob.name);

  constructor(private prisma: PrismaService) {}

  @Cron(CronExpression.EVERY_DAY_AT_2AM)
  async marcarVencidas() {
    const hoje = new Date();
    hoje.setHours(0, 0, 0, 0);

    const { count } = await this.prisma.cobranca.updateMany({
      where: {
        status: 'PENDENTE',
        dataVencimento: { lt: hoje },
      },
      data: { status: 'VENCIDO' },
    });

    if (count > 0) {
      this.logger.log(`${count} cobrança(s) marcada(s) como VENCIDO`);
    }
  }
}
