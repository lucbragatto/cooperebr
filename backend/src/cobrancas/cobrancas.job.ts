import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from '../prisma.service';
import { WhatsappCicloVidaService } from '../whatsapp/whatsapp-ciclo-vida.service';

@Injectable()
export class CobrancasJob {
  private readonly logger = new Logger(CobrancasJob.name);

  constructor(
    private prisma: PrismaService,
    private whatsappCicloVida: WhatsappCicloVidaService,
  ) {}

  @Cron(CronExpression.EVERY_DAY_AT_2AM)
  async marcarVencidas() {
    const hoje = new Date();
    hoje.setHours(0, 0, 0, 0);

    const { count } = await this.prisma.cobranca.updateMany({
      where: {
        status: { in: ['A_VENCER', 'PENDENTE'] },
        dataVencimento: { lt: hoje },
      },
      data: { status: 'VENCIDO' },
    });

    if (count > 0) {
      this.logger.log(`${count} cobrança(s) marcada(s) como VENCIDO`);
    }
  }

  /**
   * Calcula multa e juros para cobranças vencidas, respeitando
   * a configuração financeira da cooperativa (diasCarencia, multaAtraso, jurosDiarios).
   */
  @Cron(CronExpression.EVERY_DAY_AT_3AM)
  async calcularMultaJuros() {
    const hoje = new Date();
    hoje.setHours(0, 0, 0, 0);

    const vencidas = await this.prisma.cobranca.findMany({
      where: { status: 'VENCIDO' },
      include: {
        contrato: {
          select: { cooperativaId: true },
        },
      },
    });

    if (vencidas.length === 0) return;

    // Buscar config financeira de todas as cooperativas envolvidas
    const cooperativaIds = [...new Set(vencidas.map((c) => c.contrato?.cooperativaId || c.cooperativaId).filter(Boolean))] as string[];
    const cooperativas = await this.prisma.cooperativa.findMany({
      where: { id: { in: cooperativaIds } },
      select: { id: true, multaAtraso: true, jurosDiarios: true, diasCarencia: true },
    });
    const configMap = new Map(cooperativas.map((c) => [c.id, c]));

    let atualizadas = 0;
    for (const cobranca of vencidas) {
      const coopId = cobranca.contrato?.cooperativaId || cobranca.cooperativaId;
      if (!coopId) continue;

      const config = configMap.get(coopId);
      if (!config) continue;

      const diasCarencia = config.diasCarencia;
      const vencimento = new Date(cobranca.dataVencimento);
      vencimento.setHours(0, 0, 0, 0);
      const diasAtraso = Math.floor((hoje.getTime() - vencimento.getTime()) / (1000 * 60 * 60 * 24));

      if (diasAtraso <= diasCarencia) continue;

      const diasEfetivos = diasAtraso - diasCarencia;
      const valorOriginal = Number(cobranca.valorLiquido);
      const multa = valorOriginal * (Number(config.multaAtraso) / 100);
      const juros = valorOriginal * (Number(config.jurosDiarios) / 100) * diasEfetivos;

      // Recalcula sempre baseado no valorLiquido original
      const valorAtualizado = valorOriginal + multa + juros;

      await this.prisma.cobranca.update({
        where: { id: cobranca.id },
        data: {
          valorMulta: multa,
          valorJuros: juros,
          valorAtualizado,
        },
      });

      this.logger.debug(
        `Cobrança ${cobranca.id}: ${diasEfetivos} dias efetivos, multa R$${multa.toFixed(2)}, juros R$${juros.toFixed(2)}, total R$${valorAtualizado.toFixed(2)}`,
      );
      atualizadas++;
    }

    if (atualizadas > 0) {
      this.logger.log(`${atualizadas} cobrança(s) com multa/juros calculados`);
    }
  }

  /**
   * Notifica cooperados com cobranças vencidas via WhatsApp (diário às 6h).
   * Só notifica uma vez por cobrança (flag notificadoVencimento).
   */
  @Cron('0 6 * * *')
  async notificarCobrancasVencidas() {
    const ontem = new Date();
    ontem.setDate(ontem.getDate() - 1);
    ontem.setHours(0, 0, 0, 0);

    const hoje = new Date();
    hoje.setHours(0, 0, 0, 0);

    const cobrancas = await this.prisma.cobranca.findMany({
      where: {
        status: { in: ['PENDENTE', 'VENCIDO'] as any },
        dataVencimento: { lt: hoje },
        notificadoVencimento: false,
      },
      include: {
        contrato: {
          include: {
            cooperado: {
              select: { id: true, telefone: true, nomeCompleto: true, cooperativaId: true },
            },
            cooperativa: {
              select: { id: true, intervaloMinCobrancaHoras: true },
            },
          },
        },
      },
    });

    if (cobrancas.length === 0) return;

    const agora = new Date();
    let enviados = 0;
    let ignorados = 0;
    for (const cobranca of cobrancas) {
      const cooperado = cobranca.contrato?.cooperado;
      if (!cooperado?.telefone) continue;

      // Rate limit: respeitar intervalo mínimo configurável por cooperativa
      const intervaloHoras = (cobranca.contrato?.cooperativa as any)?.intervaloMinCobrancaHoras ?? 24;
      if (cobranca.ultimaCobrancaWhatsappEm) {
        const limiteMinimo = new Date(cobranca.ultimaCobrancaWhatsappEm.getTime() + intervaloHoras * 60 * 60 * 1000);
        if (agora < limiteMinimo) {
          ignorados++;
          continue;
        }
      }

      const vencimento = new Date(cobranca.dataVencimento);
      vencimento.setHours(0, 0, 0, 0);
      const diasAtraso = Math.floor((hoje.getTime() - vencimento.getTime()) / (1000 * 60 * 60 * 24));
      const valor = Number(cobranca.valorAtualizado ?? cobranca.valorLiquido);

      try {
        await this.whatsappCicloVida.notificarCobrancaVencida(cooperado, valor, diasAtraso);
        await this.prisma.cobranca.update({
          where: { id: cobranca.id },
          data: { notificadoVencimento: true, ultimaCobrancaWhatsappEm: new Date() },
        });
        enviados++;
      } catch (err) {
        this.logger.warn(`Falha ao notificar cobrança vencida ${cobranca.id}: ${err.message}`);
      }

      await new Promise(r => setTimeout(r, 3000 + Math.random() * 2000));
    }

    if (enviados > 0 || ignorados > 0) {
      this.logger.log(`Notificações cobrança vencida: ${enviados} enviada(s), ${ignorados} ignorada(s) por rate limit`);
    }
  }
}
