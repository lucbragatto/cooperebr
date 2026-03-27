import { Injectable, Logger, ForbiddenException, BadRequestException, Inject, forwardRef } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { OnEvent } from '@nestjs/event-emitter';
import { PrismaService } from '../prisma.service';
import { WhatsappSenderService } from '../whatsapp/whatsapp-sender.service';
import type { WhatsappMensagemEnviadaEvent } from '../whatsapp/whatsapp-sender.service';

interface AtivarDto {
  observadorId: string;
  observadoId?: string;
  observadoTelefone?: string;
  observadorTelefone: string;
  escopo: string;
  expiresAt?: Date;
  motivo?: string;
  cooperativaId: string;
}

@Injectable()
export class ObservadorService {
  private readonly logger = new Logger(ObservadorService.name);

  constructor(
    private prisma: PrismaService,
    @Inject(forwardRef(() => WhatsappSenderService)) private sender: WhatsappSenderService,
  ) {}

  async ativar(dto: AtivarDto, perfil: string) {
    // Limites por perfil
    if (perfil === 'ADMIN') {
      const count = await this.prisma.observacaoAtiva.count({
        where: { observadorId: dto.observadorId, ativo: true },
      });
      if (count >= 10) throw new ForbiddenException('Limite de 10 observações simultâneas para ADMIN');
    }

    if (!dto.observadoId && !dto.observadoTelefone) {
      throw new BadRequestException('Informe observadoId ou observadoTelefone');
    }

    // Expiração padrão 4h se não informada
    const expiresAt = dto.expiresAt || new Date(Date.now() + 4 * 60 * 60 * 1000);

    const obs = await this.prisma.observacaoAtiva.create({
      data: {
        observadorId: dto.observadorId,
        observadoId: dto.observadoId || null,
        observadoTelefone: dto.observadoTelefone || null,
        observadorTelefone: dto.observadorTelefone,
        escopo: dto.escopo as any,
        expiresAt,
        motivo: dto.motivo || null,
        cooperativaId: dto.cooperativaId,
      },
    });

    await this.prisma.logObservacao.create({
      data: {
        observacaoId: obs.id,
        evento: 'ATIVADA',
        detalhe: `Escopo: ${dto.escopo} | Expira: ${expiresAt.toISOString()}`,
        cooperativaId: dto.cooperativaId,
      },
    });

    return obs;
  }

  async encerrar(id: string, usuarioId: string) {
    const obs = await this.prisma.observacaoAtiva.findUnique({ where: { id } });
    if (!obs) throw new BadRequestException('Observação não encontrada');

    await this.prisma.observacaoAtiva.update({
      where: { id },
      data: { ativo: false },
    });

    await this.prisma.logObservacao.create({
      data: {
        observacaoId: id,
        evento: 'ENCERRADA',
        detalhe: `Encerrada por ${usuarioId}`,
        cooperativaId: obs.cooperativaId,
      },
    });

    // Notificar observador
    try {
      await this.sender.enviarMensagem(
        obs.observadorTelefone,
        `⏰ Observação encerrada (${obs.observadoTelefone || obs.observadoId})`,
      );
    } catch (err) {
      this.logger.warn(`Falha ao notificar encerramento: ${err.message}`);
    }

    return { ok: true };
  }

  async listarAtivas(cooperativaId: string, observadorId?: string, perfil?: string) {
    const where: any = { ativo: true };

    if (perfil === 'SUPER_ADMIN') {
      // Vê tudo, opcionalmente filtrado por cooperativa
      if (cooperativaId) where.cooperativaId = cooperativaId;
    } else {
      where.cooperativaId = cooperativaId;
      if (perfil === 'ADMIN') {
        // Admin vê todas da cooperativa
      } else {
        // Outros perfis veem apenas as próprias
        where.observadorId = observadorId;
      }
    }

    return this.prisma.observacaoAtiva.findMany({
      where,
      include: {
        observador: { select: { id: true, nome: true, telefone: true } },
      },
      orderBy: { criadoEm: 'desc' },
    });
  }

  async historico(cooperativaId: string, perfil: string) {
    const ontem = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const where: any = { ativo: false, criadoEm: { gte: ontem } };

    if (perfil !== 'SUPER_ADMIN') {
      where.cooperativaId = cooperativaId;
    }

    return this.prisma.observacaoAtiva.findMany({
      where,
      include: {
        observador: { select: { id: true, nome: true } },
      },
      orderBy: { criadoEm: 'desc' },
      take: 50,
    });
  }

  /**
   * Listener de evento: espelha mensagens WhatsApp recebidas para observadores ativos.
   */
  @OnEvent('whatsapp.mensagem.recebida')
  async handleMensagemRecebida(payload: { telefone: string; texto: string; direcao: 'RECEBIDA' }) {
    try {
      await this.espelharMensagem(payload.telefone, payload.texto, payload.direcao);
    } catch (err) {
      this.logger.warn(`Falha ao espelhar mensagem recebida para observadores: ${err.message}`);
    }
  }

  /**
   * Listener de evento: espelha mensagens WhatsApp enviadas para observadores ativos.
   */
  @OnEvent('whatsapp.mensagem.enviada')
  async handleMensagemEnviada(payload: WhatsappMensagemEnviadaEvent) {
    try {
      await this.espelharMensagem(payload.telefone, payload.texto, payload.direcao);
    } catch (err) {
      this.logger.warn(`Falha ao espelhar para observadores: ${err.message}`);
    }
  }

  /**
   * Espelha uma mensagem WhatsApp para todos os observadores ativos daquele telefone.
   */
  async espelharMensagem(
    telefone: string,
    texto: string,
    direcao: 'ENVIADA' | 'RECEBIDA',
  ) {
    const telLimpo = telefone.replace(/\D/g, '');

    // Buscar observações ativas com escopo compatível
    const escoposCompativeis =
      direcao === 'ENVIADA'
        ? ['WHATSAPP_ENVIADO', 'WHATSAPP_TOTAL', 'TUDO']
        : ['WHATSAPP_RECEBIDO', 'WHATSAPP_TOTAL', 'TUDO'];

    const observacoes = await this.prisma.observacaoAtiva.findMany({
      where: {
        ativo: true,
        observadoTelefone: telLimpo,
        escopo: { in: escoposCompativeis as any },
      },
    });

    if (!observacoes.length) return;

    // Buscar nome do observado se possível
    let nomeObservado = '';
    try {
      const cooperado = await this.prisma.cooperado.findFirst({
        where: { telefone: { contains: telLimpo.slice(-8) } },
        select: { nomeCompleto: true },
      });
      if (cooperado) nomeObservado = ` (${cooperado.nomeCompleto})`;
    } catch {}

    const hora = new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
    const direcaoLabel = direcao === 'ENVIADA' ? `ENVIADA → ${telefone}` : `RECEBIDA de ${telefone}`;

    const espelho = [
      `📋 [OBSERVADOR] Mensagem ${direcaoLabel}${nomeObservado}`,
      '─────────────────────────────',
      texto,
      '─────────────────────────────',
      `🕐 ${hora}`,
    ].join('\n');

    for (const obs of observacoes) {
      try {
        await this.sender.enviarMensagem(obs.observadorTelefone, espelho);
        await this.prisma.logObservacao.create({
          data: {
            observacaoId: obs.id,
            evento: 'MENSAGEM_ESPELHADA',
            detalhe: `${direcao} | ${texto.slice(0, 100)}`,
            cooperativaId: obs.cooperativaId,
          },
        });
      } catch (err) {
        this.logger.warn(`Falha ao espelhar para ${obs.observadorTelefone}: ${err.message}`);
      }
    }
  }

  /**
   * Registra uma ação na plataforma para observadores do tipo ACOES_PLATAFORMA / TUDO.
   */
  async registrarAcao(observadoId: string, descricao: string) {
    const observacoes = await this.prisma.observacaoAtiva.findMany({
      where: {
        ativo: true,
        observadoId,
        escopo: { in: ['ACOES_PLATAFORMA', 'TUDO'] as any },
      },
    });

    const hora = new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });

    for (const obs of observacoes) {
      const msg = [
        `📋 [OBSERVADOR] Ação na Plataforma`,
        '─────────────────────────────',
        descricao,
        '─────────────────────────────',
        `🕐 ${hora}`,
      ].join('\n');

      try {
        await this.sender.enviarMensagem(obs.observadorTelefone, msg);
        await this.prisma.logObservacao.create({
          data: {
            observacaoId: obs.id,
            evento: 'ACAO_REGISTRADA',
            detalhe: descricao.slice(0, 200),
            cooperativaId: obs.cooperativaId,
          },
        });
      } catch (err) {
        this.logger.warn(`Falha ao registrar ação para observador: ${err.message}`);
      }
    }
  }

  /**
   * Cron: encerra observações expiradas a cada 5 minutos.
   */
  @Cron(CronExpression.EVERY_5_MINUTES)
  async expirarAutomaticas() {
    const agora = new Date();
    const expiradas = await this.prisma.observacaoAtiva.findMany({
      where: { ativo: true, expiresAt: { lte: agora } },
    });

    for (const obs of expiradas) {
      await this.prisma.observacaoAtiva.update({
        where: { id: obs.id },
        data: { ativo: false },
      });

      await this.prisma.logObservacao.create({
        data: {
          observacaoId: obs.id,
          evento: 'ENCERRADA',
          detalhe: 'Expiração automática',
          cooperativaId: obs.cooperativaId,
        },
      });

      try {
        await this.sender.enviarMensagem(
          obs.observadorTelefone,
          `⏰ Observação de ${obs.observadoTelefone || obs.observadoId} encerrada (expirou)`,
        );
      } catch (err) {
        this.logger.warn(`Falha ao notificar expiração: ${err.message}`);
      }
    }

    if (expiradas.length > 0) {
      this.logger.log(`${expiradas.length} observação(ões) expirada(s) encerrada(s)`);
    }
  }
}
