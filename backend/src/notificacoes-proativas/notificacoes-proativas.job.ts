/**
 * Bloco D (16/05/2026) — 3 crons proativos.
 * Frequência confirmada Luciano 17/05:
 *  - CRON A: diária 10:00 (evita 08:00-09:00 já ocupado)
 *  - CRON B: diária 08:00
 *  - CRON C: diária 11:00 (filtro interno 24h pós-criação UC + reforço 72h se EDP-PENDENTE)
 */
import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { PrismaService } from '../prisma.service';
import { NotificacoesProativasService } from './notificacoes-proativas.service';

@Injectable()
export class NotificacoesProativasJob {
  private readonly logger = new Logger(NotificacoesProativasJob.name);

  constructor(
    private prisma: PrismaService,
    private service: NotificacoesProativasService,
  ) {}

  // ─── CRON A: lembrete cooperado (10:00 diário) ───────────────────
  @Cron('0 10 * * *')
  async cronALembreteCooperado() {
    const cooperativas = await this.prisma.cooperativa.findMany({
      where: { ativo: true },
      select: { id: true, nome: true },
    });
    let totalEnviados = 0;
    for (const coop of cooperativas) {
      try {
        const r = await this.service.processarLembreteDocsCooperado(coop.id);
        totalEnviados += r.enviados;
        if (r.enviados > 0) {
          this.logger.log(
            `CRON-A ${coop.nome}: ${r.enviados} lembrete(s) enviado(s), ${r.pulados} pulado(s)`,
          );
        }
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : 'erro desconhecido';
        this.logger.error(`CRON-A ${coop.nome} falhou: ${msg}`);
      }
    }
    if (totalEnviados > 0) {
      this.logger.log(`CRON-A total: ${totalEnviados} lembrete(s) enviado(s)`);
    }
  }

  // ─── CRON B: alerta admin (08:00 diário) ─────────────────────────
  @Cron('0 8 * * *')
  async cronBAlertaAdmin() {
    const cooperativas = await this.prisma.cooperativa.findMany({
      where: { ativo: true },
      select: { id: true, nome: true },
    });
    let totalAlertados = 0;
    for (const coop of cooperativas) {
      try {
        const r = await this.service.processarAlertaAdminDocsParados(coop.id);
        if (r.alertado) {
          totalAlertados++;
          this.logger.log(`CRON-B ${coop.nome}: admin alertado sobre ${r.cooperados} cooperado(s)`);
        }
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : 'erro desconhecido';
        this.logger.error(`CRON-B ${coop.nome} falhou: ${msg}`);
      }
    }
    if (totalAlertados > 0) {
      this.logger.log(`CRON-B total: ${totalAlertados} cooperativa(s) alertada(s)`);
    }
  }

  // ─── CRON C: lembrete email EDP (11:00 diário) ──────────────────
  @Cron('0 11 * * *')
  async cronCLembreteEmailEdp() {
    const cooperativas = await this.prisma.cooperativa.findMany({
      where: { ativo: true },
      select: { id: true, nome: true },
    });
    let totalEnviados = 0;
    for (const coop of cooperativas) {
      try {
        const r = await this.service.processarLembreteEmailEdp(coop.id);
        totalEnviados += r.enviados;
        if (r.enviados > 0) {
          this.logger.log(
            `CRON-C ${coop.nome}: ${r.enviados} lembrete(s) EDP, ${r.pulados} pulado(s)`,
          );
        }
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : 'erro desconhecido';
        this.logger.error(`CRON-C ${coop.nome} falhou: ${msg}`);
      }
    }
    if (totalEnviados > 0) {
      this.logger.log(`CRON-C total: ${totalEnviados} lembrete(s) EDP enviado(s)`);
    }
  }
}
