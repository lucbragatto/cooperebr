/**
 * Sprint Convênio MIGRAÇÃO M47 (21/06/2026) — Fase 3.
 *
 * MigracaoExternaService — encapsula a mecânica de migração de cooperado
 * de DISTRIBUIDORA/COOPERATIVA CONCORRENTE pra SISGD. Reusa o model
 * MigracaoUsina (intra-coop existente) com tipo='DISTRIBUIDORA_EXTERNA'
 * e campos opcionais adicionados nesta sprint.
 *
 * Fluxo:
 *  1. POST /cooperados/:id/migrar (iniciar) — cria MigracaoUsina com
 *     statusMigracao='PENDENTE' + Cooperado.status='PENDENTE_MIGRACAO'.
 *  2. POST /cooperados/:id/migrar/concluir — set statusMigracao='CONCLUIDA'
 *     + Cooperado.status='ATIVO' + dataDesligamentoEfetivo agora.
 *  3. POST /cooperados/:id/migrar/rejeitar — set statusMigracao='REJEITADA'
 *     + Cooperado.status='DESLIGADO' (cooperado desistiu).
 *
 * Multi-tenant: cooperativaId SEMPRE do JWT (lição M45). NUNCA do body.
 *
 * statusMigracao: String livre validada por const array (decisão Q6
 * orquestrador — sem enum delta).
 */
import {
  Injectable,
  Logger,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { WhatsappSenderService } from '../whatsapp/whatsapp-sender.service';

/**
 * Const array de validação (decisão Q6 orquestrador 21/06 — sem enum delta).
 * Hoje os 3 métodos usam literais hardcoded; ENDPOINTS FUTUROS que aceitem
 * `statusMigracao` vindo do body (ex: PATCH admin pra forçar TIMEOUT_ADMIN_DECIDE)
 * DEVEM validar contra esse array antes de persistir. Documenta o contrato
 * público de valores aceitos. NÃO REMOVER mesmo sem caller atual (P1-1
 * code-reviewer 21/06).
 */
export const STATUS_MIGRACAO_VALIDOS = [
  'PENDENTE',
  'CONCLUIDA',
  'REJEITADA',
  'TIMEOUT_ADMIN_DECIDE',
] as const;
export type StatusMigracao = (typeof STATUS_MIGRACAO_VALIDOS)[number];

export interface IniciarMigracaoParams {
  cooperadoId: string;
  cooperativaId: string;
  realizadoPorId: string;
  distribuidoraOrigem: string;
  numeroUcOrigem?: string;
  motivo?: string;
}

@Injectable()
export class MigracaoExternaService {
  private readonly logger = new Logger(MigracaoExternaService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly waSender: WhatsappSenderService,
  ) {}

  /**
   * Inicia migração: cria MigracaoUsina + altera Cooperado.status pra
   * PENDENTE_MIGRACAO. Notifica cooperado via WA (best-effort).
   */
  async iniciar(params: IniciarMigracaoParams) {
    const { cooperadoId, cooperativaId, realizadoPorId } = params;

    // Multi-tenant: busca cooperado SÓ no tenant do JWT.
    const cooperado = await this.prisma.cooperado.findFirst({
      where: { id: cooperadoId, cooperativaId },
      select: { id: true, status: true, nomeCompleto: true, telefone: true },
    });
    if (!cooperado) {
      throw new NotFoundException('Cooperado não encontrado neste tenant.');
    }
    if (cooperado.status === 'PENDENTE_MIGRACAO') {
      throw new BadRequestException(
        'Cooperado já está em migração — conclua ou rejeite a anterior primeiro.',
      );
    }
    if (cooperado.status === 'DESLIGADO') {
      throw new BadRequestException(
        'Cooperado desligado — não pode iniciar migração.',
      );
    }

    if (!params.distribuidoraOrigem?.trim()) {
      throw new BadRequestException(
        'distribuidoraOrigem obrigatório (nome da cooperativa/distribuidora concorrente).',
      );
    }

    const agora = new Date();
    // Defense-in-depth multi-tenant (P1 multitenant review 21/06):
    // update.where inclui cooperativaId, embora o findFirst acima já tenha
    // validado posse. Padrão D-novo-CONVENIO-UPDATE-SEM-COOPID evitado nesta
    // sprint M47.
    const [migracao] = await this.prisma.$transaction([
      this.prisma.migracaoUsina.create({
        data: {
          cooperadoId,
          cooperativaId,
          realizadoPorId,
          tipo: 'DISTRIBUIDORA_EXTERNA',
          statusMigracao: 'PENDENTE',
          distribuidoraOrigem: params.distribuidoraOrigem.trim(),
          numeroUcOrigem: params.numeroUcOrigem?.trim() || null,
          dataInicioMigracao: agora,
          motivo: params.motivo?.trim() || null,
        },
        select: { id: true },
      }),
      this.prisma.cooperado.update({
        where: { id: cooperadoId, cooperativaId },
        data: { status: 'PENDENTE_MIGRACAO' },
      }),
    ]);

    this.notificarInicio(cooperado, params.distribuidoraOrigem, cooperativaId);

    this.logger.log(
      `[migracao-externa] iniciada cooperado=${cooperadoId} migracaoId=${migracao.id} origem=${params.distribuidoraOrigem}`,
    );

    return { migracaoId: migracao.id, status: 'PENDENTE' };
  }

  /**
   * Conclui migração: statusMigracao='CONCLUIDA' + Cooperado.status='ATIVO'.
   * Volta sempre pra ATIVO (decisão Q4 — cascata posterior pelo fluxo
   * existente). Notifica cooperado.
   */
  async concluir(params: {
    cooperadoId: string;
    cooperativaId: string;
    realizadoPorId: string;
  }) {
    const { cooperadoId, cooperativaId } = params;

    const cooperado = await this.prisma.cooperado.findFirst({
      where: { id: cooperadoId, cooperativaId },
      select: { id: true, status: true, nomeCompleto: true, telefone: true },
    });
    if (!cooperado) {
      throw new NotFoundException('Cooperado não encontrado neste tenant.');
    }
    if (cooperado.status !== 'PENDENTE_MIGRACAO') {
      throw new BadRequestException(
        `Cooperado precisa estar em PENDENTE_MIGRACAO pra concluir. Status atual: ${cooperado.status}.`,
      );
    }

    const migracaoPendente = await this.prisma.migracaoUsina.findFirst({
      where: {
        cooperadoId,
        cooperativaId,
        tipo: 'DISTRIBUIDORA_EXTERNA',
        statusMigracao: 'PENDENTE',
      },
      orderBy: { criadoEm: 'desc' },
      select: { id: true, distribuidoraOrigem: true },
    });
    if (!migracaoPendente) {
      throw new BadRequestException(
        'Nenhuma MigracaoUsina PENDENTE encontrada — estado inconsistente.',
      );
    }

    const agora = new Date();
    // Defense-in-depth multi-tenant (P1 multitenant review 21/06).
    await this.prisma.$transaction([
      this.prisma.migracaoUsina.update({
        where: { id: migracaoPendente.id, cooperativaId },
        data: { statusMigracao: 'CONCLUIDA', dataDesligamentoEfetivo: agora },
      }),
      this.prisma.cooperado.update({
        where: { id: cooperadoId, cooperativaId },
        data: { status: 'ATIVO' },
      }),
    ]);

    this.notificarConclusao(
      cooperado,
      migracaoPendente.distribuidoraOrigem ?? 'concorrente',
      cooperativaId,
    );

    this.logger.log(
      `[migracao-externa] concluída cooperado=${cooperadoId} migracaoId=${migracaoPendente.id}`,
    );

    return { migracaoId: migracaoPendente.id, status: 'CONCLUIDA' };
  }

  /**
   * Rejeita migração: statusMigracao='REJEITADA' + Cooperado.status='DESLIGADO'.
   */
  async rejeitar(params: {
    cooperadoId: string;
    cooperativaId: string;
    realizadoPorId: string;
    motivo: string;
  }) {
    const { cooperadoId, cooperativaId, motivo } = params;

    if (!motivo?.trim() || motivo.trim().length < 5) {
      throw new BadRequestException(
        'motivo obrigatório (>=5 chars) — explique a rejeição pra auditoria.',
      );
    }

    const cooperado = await this.prisma.cooperado.findFirst({
      where: { id: cooperadoId, cooperativaId },
      select: { id: true, status: true, nomeCompleto: true, telefone: true },
    });
    if (!cooperado) {
      throw new NotFoundException('Cooperado não encontrado neste tenant.');
    }
    if (cooperado.status !== 'PENDENTE_MIGRACAO') {
      throw new BadRequestException(
        `Cooperado precisa estar em PENDENTE_MIGRACAO pra rejeitar. Status atual: ${cooperado.status}.`,
      );
    }

    const migracaoPendente = await this.prisma.migracaoUsina.findFirst({
      where: {
        cooperadoId,
        cooperativaId,
        tipo: 'DISTRIBUIDORA_EXTERNA',
        statusMigracao: 'PENDENTE',
      },
      orderBy: { criadoEm: 'desc' },
      select: { id: true },
    });
    if (!migracaoPendente) {
      throw new BadRequestException(
        'Nenhuma MigracaoUsina PENDENTE encontrada — estado inconsistente.',
      );
    }

    // P2 financeiro-token 21/06: ao DESLIGAR, cooperado pode ter saldo
    // positivo de token sem rota de saída (passivo travado FUNDACAO §4#1).
    // Logar saldo no AuditLog forense pra rastreabilidade — operacional
    // decide se vai liquidar via fluxo separado. Catalogado como
    // D-novo-M47-DESLIGADO-SALDO-RESIDUAL P2 pra rota de devolução.
    const saldoResidual = await this.prisma.cooperTokenSaldo.findUnique({
      where: { cooperadoId },
      select: { saldoDisponivel: true },
    });
    const tokensResiduais = Number(saldoResidual?.saldoDisponivel ?? 0);

    // Defense-in-depth multi-tenant (P1 multitenant review 21/06).
    await this.prisma.$transaction([
      this.prisma.migracaoUsina.update({
        where: { id: migracaoPendente.id, cooperativaId },
        data: { statusMigracao: 'REJEITADA', motivo: motivo.trim() },
      }),
      this.prisma.cooperado.update({
        where: { id: cooperadoId, cooperativaId },
        data: { status: 'DESLIGADO' },
      }),
    ]);

    // AuditLog forense pra saldo residual (P2 financeiro-token 21/06).
    if (tokensResiduais > 0) {
      this.logger.warn(
        `[migracao-externa] DESLIGADO com saldo residual cooperado=${cooperadoId} tokens=${tokensResiduais} migracaoId=${migracaoPendente.id} — passivo travado, requer rota de devolução manual`,
      );
      try {
        await this.prisma.auditLog.create({
          data: {
            usuarioId: params.realizadoPorId,
            usuarioPerfil: 'ADMIN',
            cooperativaId,
            acao: 'migracao.rejeitar.saldo-residual',
            recurso: 'CooperTokenSaldo',
            recursoId: cooperadoId,
            metadata: {
              migracaoId: migracaoPendente.id,
              tokensResiduais,
              motivo: motivo.trim(),
            } as any,
          },
        });
      } catch (err) {
        this.logger.warn(
          `[migracao-externa] AuditLog saldo residual falhou: ${(err as Error).message}`,
        );
      }
    }

    this.notificarRejeicao(cooperado, motivo.trim(), cooperativaId);

    this.logger.log(
      `[migracao-externa] rejeitada cooperado=${cooperadoId} migracaoId=${migracaoPendente.id} motivo="${motivo.trim()}" tokensResiduais=${tokensResiduais}`,
    );

    return { migracaoId: migracaoPendente.id, status: 'REJEITADA' };
  }

  // ─── Notificações (best-effort, não derrubam fluxo) ─────────

  // Notificações privadas — best-effort, com cooperativaId no metadata
  // (P2 multitenant review 21/06: rastreabilidade tenant em MensagemWhatsapp).
  private async notificarInicio(
    cooperado: { nomeCompleto: string; telefone: string | null },
    distribuidoraOrigem: string,
    cooperativaId: string,
  ): Promise<void> {
    if (!cooperado.telefone) {
      this.logger.warn(
        '[migracao-externa] sem telefone — notificação INICIO pulada (D-novo-NOTIF-EMAIL-FALLBACK)',
      );
      return;
    }
    const texto =
      `🔄 Migração iniciada\n\n` +
      `Olá, ${cooperado.nomeCompleto}!\n\n` +
      `Iniciamos sua migração de ${distribuidoraOrigem} pra CoopereBR. ` +
      `O processo pode demorar até 30 dias.\n\n` +
      `Durante esse período:\n` +
      `• Você continua recebendo créditos da ${distribuidoraOrigem}.\n` +
      `• Seu saldo de CooperTokens fica congelado (seguro).\n` +
      `• Nenhuma cobrança nossa será enviada.\n\n` +
      `Avisaremos quando concluir.`;

    try {
      await this.waSender.enviarMensagem(cooperado.telefone, texto, {
        tipoDisparo: 'MIGRACAO_EXTERNA_INICIADA',
        cooperativaId,
      });
    } catch (err) {
      this.logger.warn(`[migracao-externa] notif INICIO falhou: ${(err as Error).message}`);
    }
  }

  private async notificarConclusao(
    cooperado: { nomeCompleto: string; telefone: string | null },
    distribuidoraOrigem: string,
    cooperativaId: string,
  ): Promise<void> {
    if (!cooperado.telefone) {
      this.logger.warn(
        '[migracao-externa] sem telefone — notificação CONCLUSAO pulada (D-novo-NOTIF-EMAIL-FALLBACK)',
      );
      return;
    }
    const texto =
      `✅ Migração concluída\n\n` +
      `Olá, ${cooperado.nomeCompleto}!\n\n` +
      `Sua migração de ${distribuidoraOrigem} pra CoopereBR foi concluída. ` +
      `A partir de agora você passa a receber nossos créditos e fica ATIVO.\n\n` +
      `Seu saldo de CooperTokens foi descongelado e voltou a operar normalmente.\n\n` +
      `Bem-vindo de fato!`;

    try {
      await this.waSender.enviarMensagem(cooperado.telefone, texto, {
        tipoDisparo: 'MIGRACAO_EXTERNA_CONCLUIDA',
        cooperativaId,
      });
    } catch (err) {
      this.logger.warn(`[migracao-externa] notif CONCLUSAO falhou: ${(err as Error).message}`);
    }
  }

  private async notificarRejeicao(
    cooperado: { nomeCompleto: string; telefone: string | null },
    motivo: string,
    cooperativaId: string,
  ): Promise<void> {
    if (!cooperado.telefone) {
      this.logger.warn(
        '[migracao-externa] sem telefone — notificação REJEICAO pulada (D-novo-NOTIF-EMAIL-FALLBACK)',
      );
      return;
    }
    const texto =
      `ℹ️ Migração não concluída\n\n` +
      `Olá, ${cooperado.nomeCompleto}!\n\n` +
      `Sua migração pra CoopereBR não foi concluída.\n\n` +
      `Motivo: ${motivo}\n\n` +
      `Se quiser retomar no futuro, fale com nossa equipe.`;

    try {
      await this.waSender.enviarMensagem(cooperado.telefone, texto, {
        tipoDisparo: 'MIGRACAO_EXTERNA_REJEITADA',
        cooperativaId,
      });
    } catch (err) {
      this.logger.warn(`[migracao-externa] notif REJEICAO falhou: ${(err as Error).message}`);
    }
  }
}
