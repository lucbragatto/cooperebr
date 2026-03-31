import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { PosicaoCooperadoService } from './posicao-cooperado.service';

@Injectable()
export class PosicaoCooperadoJob {
  private readonly logger = new Logger(PosicaoCooperadoJob.name);

  constructor(private posicaoCooperadoService: PosicaoCooperadoService) {}

  @Cron('0 7 * * *')
  async refreshDiario() {
    try {
      await this.posicaoCooperadoService.refreshView();
      this.logger.log('Refresh diário da view vw_posicao_cooperado concluído');
    } catch (err) {
      this.logger.error(`Falha ao atualizar view vw_posicao_cooperado: ${err.message}`);
    }
  }
}
