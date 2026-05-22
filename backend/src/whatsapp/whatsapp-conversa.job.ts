import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from '../prisma.service';
import { WhatsappSenderService } from './whatsapp-sender.service';

@Injectable()
export class WhatsappConversaJob {
  private readonly logger = new Logger(WhatsappConversaJob.name);

  constructor(
    private prisma: PrismaService,
    private sender: WhatsappSenderService,
  ) {}

  /**
   * Reseta conversas paradas em estado AGUARDANDO_* há mais de 24h (WA-16).
   * Roda a cada hora para limpar conversas mortas.
   *
   * Bloco 1.b (22/05) — Guard defensivo: exclui AGENDADO_RETORNO e ENCERRADO
   * explicitamente. AGENDADO_RETORNO ja nao casa o startsWith('AGUARDANDO_')
   * por prefixo distinto, mas a exclusao explicita documenta a intencao e
   * previne regressao futura (ex: alguem renomeando estado pra AGUARDANDO_*).
   */
  @Cron(CronExpression.EVERY_HOUR)
  async resetarConversasInativas() {
    const limite = new Date();
    limite.setHours(limite.getHours() - 24);

    const { count } = await this.prisma.conversaWhatsapp.updateMany({
      where: {
        AND: [
          { estado: { startsWith: 'AGUARDANDO_' } },
          { estado: { notIn: ['AGENDADO_RETORNO', 'ENCERRADO'] } },
        ],
        updatedAt: { lt: limite },
      },
      data: { estado: 'INICIAL', dadosTemp: undefined, contadorFallback: 0 },
    });

    if (count > 0) {
      this.logger.log(`${count} conversa(s) inativa(s) resetada(s) para INICIAL`);
    }
  }

  /**
   * Bloco 1.b (22/05) — Processa retornos agendados via "ME CHAME DEPOIS".
   * Roda a cada hora junto com o reset de inativas.
   *
   * Decisoes Luciano 22/05:
   *  1. +24h FIXO (calculado em calcularRetornarEm do motor, postergado pra
   *     08:00 se cair fora de 08-18h).
   *  2. Volta pro MENU_COOPERADO (com cooperadoId) ou INICIAL (lead).
   *  3. Respeitar horario comercial 08-18h: cron so processa nesse intervalo.
   *     Conversas com retornarEm em horario nao-comercial ficam pendentes
   *     ate o proximo ciclo do cron dentro do horario.
   *
   * Sabado/domingo aceitos — filtro 08-18h cobre hora do dia, nao dia da semana.
   *
   * Cron eh cross-tenant por natureza (varre todas as conversas em
   * AGENDADO_RETORNO). Cada envio eh pra uma conversa especifica — destino
   * (telefone) e conteudo saem da propria conversa. WhatsappSenderService ja
   * carrega as camadas de protecao de ambiente (isAmbienteReal etc).
   */
  @Cron(CronExpression.EVERY_HOUR)
  async processarRetornosAgendados() {
    const agora = new Date();
    const hora = agora.getHours();
    if (hora < 8 || hora >= 18) {
      return; // fora do horario comercial — proximo ciclo dentro do horario processa
    }

    const conversas = await this.prisma.conversaWhatsapp.findMany({
      where: { estado: 'AGENDADO_RETORNO' },
    });

    let processadas = 0;
    let puladasFuturo = 0;
    let puladasInvalidas = 0;

    for (const conversa of conversas) {
      const dados = (conversa.dadosTemp ?? {}) as Record<string, unknown>;
      const retornarEmRaw = dados.retornarEm;

      if (typeof retornarEmRaw !== 'string' || !retornarEmRaw) {
        puladasInvalidas++;
        continue;
      }

      const retornarEm = new Date(retornarEmRaw);
      if (Number.isNaN(retornarEm.getTime())) {
        puladasInvalidas++;
        continue;
      }
      if (retornarEm > agora) {
        puladasFuturo++;
        continue;
      }

      // Decisao Luciano (2): volta pro MENU_COOPERADO se cooperado conhecido;
      // senao volta pro INICIAL (lead).
      const proximoEstado = conversa.cooperadoId ? 'MENU_COOPERADO' : 'INICIAL';

      // Preserva outros campos do dadosTemp ao remover retornarEm.
      const dadosTempLimpo = { ...dados };
      delete dadosTempLimpo.retornarEm;

      try {
        await this.prisma.conversaWhatsapp.update({
          where: { id: conversa.id },
          data: {
            estado: proximoEstado,
            dadosTemp: dadosTempLimpo as any,
          },
        });
        await this.sender.enviarMensagem(
          conversa.telefone,
          'Voltei como combinado. 👋 Em que posso ajudar?',
        );
        processadas++;
        this.logger.log(
          `Retorno agendado processado: conversa ${conversa.id} -> ${proximoEstado} (telefone ${conversa.telefone})`,
        );
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'erro desconhecido';
        this.logger.error(
          `Falha ao processar retorno agendado conversa ${conversa.id}: ${msg}`,
        );
      }
    }

    if (processadas > 0 || puladasInvalidas > 0) {
      this.logger.log(
        `processarRetornosAgendados: ${processadas} processada(s), ${puladasFuturo} pendente(s) futuro, ${puladasInvalidas} pulada(s) por dados invalidos`,
      );
    }
  }
}
