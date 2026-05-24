import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { WhatsappSenderService } from '../whatsapp/whatsapp-sender.service';
import { NotificacoesService } from '../notificacoes/notificacoes.service';

/**
 * Sprint Bot Autoatendimento Bloco 8 Etapa F (24/05).
 *
 * Servico que processa SolicitacaoConfirmacaoPagamento criadas pelo bot
 * (motor dinamico fluxo MENU_FATURA -> "ja paguei"). Tres operacoes:
 *   - listar (filtro por status + multi-tenant)
 *   - confirmar = marca CONFIRMADA + opcionalmente da baixa na Cobranca
 *   - recusar com observacoesEquipe obrigatorias
 *
 * Bot NUNCA chega aqui — modulo so pra equipe via painel admin.
 * Decisao opcional na confirmacao: dar baixa direto na Cobranca (status
 * PAGO) eh ATIVADO por flag `marcarPago` no body. Default false (equipe
 * pode querer confirmar recebimento sem marcar PAGO ate o gateway bater).
 */
@Injectable()
export class SolicitacoesConfirmacaoPagamentoService {
  private readonly logger = new Logger(SolicitacoesConfirmacaoPagamentoService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly sender: WhatsappSenderService,
    private readonly notificacoes: NotificacoesService,
  ) {}

  async listar(
    cooperativaId: string | null | undefined,
    status?: 'PENDENTE' | 'CONFIRMADA' | 'RECUSADA',
  ) {
    const where: { status?: string; cooperativaId?: string } = {};
    if (status) where.status = status;
    if (cooperativaId) where.cooperativaId = cooperativaId;

    return this.prisma.solicitacaoConfirmacaoPagamento.findMany({
      where: where as never,
      orderBy: { createdAt: 'desc' },
      include: {
        cooperado: { select: { id: true, nomeCompleto: true, telefone: true } },
        cobranca: {
          select: {
            id: true,
            valorLiquido: true,
            mesReferencia: true,
            anoReferencia: true,
            status: true,
            dataVencimento: true,
          },
        },
      },
    });
  }

  async confirmar(
    id: string,
    cooperativaId: string | null | undefined,
    processadaPor: string | null | undefined,
    marcarPago: boolean,
  ) {
    const sol = await this.buscarPendenteOuErro(id, cooperativaId);

    const agora = new Date();
    let cobrancaMarcadaPaga = false;

    if (marcarPago) {
      try {
        await this.prisma.cobranca.update({
          where: { id: sol.cobrancaId },
          data: { status: 'PAGO' as any, dataPagamento: agora },
        });
        cobrancaMarcadaPaga = true;
      } catch (err) {
        this.logger.warn(
          `Confirmar ${id}: erro ao marcar Cobranca PAGA — ${(err as Error)?.message ?? 'desconhecido'}`,
        );
      }
    }

    await this.prisma.solicitacaoConfirmacaoPagamento.update({
      where: { id: sol.id },
      data: {
        status: 'CONFIRMADA' as any,
        processadaEm: agora,
        processadaPor: processadaPor ?? null,
      },
    });

    await this.notificarCooperado(sol, 'confirmada', { marcarPago: cobrancaMarcadaPaga });

    this.logger.log(
      `SolicitacaoConfirmacaoPagamento ${sol.id} CONFIRMADA (cobranca=${sol.cobrancaId}, marcarPago=${cobrancaMarcadaPaga}, tenant=${cooperativaId ?? 'global'})`,
    );

    return { id: sol.id, status: 'CONFIRMADA', cobrancaMarcadaPaga, processadaEm: agora };
  }

  async recusar(
    id: string,
    observacoesEquipe: string,
    cooperativaId: string | null | undefined,
    processadaPor: string | null | undefined,
  ) {
    const sol = await this.buscarPendenteOuErro(id, cooperativaId);

    const agora = new Date();
    await this.prisma.solicitacaoConfirmacaoPagamento.update({
      where: { id: sol.id },
      data: {
        status: 'RECUSADA' as any,
        processadaEm: agora,
        processadaPor: processadaPor ?? null,
        observacoesEquipe,
      },
    });

    await this.notificarCooperado(sol, 'recusada', { motivo: observacoesEquipe });

    this.logger.log(
      `SolicitacaoConfirmacaoPagamento ${sol.id} RECUSADA (cobranca=${sol.cobrancaId}, tenant=${cooperativaId ?? 'global'})`,
    );

    return { id: sol.id, status: 'RECUSADA', processadaEm: agora };
  }

  private async buscarPendenteOuErro(
    id: string,
    cooperativaId: string | null | undefined,
  ) {
    const where: { id: string; cooperativaId?: string } = { id };
    if (cooperativaId) where.cooperativaId = cooperativaId;

    const sol = await this.prisma.solicitacaoConfirmacaoPagamento.findFirst({
      where: where as never,
      include: {
        cooperado: { select: { telefone: true, nomeCompleto: true } },
        cobranca: { select: { valorLiquido: true, mesReferencia: true, anoReferencia: true } },
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
      cobrancaId: string;
      cooperado: { telefone: string | null; nomeCompleto: string | null } | null;
      cobranca: { valorLiquido: any; mesReferencia: number; anoReferencia: number } | null;
    },
    resultado: 'confirmada' | 'recusada',
    extras: { motivo?: string; marcarPago?: boolean },
  ): Promise<void> {
    const telefone = sol.cooperado?.telefone;
    if (!telefone) {
      this.logger.warn(`Solicitacao ${sol.id} sem telefone do cooperado — pulando WA.`);
      return;
    }

    const mes = sol.cobranca ? String(sol.cobranca.mesReferencia).padStart(2, '0') : '';
    const ano = sol.cobranca?.anoReferencia ?? '';
    const valor = sol.cobranca
      ? Number(sol.cobranca.valorLiquido ?? 0).toFixed(2).replace('.', ',')
      : '';

    let texto: string;
    if (resultado === 'confirmada') {
      texto = extras.marcarPago
        ? `✅ Confirmamos seu pagamento da fatura *${mes}/${ano}* (R$ ${valor}). Fatura marcada como PAGA. Obrigado! 💚`
        : `✅ Recebemos a confirmacao da fatura *${mes}/${ano}* (R$ ${valor}). Nossa equipe registrou — a baixa final acontece quando o gateway confirmar. 💚`;
    } else {
      texto = `❌ Nao conseguimos validar seu pagamento da fatura *${mes}/${ano}*.\nMotivo da equipe: ${extras.motivo ?? '(nao informado)'}\nFale com a gente se precisar de ajuda. 💛`;
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
        tipo: 'SOLICITACAO_CONFIRMACAO_PAGAMENTO',
        titulo: `Confirmacao pagamento ${resultado.toUpperCase()}`,
        mensagem: `Solicitacao ${sol.id} ${resultado === 'confirmada' ? 'confirmada' : 'recusada'}.`,
        cooperadoId: sol.cooperadoId,
        cooperativaId: sol.cooperativaId,
        link: `/dashboard/super-admin/solicitacoes/${sol.id}`,
      });
    } catch {
      // nao impede o fluxo principal
    }
  }
}
