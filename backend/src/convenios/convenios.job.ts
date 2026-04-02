import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { ConveniosProgressaoService } from './convenios-progressao.service';

@Injectable()
export class ConveniosJob {
  private readonly logger = new Logger(ConveniosJob.name);

  constructor(private progressaoService: ConveniosProgressaoService) {}

  // Reconciliação diária às 3h da manhã
  @Cron('0 3 * * *')
  async reconciliarFaixas() {
    this.logger.log('Iniciando reconciliação diária de faixas de convênios...');
    try {
      const total = await this.progressaoService.recalcularTodos();
      this.logger.log(`Reconciliação concluída: ${total} convênios recalculados`);
    } catch (err: any) {
      this.logger.error(`Erro na reconciliação de faixas: ${err.message}`);
    }
  }
}
