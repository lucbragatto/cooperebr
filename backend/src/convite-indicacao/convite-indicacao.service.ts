import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { WhatsappSenderService } from '../whatsapp/whatsapp-sender.service';
import { StatusConvite } from '@prisma/client';

function normalizarTelefone(tel: string): string {
  let t = tel.replace(/\D/g, '');
  if (t.startsWith('55') && t.length >= 12) t = t.slice(2);
  if (t.length === 10) t = t.slice(0, 2) + '9' + t.slice(2);
  return t;
}

@Injectable()
export class ConviteIndicacaoService {
  private readonly logger = new Logger(ConviteIndicacaoService.name);

  constructor(
    private prisma: PrismaService,
    private sender: WhatsappSenderService,
  ) {}

  // ─── Criar Convite ────────────────────────────────────────────────────────────

  async criarConvite(
    cooperadoIndicadorId: string,
    nomeConvidado: string,
    telefoneConvidado: string,
    cooperativaId: string,
  ) {
    const tel = normalizarTelefone(telefoneConvidado);

    // Verificar se telefone ja e cooperado ativo
    const cooperadoExistente = await this.prisma.cooperado.findFirst({
      where: { telefone: { contains: tel }, status: 'ATIVO' },
      select: { id: true, nomeCompleto: true },
    });

    if (cooperadoExistente) {
      this.logger.warn(
        `Telefone ${tel} ja e cooperado ativo: ${cooperadoExistente.nomeCompleto}`,
      );
      return { jaCooperado: true, cooperado: cooperadoExistente };
    }

    // Sprint 9B: resolver convenioId do remetente (conveniado ou membro)
    let convenioId: string | null = null;
    // 1. Remetente é conveniado de algum convênio?
    const comoConveniado = await this.prisma.contratoConvenio.findFirst({
      where: { conveniadoId: cooperadoIndicadorId, status: 'ATIVO' },
      select: { id: true },
    });
    if (comoConveniado) {
      convenioId = comoConveniado.id;
    } else {
      // 2. Remetente é membro de algum convênio?
      const comoMembro = await this.prisma.convenioCooperado.findFirst({
        where: { cooperadoId: cooperadoIndicadorId, ativo: true },
        select: { convenioId: true },
      });
      if (comoMembro) convenioId = comoMembro.convenioId;
    }

    // Upsert por (cooperadoIndicadorId, telefoneConvidado)
    const convite = await this.prisma.conviteIndicacao.upsert({
      where: {
        cooperadoIndicadorId_telefoneConvidado: {
          cooperadoIndicadorId,
          telefoneConvidado: tel,
        },
      },
      update: {
        nomeConvidado,
        tentativasEnvio: { increment: 1 },
        ultimoEnvioEm: new Date(),
        status: StatusConvite.PENDENTE,
        convenioId,
      },
      create: {
        cooperativaId,
        cooperadoIndicadorId,
        nomeConvidado,
        telefoneConvidado: tel,
        status: StatusConvite.PENDENTE,
        convenioId,
      },
    });

    return { jaCooperado: false, convite };
  }

  // ─── Reenviar Convite ─────────────────────────────────────────────────────────

  async reenviarConvite(conviteId: string, cooperativaId: string) {
    const existe = await this.prisma.conviteIndicacao.findFirst({
      where: { id: conviteId, cooperativaId },
    });
    if (!existe) throw new NotFoundException('Convite nao encontrado');

    const convite = await this.prisma.conviteIndicacao.update({
      where: { id: conviteId },
      data: {
        tentativasEnvio: { increment: 1 },
        ultimoEnvioEm: new Date(),
        status: StatusConvite.LEMBRETE_ENVIADO,
        lembreteEnviadoEm: new Date(),
      },
      include: { cooperadoIndicador: { select: { nomeCompleto: true } } },
    });

    const nomeIndicador = convite.cooperadoIndicador.nomeCompleto;

    await this.sender
      .enviarMensagem(
        convite.telefoneConvidado,
        `Ola ${convite.nomeConvidado}! ${nomeIndicador} te convidou para a CoopereBR.\n\nEconomize ate 20% na conta de luz sem investimento.\n\nMande a foto da sua conta de energia para comecar!`,
      )
      .catch((err) =>
        this.logger.warn(
          `Falha ao reenviar convite ${conviteId}: ${err.message}`,
        ),
      );

    return convite;
  }

  // ─── Vincular Lead ao Convite ─────────────────────────────────────────────────

  async vincularLeadAoConvite(telefone: string, leadExpansaoId: string) {
    const tel = normalizarTelefone(telefone);

    const convite = await this.prisma.conviteIndicacao.findFirst({
      where: { telefoneConvidado: tel },
      orderBy: { createdAt: 'desc' },
    });

    if (!convite) {
      this.logger.debug(
        `Nenhum ConviteIndicacao encontrado para telefone ${tel}`,
      );
      return null;
    }

    await this.prisma.$transaction([
      this.prisma.conviteIndicacao.update({
        where: { id: convite.id },
        data: { leadExpansaoId },
      }),
      this.prisma.leadExpansao.update({
        where: { id: leadExpansaoId },
        data: { cooperadoIndicadorId: convite.cooperadoIndicadorId },
      }),
    ]);

    this.logger.log(
      `Lead ${leadExpansaoId} vinculado ao convite ${convite.id}`,
    );
    return convite;
  }

  // ─── Concluir Cadastro ────────────────────────────────────────────────────────

  async concluirCadastro(
    telefone: string,
    cooperadoIndicadoId: string,
    cooperativaId: string,
  ) {
    const tel = normalizarTelefone(telefone);

    const convite = await this.prisma.conviteIndicacao.findFirst({
      where: { telefoneConvidado: tel },
      orderBy: { createdAt: 'desc' },
      include: {
        cooperadoIndicador: { select: { nomeCompleto: true, telefone: true } },
      },
    });

    if (!convite) {
      this.logger.warn(
        `Nenhum ConviteIndicacao para concluir cadastro do telefone ${tel}`,
      );
      return null;
    }

    const { conviteAtualizado, indicacao } = await this.prisma.$transaction(
      async (tx) => {
        const conviteAtualizado = await tx.conviteIndicacao.update({
          where: { id: convite.id },
          data: {
            status: StatusConvite.CADASTRADO,
            cadastroConcluidoEm: new Date(),
          },
        });

        // CONV-02: Verificar duplicata antes de criar indicação nível 1
        const indicacaoExistente = await tx.indicacao.findFirst({
          where: { cooperadoIndicadoId: cooperadoIndicadoId, nivel: 1 },
        });
        if (indicacaoExistente) {
          this.logger.warn(
            `Indicação nível 1 já existe para cooperado ${cooperadoIndicadoId}`,
          );
          return { conviteAtualizado, indicacao: indicacaoExistente };
        }

        const indicacao = await tx.indicacao.create({
          data: {
            cooperativaId,
            cooperadoIndicadorId: convite.cooperadoIndicadorId,
            cooperadoIndicadoId: cooperadoIndicadoId,
            nivel: 1,
            status: 'PENDENTE',
          },
        });

        await tx.conviteIndicacao.update({
          where: { id: convite.id },
          data: { indicacaoId: indicacao.id },
        });

        return { conviteAtualizado, indicacao };
      },
    );

    // Notificar indicador via WA
    if (convite.cooperadoIndicador.telefone) {
      await this.sender
        .enviarMensagem(
          convite.cooperadoIndicador.telefone,
          `Seu amigo ${convite.nomeConvidado} acabou de se cadastrar na CoopereBR! Obrigado pela indicacao!`,
        )
        .catch((err) =>
          this.logger.warn(
            `Falha ao notificar indicador: ${err.message}`,
          ),
        );
    }

    return { convite: conviteAtualizado, indicacao };
  }

  // ─── Listar Convites Pendentes ────────────────────────────────────────────────

  async listarConvitesPendentes(
    cooperativaId: string,
    filtros: {
      status?: StatusConvite;
      diasSemAcao?: number;
      indicadorId?: string;
      page?: number;
    } = {},
  ) {
    const { status, diasSemAcao, indicadorId, page = 1 } = filtros;
    const take = 20;
    const skip = (page - 1) * take;

    const where: any = { cooperativaId };

    if (status) where.status = status;
    if (indicadorId) where.cooperadoIndicadorId = indicadorId;
    if (diasSemAcao) {
      const dataLimite = new Date();
      dataLimite.setDate(dataLimite.getDate() - diasSemAcao);
      where.ultimoEnvioEm = { lte: dataLimite };
    }

    const [convites, total] = await Promise.all([
      this.prisma.conviteIndicacao.findMany({
        where,
        include: {
          cooperadoIndicador: {
            select: { nomeCompleto: true, telefone: true },
          },
        },
        orderBy: { createdAt: 'desc' },
        take,
        skip,
      }),
      this.prisma.conviteIndicacao.count({ where }),
    ]);

    return { convites, total, page, totalPages: Math.ceil(total / take) };
  }

  // ─── Estatisticas ─────────────────────────────────────────────────────────────

  async getEstatisticas(cooperativaId: string) {
    const counts = await this.prisma.conviteIndicacao.groupBy({
      by: ['status'],
      where: { cooperativaId },
      _count: true,
    });

    const stats = {
      total: 0,
      pendentes: 0,
      lembretes: 0,
      cadastrados: 0,
      convertidos: 0,
      expirados: 0,
      cancelados: 0,
      taxaConversao: 0,
    };

    for (const c of counts) {
      const n = c._count;
      stats.total += n;
      switch (c.status) {
        case StatusConvite.PENDENTE:
          stats.pendentes = n;
          break;
        case StatusConvite.LEMBRETE_ENVIADO:
          stats.lembretes = n;
          break;
        case StatusConvite.CADASTRADO:
          stats.cadastrados = n;
          break;
        case StatusConvite.CONVERTIDO:
          stats.convertidos = n;
          break;
        case StatusConvite.EXPIRADO:
          stats.expirados = n;
          break;
        case StatusConvite.CANCELADO:
          stats.cancelados = n;
          break;
      }
    }

    if (stats.total > 0) {
      stats.taxaConversao = Number(
        (((stats.cadastrados + stats.convertidos) / stats.total) * 100).toFixed(
          1,
        ),
      );
    }

    return stats;
  }

  // ─── Cancelar Convite ─────────────────────────────────────────────────────────

  async cancelarConvite(conviteId: string, cooperativaId: string) {
    const convite = await this.prisma.conviteIndicacao.findFirst({
      where: { id: conviteId, cooperativaId },
    });
    if (!convite) throw new NotFoundException('Convite nao encontrado');

    return this.prisma.conviteIndicacao.update({
      where: { id: conviteId },
      data: { status: StatusConvite.CANCELADO },
    });
  }

  // ─── Marcar como CONVERTIDO (chamado quando 1a fatura paga) ───────────────────

  async marcarConvertido(indicacaoId: string) {
    const convite = await this.prisma.conviteIndicacao.findUnique({
      where: { indicacaoId },
      include: {
        cooperadoIndicador: { select: { nomeCompleto: true, telefone: true } },
      },
    });

    if (!convite) {
      this.logger.debug(
        `Nenhum ConviteIndicacao para indicacaoId ${indicacaoId}`,
      );
      return null;
    }

    const atualizado = await this.prisma.conviteIndicacao.update({
      where: { id: convite.id },
      data: { status: StatusConvite.CONVERTIDO },
    });

    // Notificar indicador
    if (convite.cooperadoIndicador.telefone) {
      await this.sender
        .enviarMensagem(
          convite.cooperadoIndicador.telefone,
          `Parabens! Seu amigo ${convite.nomeConvidado} pagou a primeira fatura. Voce ganhou seu beneficio!`,
        )
        .catch((err) =>
          this.logger.warn(
            `Falha ao notificar conversao: ${err.message}`,
          ),
        );
    }

    return atualizado;
  }

  // ─── Dashboard ──────────────────────────────────────────────────────────────

  async getDashboard(
    cooperativaId: string,
    filtros: {
      status?: StatusConvite;
      periodo?: number; // últimos N dias
      page?: number;
    } = {},
  ) {
    const { status, periodo, page = 1 } = filtros;
    const take = 20;
    const skip = (page - 1) * take;

    const where: any = { cooperativaId };
    if (status) where.status = status;
    if (periodo) {
      const dataLimite = new Date();
      dataLimite.setDate(dataLimite.getDate() - periodo);
      where.createdAt = { gte: dataLimite };
    }

    const [convites, total] = await Promise.all([
      this.prisma.conviteIndicacao.findMany({
        where,
        include: {
          cooperadoIndicador: {
            select: { nomeCompleto: true },
          },
        },
        orderBy: { createdAt: 'desc' },
        take,
        skip,
      }),
      this.prisma.conviteIndicacao.count({ where }),
    ]);

    return {
      convites: convites.map((c) => ({
        id: c.id,
        nomeConvidado: c.nomeConvidado,
        telefoneConvidado: c.telefoneConvidado,
        dataConvite: c.createdAt,
        status: c.status,
        tentativasLembrete: c.tentativasEnvio,
        ultimoLembrete: c.lembreteEnviadoEm,
        indicadoPor: c.cooperadoIndicador.nomeCompleto,
      })),
      total,
      page,
      totalPages: Math.ceil(total / take),
    };
  }

  async getStats(cooperativaId: string) {
    return this.getEstatisticas(cooperativaId);
  }

  // ─── Config Lembretes ───────────────────────────────────────────────────────

  async getConfigLembretes(cooperativaId: string) {
    const chaves = [
      'convite.lembrete.cooldownDias',
      'convite.lembrete.maxTentativas',
      'convite.lembrete.habilitado',
    ];

    const configs = await this.prisma.configTenant.findMany({
      where: {
        chave: { in: chaves },
        cooperativaId,
      },
    });

    const map = new Map(configs.map((c) => [c.chave, c.valor]));

    return {
      cooldownDias: Number(map.get('convite.lembrete.cooldownDias') ?? 3),
      maxTentativas: Number(map.get('convite.lembrete.maxTentativas') ?? 3),
      habilitado: (map.get('convite.lembrete.habilitado') ?? 'true') === 'true',
    };
  }

  async salvarConfigLembretes(
    cooperativaId: string,
    dto: { cooldownDias: number; maxTentativas: number; habilitado: boolean },
  ) {
    const entries = [
      { chave: 'convite.lembrete.cooldownDias', valor: String(dto.cooldownDias), descricao: 'Dias entre lembretes de convite' },
      { chave: 'convite.lembrete.maxTentativas', valor: String(dto.maxTentativas), descricao: 'Máximo de lembretes por convite' },
      { chave: 'convite.lembrete.habilitado', valor: String(dto.habilitado), descricao: 'Lembretes de convite habilitados' },
    ];

    for (const entry of entries) {
      const existing = await this.prisma.configTenant.findFirst({
        where: { chave: entry.chave, cooperativaId },
      });

      if (existing) {
        await this.prisma.configTenant.update({
          where: { id: existing.id },
          data: { valor: entry.valor },
        });
      } else {
        await this.prisma.configTenant.create({
          data: {
            chave: entry.chave,
            valor: entry.valor,
            descricao: entry.descricao,
            cooperativaId,
          },
        });
      }
    }

    return this.getConfigLembretes(cooperativaId);
  }
}
