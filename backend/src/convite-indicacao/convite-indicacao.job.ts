import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { PrismaService } from '../prisma.service';
import { ConviteIndicacaoService } from './convite-indicacao.service';
import { StatusConvite } from '@prisma/client';

@Injectable()
export class ConviteIndicacaoJob {
  private readonly logger = new Logger(ConviteIndicacaoJob.name);

  constructor(
    private prisma: PrismaService,
    private conviteService: ConviteIndicacaoService,
  ) {}

  /**
   * Diario as 10h: reenviar lembrete para convites PENDENTE
   * com ultimoEnvioEm < 3 dias atras e tentativasEnvio < 3
   */
  @Cron('0 10 * * *')
  async cronLembreteConvites() {
    this.logger.log('Iniciando lembretes de convites pendentes...');

    const tresDiasAtras = new Date();
    tresDiasAtras.setDate(tresDiasAtras.getDate() - 3);

    const convites = await this.prisma.conviteIndicacao.findMany({
      where: {
        status: { in: [StatusConvite.PENDENTE, StatusConvite.LEMBRETE_ENVIADO] },
        ultimoEnvioEm: { lte: tresDiasAtras },
        tentativasEnvio: { lt: 3 },
      },
      select: { id: true, cooperativaId: true },
    });

    this.logger.log(`${convites.length} convites para lembrete`);

    const BATCH_SIZE = 10;
    for (let i = 0; i < convites.length; i += BATCH_SIZE) {
      const batch = convites.slice(i, i + BATCH_SIZE);
      for (const convite of batch) {
        try {
          await this.conviteService.reenviarConvite(convite.id, convite.cooperativaId);
        } catch (err) {
          this.logger.warn(
            `Falha ao reenviar convite ${convite.id}: ${err.message}`,
          );
        }
      }
      // Delay 2s entre batches
      if (i + BATCH_SIZE < convites.length) {
        await new Promise((r) => setTimeout(r, 2000));
      }
    }

    this.logger.log(`Lembretes concluidos: ${convites.length} convites processados`);
  }

  /**
   * Diario as 3h: expirar convites com tentativasEnvio >= 3
   * e ultimoEnvioEm < 7 dias atras, ou de cooperados inativos
   */
  @Cron('0 3 * * *')
  async cronExpirarConvites() {
    this.logger.log('Iniciando expiracao de convites...');

    const seteDiasAtras = new Date();
    seteDiasAtras.setDate(seteDiasAtras.getDate() - 7);

    // Expirar convites com 3+ tentativas e sem acao ha 7+ dias
    const expirados = await this.prisma.conviteIndicacao.updateMany({
      where: {
        status: { in: [StatusConvite.PENDENTE, StatusConvite.LEMBRETE_ENVIADO] },
        tentativasEnvio: { gte: 3 },
        ultimoEnvioEm: { lte: seteDiasAtras },
      },
      data: { status: StatusConvite.EXPIRADO },
    });

    // Expirar convites de cooperados nao mais ATIVO
    const expiradosInativos = await this.prisma.$executeRaw`
      UPDATE convites_indicacao ci
      SET status = 'EXPIRADO', "updatedAt" = NOW()
      FROM cooperados c
      WHERE ci."cooperadoIndicadorId" = c.id
        AND c.status != 'ATIVO'
        AND ci.status IN ('PENDENTE', 'LEMBRETE_ENVIADO')
    `;

    this.logger.log(
      `Expiracao concluida: ${expirados.count} por tentativas, ${expiradosInativos} por indicador inativo`,
    );
  }
}
