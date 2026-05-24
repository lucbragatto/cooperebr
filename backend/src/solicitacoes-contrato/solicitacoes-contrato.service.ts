import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { ContratosService } from '../contratos/contratos.service';
import { WhatsappSenderService } from '../whatsapp/whatsapp-sender.service';
import { ModeloMensagemService } from '../whatsapp/modelo-mensagem.service';
import { NotificacoesService } from '../notificacoes/notificacoes.service';

/**
 * Sprint Bot Autoatendimento Bloco 5 Etapa D (24/05).
 *
 * Servico que processa SolicitacaoAlteracaoContrato criadas pelo bot
 * (motor dinamico fluxo Atualizar Contrato). Tres operacoes:
 *   - listar (filtro por status + multi-tenant)
 *   - aprovar = APLICAR imediato direto (decisao Luciano 3)
 *   - recusar com observacoesEquipe obrigatorias
 *
 * Bot NUNCA chega aqui — esse modulo eh so pra equipe via painel admin.
 */
@Injectable()
export class SolicitacoesContratoService {
  private readonly logger = new Logger(SolicitacoesContratoService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly contratosService: ContratosService,
    private readonly sender: WhatsappSenderService,
    private readonly modeloMensagem: ModeloMensagemService,
    private readonly notificacoes: NotificacoesService,
  ) {}

  async listar(
    cooperativaId: string | null | undefined,
    status?: 'PENDENTE' | 'APLICADA' | 'RECUSADA' | 'CANCELADA' | 'APROVADA',
  ) {
    const where: { status?: string; cooperativaId?: string } = {};
    if (status) where.status = status;
    if (cooperativaId) where.cooperativaId = cooperativaId;

    return this.prisma.solicitacaoAlteracaoContrato.findMany({
      where: where as never,
      orderBy: { createdAt: 'desc' },
      include: {
        cooperado: { select: { id: true, nomeCompleto: true, telefone: true } },
        contrato: { select: { id: true, kwhContratoMensal: true, status: true } },
      },
    });
  }

  async aprovar(
    id: string,
    cooperativaId: string | null | undefined,
    processadaPorId: string | null | undefined,
  ) {
    const sol = await this.buscarPendenteOuErro(id, cooperativaId);

    // Aplica conforme tipoAlteracao (decisao Luciano 3: aprovar=aplicar imediato)
    let detalhes = '';
    switch (sol.tipoAlteracao) {
      case 'AUMENTAR_KWH':
      case 'DIMINUIR_KWH': {
        if (!sol.valorPropostoKwh || sol.valorPropostoKwh <= 0) {
          throw new BadRequestException('valorPropostoKwh ausente ou invalido para alteracao de kWh.');
        }
        // Convencao MENSAL oficial (17/05): kwhContrato em kWh/mes.
        // contratosService.update aceita kwhContrato (alias) ou kwhContratoAnual.
        await this.contratosService.update(
          sol.contratoId,
          { kwhContrato: sol.valorPropostoKwh } as any,
          cooperativaId ?? null,
        );
        detalhes = `Novo contrato: ${sol.valorPropostoKwh} kWh/mes.`;
        break;
      }
      case 'SUSPENDER': {
        await this.contratosService.update(
          sol.contratoId,
          { status: 'SUSPENSO' } as any,
          cooperativaId ?? null,
        );
        detalhes = 'Seu contrato esta agora SUSPENSO. Reativacao por solicitacao formal a equipe.';
        break;
      }
      case 'ENCERRAR': {
        await this.contratosService.update(
          sol.contratoId,
          { status: 'ENCERRADO' } as any,
          cooperativaId ?? null,
        );
        detalhes = 'Seu contrato foi *encerrado*. Agradecemos a parceria! 💛';
        break;
      }
      default:
        throw new BadRequestException(`tipoAlteracao desconhecido: ${sol.tipoAlteracao}`);
    }

    const agora = new Date();
    await this.prisma.solicitacaoAlteracaoContrato.update({
      where: { id: sol.id },
      data: {
        status: 'APLICADA' as any,
        processadaEm: agora,
        processadaPorId: processadaPorId ?? null,
        aplicadaEm: agora,
      },
    });

    await this.notificarCooperado(sol, 'aprovada', { detalhes });

    this.logger.log(
      `Solicitacao ${sol.id} APLICADA (tipo=${sol.tipoAlteracao}, contrato=${sol.contratoId}, tenant=${cooperativaId ?? 'global'})`,
    );

    return { id: sol.id, status: 'APLICADA', aplicadaEm: agora };
  }

  async recusar(
    id: string,
    observacoesEquipe: string,
    cooperativaId: string | null | undefined,
    processadaPorId: string | null | undefined,
  ) {
    const sol = await this.buscarPendenteOuErro(id, cooperativaId);

    const agora = new Date();
    await this.prisma.solicitacaoAlteracaoContrato.update({
      where: { id: sol.id },
      data: {
        status: 'RECUSADA' as any,
        processadaEm: agora,
        processadaPorId: processadaPorId ?? null,
        observacoesEquipe,
      },
    });

    await this.notificarCooperado(sol, 'recusada', { motivo: observacoesEquipe });

    this.logger.log(
      `Solicitacao ${sol.id} RECUSADA (tipo=${sol.tipoAlteracao}, tenant=${cooperativaId ?? 'global'})`,
    );

    return { id: sol.id, status: 'RECUSADA', processadaEm: agora };
  }

  private async buscarPendenteOuErro(
    id: string,
    cooperativaId: string | null | undefined,
  ) {
    const where: { id: string; cooperativaId?: string } = { id };
    if (cooperativaId) where.cooperativaId = cooperativaId;

    const sol = await this.prisma.solicitacaoAlteracaoContrato.findFirst({
      where: where as never,
      include: {
        cooperado: { select: { telefone: true, nomeCompleto: true } },
      },
    });
    if (!sol) {
      throw new NotFoundException(`Solicitacao ${id} nao encontrada (verifique tenant).`);
    }
    if (sol.status !== 'PENDENTE') {
      throw new BadRequestException(
        `Solicitacao ja foi processada (status atual: ${sol.status}).`,
      );
    }
    return sol;
  }

  private async notificarCooperado(
    sol: {
      id: string;
      cooperadoId: string;
      cooperativaId: string;
      tipoAlteracao: string;
      cooperado: { telefone: string | null; nomeCompleto: string | null } | null;
    },
    resultado: 'aprovada' | 'recusada',
    extras: { detalhes?: string; motivo?: string },
  ): Promise<void> {
    const telefone = sol.cooperado?.telefone;
    if (!telefone) {
      this.logger.warn(`Solicitacao ${sol.id} sem telefone do cooperado — pulando WA.`);
      return;
    }

    const tipoTxt = this.tipoTexto(sol.tipoAlteracao);
    const modeloNome = `solicitacao_contrato_${resultado}`;
    const modelo = await this.prisma.modeloMensagem.findFirst({
      where: {
        nome: modeloNome,
        OR: [{ cooperativaId: sol.cooperativaId }, { cooperativaId: null }],
        ativo: true,
      },
    });

    let texto: string;
    if (modelo) {
      const vars: Record<string, string> = {
        tipo: tipoTxt,
        detalhes: extras.detalhes ?? '',
        motivo: extras.motivo ?? '',
      };
      texto = this.renderizar(modelo.conteudo, vars);
      try {
        await this.modeloMensagem.incrementarUso(modelo.id);
      } catch {
        // nao impede envio
      }
    } else {
      // Fallback hardcoded — modelo deveria existir (fix-bloco-5)
      texto =
        resultado === 'aprovada'
          ? `✅ Sua solicitacao de *${tipoTxt}* foi APROVADA. ${extras.detalhes ?? ''}`
          : `❌ Sua solicitacao de *${tipoTxt}* nao pode ser aprovada agora. Motivo: ${extras.motivo ?? '(nao informado)'}`;
    }

    try {
      await this.sender.enviarMensagem(telefone, texto);
    } catch (err) {
      this.logger.warn(
        `Solicitacao ${sol.id}: envio WA falhou — ${(err as Error)?.message ?? 'desconhecido'}`,
      );
    }

    try {
      await this.notificacoes.criar({
        tipo: 'SOLICITACAO_ALTERACAO_CONTRATO',
        titulo: `Solicitacao ${resultado.toUpperCase()}`,
        mensagem: `Solicitacao ${sol.id} (${tipoTxt}) ${resultado === 'aprovada' ? 'aplicada' : 'recusada'}.`,
        cooperadoId: sol.cooperadoId,
        cooperativaId: sol.cooperativaId,
        link: `/dashboard/super-admin/solicitacoes/${sol.id}`,
      });
    } catch {
      // nao impede o fluxo principal
    }
  }

  private tipoTexto(tipo: string): string {
    switch (tipo) {
      case 'AUMENTAR_KWH':
        return 'aumentar kWh';
      case 'DIMINUIR_KWH':
        return 'diminuir kWh';
      case 'SUSPENDER':
        return 'suspender contrato';
      case 'ENCERRAR':
        return 'encerrar contrato';
      default:
        return tipo;
    }
  }

  private renderizar(conteudo: string, vars: Record<string, string>): string {
    return conteudo.replace(/\{\{(\w+)\}\}/g, (_, key) => vars[key] ?? '');
  }
}
