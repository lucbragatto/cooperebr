import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { ConveniosProgressaoService } from './convenios-progressao.service';
import { ConveniosCusteioService } from './convenios-custeio.service';
import { AsPlatform } from '../common/tenant-context';


@Injectable()
export class ConveniosJob {
  private readonly logger = new Logger(ConveniosJob.name);

  constructor(
    private progressaoService: ConveniosProgressaoService,
    // D-FISCAL-2.4.4b — cron consolidada custeio
    private custeioService: ConveniosCusteioService,
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
}
