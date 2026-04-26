import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from '../prisma.service';
import { WhatsappCicloVidaService } from '../whatsapp/whatsapp-ciclo-vida.service';
import { EmailService } from '../email/email.service';
import { CalculoMultaJurosService } from './calculo-multa-juros.service';

@Injectable()
export class CobrancasJob {
  private readonly logger = new Logger(CobrancasJob.name);

  constructor(
    private prisma: PrismaService,
    private whatsappCicloVida: WhatsappCicloVidaService,
    private email: EmailService,
    private calculoMultaJuros: CalculoMultaJurosService,
  ) {}

  /**
   * Sprint 10: lembretes D-3 e D-1 antes do vencimento (diário às 8h).
   * Marca lembreteD3EnviadoEm / lembreteD1EnviadoEm para não repetir.
   */
  @Cron('0 8 * * *')
  async lembretesPreVencimento() {
    if (process.env.NOTIFICACOES_ATIVAS !== 'true') return;

    await this.enviarLembretePreVencimento(3);
    await this.enviarLembretePreVencimento(1);
  }

  private async enviarLembretePreVencimento(diasAntes: 1 | 3) {
    const hoje = new Date();
    hoje.setHours(0, 0, 0, 0);

    const alvo = new Date(hoje);
    alvo.setDate(alvo.getDate() + diasAntes);
    const proximoDia = new Date(alvo);
    proximoDia.setDate(proximoDia.getDate() + 1);

    const campoFlag = diasAntes === 3 ? 'lembreteD3EnviadoEm' : 'lembreteD1EnviadoEm';
    const isDev = process.env.NODE_ENV !== 'production';

    const cobrancas = await this.prisma.cobranca.findMany({
      where: {
        status: { in: ['A_VENCER', 'PENDENTE'] },
        dataVencimento: { gte: alvo, lt: proximoDia },
        [campoFlag]: null,
        contrato: {
          status: 'ATIVO',
          cooperado: {
            status: 'ATIVO',
            ...(isDev ? { ambienteTeste: false } : {}),
          },
        },
      },
      include: {
        contrato: {
          include: {
            cooperado: {
              select: { id: true, telefone: true, email: true, nomeCompleto: true, cooperativaId: true },
            },
          },
        },
      },
    });

    if (cobrancas.length === 0) return;

    let enviados = 0;
    for (const cobranca of cobrancas) {
      const cooperado = cobranca.contrato?.cooperado;
      if (!cooperado) continue;

      const valor = Number(cobranca.valorLiquido);
      const venc = new Date(cobranca.dataVencimento);
      const vencStr = venc.toLocaleDateString('pt-BR');
      const mesRef = `${String(cobranca.mesReferencia).padStart(2, '0')}/${cobranca.anoReferencia}`;

      if (cooperado.telefone) {
        try {
          await this.whatsappCicloVida.notificarCobrancaProximaVencer(cooperado, valor, diasAntes, vencStr);
        } catch (err: unknown) {
          const msg = err instanceof Error ? err.message : 'erro desconhecido';
          this.logger.warn(`Falha WA D-${diasAntes} cobrança ${cobranca.id}: ${msg}`);
        }
      }

      if (cooperado.email) {
        try {
          const html =
            `<p>Olá, <strong>${cooperado.nomeCompleto}</strong>!</p>` +
            `<p>Sua fatura CoopereBR referente a <strong>${mesRef}</strong> vence em <strong>${diasAntes} dia(s)</strong>.</p>` +
            `<p>Valor: <strong>R$ ${valor.toFixed(2)}</strong><br>` +
            `Vencimento: <strong>${vencStr}</strong></p>` +
            `<p>Acesse o portal para efetuar o pagamento e evitar multa/juros.</p>`;
          const texto =
            `Olá ${cooperado.nomeCompleto}! Sua fatura ${mesRef} de R$ ${valor.toFixed(2)} vence em ${diasAntes} dia(s) (${vencStr}).`;
          await this.email.enviarEmail(
            cooperado.email,
            `Lembrete: fatura CoopereBR vence em ${diasAntes} dia(s)`,
            html,
            texto,
            cooperado.cooperativaId,
          );
        } catch (err: unknown) {
          const msg = err instanceof Error ? err.message : 'erro desconhecido';
          this.logger.warn(`Falha email D-${diasAntes} cobrança ${cobranca.id}: ${msg}`);
        }
      }

      await this.prisma.cobranca.update({
        where: { id: cobranca.id },
        data: { [campoFlag]: new Date() },
      });
      enviados++;

      await new Promise(r => setTimeout(r, 2000 + Math.random() * 2000));
    }

    this.logger.log(`Lembretes D-${diasAntes}: ${enviados} enviado(s)`);
  }

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
      where: {
        status: 'VENCIDO',
        contrato: {
          status: 'ATIVO',
          cooperado: { status: 'ATIVO' },
        },
      },
      include: {
        contrato: {
          select: { cooperativaId: true },
        },
      },
    });

    if (vencidas.length === 0) return;

    let atualizadas = 0;
    for (const cobranca of vencidas) {
      const coopId = cobranca.contrato?.cooperativaId || cobranca.cooperativaId;
      if (!coopId) continue;

      const calculo = await this.calculoMultaJuros.calcular(
        Number(cobranca.valorLiquido),
        cobranca.dataVencimento,
        coopId,
        hoje,
      );

      if (calculo.diasEfetivos <= 0) continue;

      await this.prisma.cobranca.update({
        where: { id: cobranca.id },
        data: {
          valorMulta: calculo.multa,
          valorJuros: calculo.juros,
          valorAtualizado: calculo.valorAtualizado,
        },
      });

      this.logger.debug(
        `Cobrança ${cobranca.id}: ${calculo.diasEfetivos} dias efetivos, multa R$${calculo.multa.toFixed(2)}, juros R$${calculo.juros.toFixed(2)}, total R$${calculo.valorAtualizado.toFixed(2)}`,
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
  @Cron('15 6 * * *')
  async notificarCobrancasVencidas() {
    const ontem = new Date();
    ontem.setDate(ontem.getDate() - 1);
    ontem.setHours(0, 0, 0, 0);

    const hoje = new Date();
    hoje.setHours(0, 0, 0, 0);

    const cobrancas = await this.prisma.cobranca.findMany({
      where: {
        status: { in: ['PENDENTE', 'A_VENCER', 'VENCIDO'] },
        dataVencimento: { lt: hoje },
        notificadoVencimento: false,
        contrato: {
          status: 'ATIVO',
          cooperado: { status: 'ATIVO' },
        },
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
