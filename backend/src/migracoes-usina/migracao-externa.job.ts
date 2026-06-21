/**
 * Sprint Convênio MIGRAÇÃO M47 (21/06/2026) — Fatia D.
 *
 * Cron diário que detecta migrações PENDENTE há mais de 30 dias e:
 *  1. Emite evento `MIGRACAO_PENDENTE_TIMEOUT` (catalogado pra futuras
 *     integrações tipo dashboard admin).
 *  2. Grava AuditLog forense (usuarioId=SYSTEM_CRON).
 *  3. Notifica admin do tenant via WhatsApp pra decidir (NÃO faz rollback
 *     automático — sensível demais; admin que decide manual).
 *
 * Decisão Q3 orquestrador: WA admin + AuditLog (sem email/email fallback).
 *
 * Janela: 30 dias (sem flag configurável MVP). Cooperado fica em
 * PENDENTE_MIGRACAO ESPERANDO admin chamar /migrar/concluir ou /migrar/
 * rejeitar; cron só alerta.
 */
import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { PrismaService } from '../prisma.service';
import { WhatsappSenderService } from '../whatsapp/whatsapp-sender.service';

const TIMEOUT_DIAS = 30;
const SYSTEM_CRON_USER_ID = 'SYSTEM_CRON';

export class MigracaoPendenteTimeoutEvent {
  constructor(
    public readonly cooperativaId: string,
    public readonly migracaoId: string,
    public readonly cooperadoId: string,
    public readonly diasEmPendente: number,
  ) {}
}

@Injectable()
export class MigracaoExternaJob {
  private readonly logger = new Logger(MigracaoExternaJob.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly waSender: WhatsappSenderService,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  /**
   * Diário às 7h: detecta migrações PENDENTE > 30 dias.
   * Best-effort por linha — falha de WA/AuditLog em 1 não derruba o restante.
   */
  @Cron('0 7 * * *')
  async verificarMigracoesPendentes(): Promise<{
    detectadas: number;
    alertasEnviados: number;
  }> {
    this.logger.log('[migracao-cron] iniciando verificação de migrações > 30d');

    const limite = new Date();
    limite.setDate(limite.getDate() - TIMEOUT_DIAS);

    // INTENCIONAL: cron de plataforma varre todos os tenants
    // (cooperativaId NÃO entra no filtro inicial). Cada linha é processada
    // com seu próprio cooperativaId — AuditLog + WA admin usam o valor da
    // linha pra rastreabilidade tenant-correta. Padrão P3 multitenter review
    // 21/06.
    const pendentes = await this.prisma.migracaoUsina.findMany({
      where: {
        tipo: 'DISTRIBUIDORA_EXTERNA',
        statusMigracao: 'PENDENTE',
        dataInicioMigracao: { lt: limite },
      },
      select: {
        id: true,
        cooperadoId: true,
        cooperativaId: true,
        distribuidoraOrigem: true,
        dataInicioMigracao: true,
      },
    });

    this.logger.log(`[migracao-cron] ${pendentes.length} migrações > ${TIMEOUT_DIAS}d detectadas`);

    let alertasEnviados = 0;
    for (const m of pendentes) {
      if (!m.cooperativaId || !m.dataInicioMigracao) continue;

      const dias = Math.floor(
        (Date.now() - m.dataInicioMigracao.getTime()) / 86400000,
      );

      try {
        await this.processarTimeout({
          migracaoId: m.id,
          cooperadoId: m.cooperadoId,
          cooperativaId: m.cooperativaId,
          distribuidoraOrigem: m.distribuidoraOrigem ?? '(origem não registrada)',
          dias,
        });
        alertasEnviados++;
      } catch (err) {
        this.logger.error(
          `[migracao-cron] falha ao processar timeout migracaoId=${m.id}: ${(err as Error).message}`,
        );
      }
    }

    return { detectadas: pendentes.length, alertasEnviados };
  }

  private async processarTimeout(params: {
    migracaoId: string;
    cooperadoId: string;
    cooperativaId: string;
    distribuidoraOrigem: string;
    dias: number;
  }): Promise<void> {
    const { migracaoId, cooperadoId, cooperativaId, distribuidoraOrigem, dias } = params;

    // 1. Emit evento (para integrações futuras: dashboard admin, alertas etc).
    this.eventEmitter.emit(
      'migracao-externa.pendente-timeout',
      new MigracaoPendenteTimeoutEvent(cooperativaId, migracaoId, cooperadoId, dias),
    );

    // 2. AuditLog forense.
    try {
      await this.prisma.auditLog.create({
        data: {
          usuarioId: SYSTEM_CRON_USER_ID,
          usuarioPerfil: 'SYSTEM',
          cooperativaId,
          acao: 'migracao.externa.timeout.detectado',
          recurso: 'MigracaoUsina',
          recursoId: migracaoId,
          metadata: {
            cooperadoId,
            distribuidoraOrigem,
            diasEmPendente: dias,
            timeoutLimite: TIMEOUT_DIAS,
          } as any,
        },
      });
    } catch (err) {
      this.logger.warn(
        `[migracao-cron] AuditLog timeout falhou migracaoId=${migracaoId}: ${(err as Error).message}`,
      );
    }

    // 3. Notifica admin do tenant via WA — busca o ADMIN ATIVO mais antigo
    // (orderBy criadoEm asc — P3 financeiro-token: determinístico). Cooperativas
    // com múltiplos admins: chega pro primário (geralmente o fundador).
    const admin = await this.prisma.usuario.findFirst({
      where: { cooperativaId, perfil: 'ADMIN', ativo: true },
      orderBy: { createdAt: 'asc' },
      select: { telefone: true, nome: true },
    });
    if (!admin?.telefone) {
      this.logger.warn(
        `[migracao-cron] cooperativaId=${cooperativaId} sem ADMIN com telefone — alerta pulado`,
      );
      return;
    }

    const texto =
      `⚠️ Migração PENDENTE há ${dias} dias\n\n` +
      `Olá, ${admin.nome ?? 'Admin'}!\n\n` +
      `Uma migração externa está aberta há mais que ${TIMEOUT_DIAS} dias e ainda não foi ` +
      `concluída nem rejeitada.\n\n` +
      `• Cooperado: ${cooperadoId}\n` +
      `• Origem: ${distribuidoraOrigem}\n` +
      `• Migração: ${migracaoId}\n\n` +
      `Decida no painel: /migrar/concluir (ATIVO) ou /migrar/rejeitar (DESLIGADO).`;

    try {
      await this.waSender.enviarMensagem(admin.telefone, texto, {
        tipoDisparo: 'MIGRACAO_PENDENTE_TIMEOUT_ADMIN',
        disparoId: migracaoId,
        cooperativaId,
      });
    } catch (err) {
      this.logger.warn(
        `[migracao-cron] WA admin falhou migracaoId=${migracaoId}: ${(err as Error).message}`,
      );
    }
  }
}
