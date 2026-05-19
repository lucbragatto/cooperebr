/**
 * Sprint 8 / Bloco E — Cron mensal de recálculo de Alocação Otima (M14.B).
 *
 * Executa dia 5 de cada mês às 03:00 BRT. Itera cooperativas ativas, dispara
 * `AlocacaoService.simular()` pra cada uma, e cria notificação `ALOCACAO_SUGERIDA`
 * pro admin (perfil ADMIN/SUPER_ADMIN da cooperativa) quando a simulação retorna
 * realocações sugeridas com economia proxy > 0.
 */
import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from '../prisma.service';
import { AlocacaoService } from './alocacao.service';

const THRESHOLD_ECONOMIA_PROXY = 100; // valor proxy mínimo pra notificar (sprint 5a Neutro vai trocar por R$ real)

@Injectable()
export class AlocacaoJob {
  private readonly logger = new Logger(AlocacaoJob.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly alocacao: AlocacaoService,
  ) {}

  /// Dia 5 de cada mês às 03:00 (TZ servidor — em produção BRT). Decisão C.3 aprovada 18/05.
  @Cron('0 3 5 * *')
  async cronMensalAlocacao() {
    this.logger.log('[alocacao-cron] Iniciando recálculo mensal de alocação otima.');
    await this.executarCiclo({ origem: 'cron-mensal' });
  }

  /**
   * Permite dispatch manual (admin clica "Recalcular agora" OU pelo cli ts-node)
   * sem esperar o cron mensal. Usado pelo smoke E2E.
   */
  async executarCiclo(args: { origem: string }) {
    const { origem } = args;
    const cooperativas = await this.prisma.cooperativa.findMany({
      where: { ativo: true },
      select: { id: true, nome: true },
    });

    let totalGeradas = 0;
    let totalNotificacoes = 0;
    const erros: { cooperativaId: string; erro: string }[] = [];

    for (const coop of cooperativas) {
      try {
        const alocacao = await this.alocacao.simular({ cooperativaId: coop.id });
        totalGeradas += 1;

        const snapshot = alocacao.snapshot as unknown as {
          realocacoesSugeridas: number;
          economiaTotalProxy: number;
        };

        if (
          snapshot.realocacoesSugeridas > 0 &&
          snapshot.economiaTotalProxy >= THRESHOLD_ECONOMIA_PROXY
        ) {
          await this.criarNotificacaoAdmin(coop, alocacao.id, snapshot);
          totalNotificacoes += 1;
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        this.logger.error(
          `[alocacao-cron] Falha simular cooperativa ${coop.id} (${coop.nome}): ${msg}`,
        );
        erros.push({ cooperativaId: coop.id, erro: msg });
      }
    }

    this.logger.log(
      `[alocacao-cron] (${origem}) Concluído: ${totalGeradas} alocações geradas, ${totalNotificacoes} notificações disparadas, ${erros.length} erros.`,
    );

    return { totalGeradas, totalNotificacoes, erros };
  }

  private async criarNotificacaoAdmin(
    coop: { id: string; nome: string },
    alocacaoId: string,
    snapshot: { realocacoesSugeridas: number; economiaTotalProxy: number },
  ) {
    const admins = await this.prisma.usuario.findMany({
      where: {
        cooperativaId: coop.id,
        ativo: true,
        perfil: { in: ['ADMIN', 'SUPER_ADMIN'] },
      },
      select: { id: true },
    });

    for (const admin of admins) {
      await this.prisma.notificacao.create({
        data: {
          tipo: 'ALOCACAO_SUGERIDA',
          titulo: 'Nova sugestão de realocação Multi-Usina',
          mensagem: `Engine sugeriu ${snapshot.realocacoesSugeridas} realocação(ões) com economia proxy ${snapshot.economiaTotalProxy}. Acesse o painel pra revisar.`,
          link: `/dashboard/parceiro/alocacao?tab=sugestoes&id=${alocacaoId}`,
          cooperativaId: coop.id,
          adminId: admin.id,
        },
      });
    }
  }
}
