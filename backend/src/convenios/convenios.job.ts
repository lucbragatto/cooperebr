import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { ConveniosProgressaoService } from './convenios-progressao.service';
import { ConveniosCusteioService } from './convenios-custeio.service';
import { AsPlatform } from '../common/tenant-context';
import { PrismaService } from '../prisma.service';
import { NotificacoesService } from '../notificacoes/notificacoes.service';
import { isAmbienteReal } from '../common/safety/ambiente';

const RETRY_BACKOFF_MIN = 30;
const RETRY_MAX_TENTATIVAS = 5;

@Injectable()
export class ConveniosJob {
  private readonly logger = new Logger(ConveniosJob.name);

  constructor(
    private progressaoService: ConveniosProgressaoService,
    // D-FISCAL-2.4.4b — cron consolidada custeio
    private custeioService: ConveniosCusteioService,
    // Sprint Financeiro F1 (04/06/2026) — job retry emissão consolidada
    private prisma: PrismaService,
    private notificacoes: NotificacoesService,
  ) {}

  // Reconciliação diária às 3h da manhã
  @Cron('0 3 * * *')

  @AsPlatform()
  async reconciliarFaixas() {
    this.logger.log('Iniciando reconciliação diária de faixas de convênios...');
    try {
      const total = await this.progressaoService.recalcularTodos();
      this.logger.log(`Reconciliação concluída: ${total} convênios recalculados`);
    } catch (err: any) {
      this.logger.error(`Erro na reconciliação de faixas: ${err.message}`);
    }
  }

  /**
   * D-FISCAL-2.4.4b — Cron diário 04h gerando consolidadas do mês FECHADO
   * anterior pros convênios EMPRESA cujo `diaEnvioRelatorio` cair hoje.
   *
   * Roda às 4h (após reconciliação 3h + crons cobranças 2h-3h pra evitar
   * concorrência em LancamentoCaixa). @AsPlatform pra contexto sem tenant
   * (o cron varre convênios de todas cooperativas; cooperativaId vem do
   * próprio convênio dentro do método).
   *
   * Decisões Luciano (Fase 1 D-FISCAL-2.4.4):
   *  - Mês FECHADO anterior (corrente teria faturas faltando).
   *  - Idempotência via @@unique (re-rodar não duplica).
   *  - Erros por convênio (kWh=0 quando faturas atrasam) ficam em log warn;
   *    admin gera manual via endpoint POST/UI 2.4.4d se necessário.
   */
  @Cron('0 4 * * *')
  @AsPlatform()
  async gerarConsolidadasMensalCusteio() {
    this.logger.log('[D-FISCAL-2.4.4b] Iniciando cron diário de consolidadas custeio...');
    try {
      const r = await this.custeioService.cronGerarConsolidadasDoMesFechado();
      if (r.processados > 0) {
        this.logger.log(
          `[D-FISCAL-2.4.4b] Cron concluído — processados=${r.processados}, ` +
            `criados=${r.criados}, jaExistem=${r.jaExistem}, falhas=${r.falhas}.`,
        );
      }
    } catch (err: any) {
      this.logger.error(
        `[D-FISCAL-2.4.4b] Erro fatal no cron de consolidadas: ${err.message}`,
      );
    }
  }

  /**
   * Sprint Financeiro F1 (04/06/2026) — Cron retry da emissão de cobranças
   * consolidadas no gateway. Roda a cada 30min em ambiente real.
   *
   * Decisões Luciano (travadas):
   *  (1) Campo separado `statusEmissao` (não polui StatusCobranca).
   *  (2) Cap 5 tentativas + back-off 30min entre tentativas.
   *  (5) Dev (!isAmbienteReal) mantém AGUARDANDO sem retry — job short-circuit.
   *
   * Critérios de busca:
   *  - convenioContabilCobrancaId != null  (só consolidadas)
   *  - statusEmissao = AGUARDANDO_EMISSAO
   *  - tentativasEmissao < 5
   *  - ultimaTentativaEmissaoEm null OR < now-30min  (back-off)
   *
   * Após chamar emitirNoGateway:
   *  - Re-lê a cobrança; se tentativasEmissao atingiu cap E ainda em
   *    AGUARDANDO_EMISSAO → marca FALHA_EMISSAO + notifica admin (in-app).
   */
  @Cron('*/30 * * * *')
  @AsPlatform()
  async retryEmissaoConsolidadas() {
    // Decisão #5: dev fica AGUARDANDO permanente — não rodar retry
    if (!isAmbienteReal()) {
      this.logger.debug(
        '[F1 retry] AMBIENTE_REAL=false — skip retry (consolidadas ficam AGUARDANDO_EMISSAO em dev).',
      );
      return;
    }

    const limite = new Date(Date.now() - RETRY_BACKOFF_MIN * 60 * 1000);

    // Tarefa 4 correção #3 (22/07/2026) — filtro RELAXADO: removido
    // `convenioContabilCobrancaId: { not: null }`. Agora varre TAMBÉM cobranças
    // regulares que a correção #2 marca como AGUARDANDO_EMISSAO na criação.
    // Histórico com statusEmissao=null fica de fora naturalmente (o filtro
    // statusEmissao: 'AGUARDANDO_EMISSAO' já protege — cobranças antigas E as
    // manuais/sem_gateway ficam invisíveis pro cron).
    const pendentes = await this.prisma.cobranca.findMany({
      where: {
        statusEmissao: 'AGUARDANDO_EMISSAO',
        tentativasEmissao: { lt: RETRY_MAX_TENTATIVAS },
        OR: [
          { ultimaTentativaEmissaoEm: null },
          { ultimaTentativaEmissaoEm: { lt: limite } },
        ],
      },
      select: {
        id: true,
        valorLiquido: true,
        dataVencimento: true,
        cooperativaId: true,
        mesReferencia: true,
        anoReferencia: true,
        convenioContabilCobrancaId: true,
        // Fallback pro caminho regular (sem convênio) — precisa do cooperadoId
        // via contrato pra saber pra quem emitir.
        contrato: {
          select: { cooperadoId: true },
        },
        convenioContabilCobranca: {
          select: {
            id: true,
            empresaNome: true,
            cooperativaId: true,
            pagadorCooperadoId: true,
          },
        },
      },
      take: 50, // batch defensivo
    });

    if (pendentes.length === 0) {
      this.logger.debug('[F1 retry] Nenhuma consolidada AGUARDANDO_EMISSAO elegível.');
      return;
    }

    this.logger.log(
      `[F1 retry] ${pendentes.length} consolidada(s) elegível(is) pra retry de emissão.`,
    );

    let tentadas = 0;
    let emitidas = 0;
    let falhas = 0;

    for (const c of pendentes) {
      const conv = c.convenioContabilCobranca;
      const cooperativaId = c.cooperativaId ?? conv?.cooperativaId;
      // Correção #3 (22/07/2026) — cooperado alvo tem 2 origens:
      //   - Convênio (consolidada custeio): conv.pagadorCooperadoId (empresa PJ)
      //   - Regular (path criado por cobrancas.service.criar): contrato.cooperadoId
      const cooperadoAlvo = conv?.pagadorCooperadoId ?? c.contrato?.cooperadoId;

      if (!cooperativaId || !cooperadoAlvo) {
        this.logger.warn(
          `[F1 retry] Cobrança ${c.id} sem cooperativa/cooperado resolvíveis — skip.`,
        );
        continue;
      }

      const mesRefStr = `${String(c.mesReferencia).padStart(2, '0')}/${c.anoReferencia}`;
      const descricao = conv
        ? `Cobrança consolidada — ${conv.empresaNome} — ${mesRefStr}`
        : `Cobrança ${mesRefStr}`;

      tentadas++;
      try {
        await this.custeioService.emitirNoGateway(
          c.id,
          cooperativaId,
          cooperadoAlvo,
          Number(c.valorLiquido),
          c.dataVencimento,
          descricao,
        );
      } catch (err) {
        // emitirNoGateway tem try/catch interno — não deveria propagar.
        // Mas se algo escapar, logamos e seguimos pra próxima.
        this.logger.error(
          `[F1 retry] Exceção inesperada em emitirNoGateway pra ${c.id}: ${(err as Error).message}`,
        );
      }

      // Re-lê estado pós-tentativa. Se atingiu cap E ainda AGUARDANDO, marca FALHA.
      const atual = await this.prisma.cobranca.findUnique({
        where: { id: c.id },
        select: {
          statusEmissao: true,
          tentativasEmissao: true,
          ultimoErroEmissao: true,
        },
      });

      if (!atual) continue;

      if (atual.statusEmissao === 'EMITIDO') {
        emitidas++;
        continue;
      }

      if (
        atual.statusEmissao === 'AGUARDANDO_EMISSAO' &&
        atual.tentativasEmissao >= RETRY_MAX_TENTATIVAS
      ) {
        falhas++;
        // Correção #3 (22/07/2026) — fallback pro path regular (conv=null).
        // Texto da notificação in-app usa mesRef como descriminador quando
        // não há empresaNome (convênio).
        const nomeReferencia = conv?.empresaNome ?? `Cobrança regular ${mesRefStr}`;
        await this.marcarFalhaEmissao(
          c.id,
          nomeReferencia,
          cooperativaId,
          atual.ultimoErroEmissao ?? 'erro desconhecido',
        );
      }
    }

    this.logger.log(
      `[F1 retry] Concluído — tentadas=${tentadas}, emitidas=${emitidas}, ` +
        `marcadas como FALHA_EMISSAO=${falhas}.`,
    );
  }

  /**
   * F1 — após 5ª falha consecutiva, marca FALHA_EMISSAO + cria notificação
   * in-app pros admins do tenant (adminId=null roteia pra todos os admins
   * da cooperativaId — ver NotificacoesService.buildWhere).
   */
  private async marcarFalhaEmissao(
    cobrancaId: string,
    empresaNome: string,
    cooperativaId: string,
    ultimoErro: string,
  ) {
    try {
      await this.prisma.cobranca.update({
        where: { id: cobrancaId },
        data: { statusEmissao: 'FALHA_EMISSAO' },
      });
    } catch (err) {
      this.logger.error(
        `[F1 retry] Falha ao marcar FALHA_EMISSAO em ${cobrancaId}: ${(err as Error).message}`,
      );
      return;
    }

    try {
      await this.notificacoes.criar({
        tipo: 'COBRANCA_EMISSAO_FALHOU',
        titulo: 'Emissão de cobrança falhou',
        mensagem:
          `Cobrança consolidada de ${empresaNome} falhou ${RETRY_MAX_TENTATIVAS}× ao emitir no gateway. ` +
          `Último erro: ${ultimoErro.slice(0, 200)}. Use "Tentar de novo" na tela do convênio.`,
        cooperativaId,
        link: '/dashboard/convenios',
      });
    } catch (err) {
      this.logger.error(
        `[F1 retry] Falha ao criar notificação admin pra ${cobrancaId}: ${(err as Error).message}`,
      );
    }

    this.logger.warn(
      `[F1 retry] Cobrança ${cobrancaId} (${empresaNome}) marcada FALHA_EMISSAO ` +
        `após ${RETRY_MAX_TENTATIVAS} tentativas. Admin notificado.`,
    );
  }
}
