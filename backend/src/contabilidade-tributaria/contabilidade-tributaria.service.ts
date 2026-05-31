import { Injectable, NotFoundException } from '@nestjs/common';
import { NaturezaCooperativa } from '@prisma/client';
import { PrismaService } from '../prisma.service';
import { RegimeContabilFactory } from './regimes/regime.factory';
import { FonteLancamento } from './regimes/regime-contabil.interface';

/**
 * D-novo-BR-CT CT.2 (31/05/2026) — Service nuclear da contabilidade
 * tributária segregada. CT.2 entrega só a classificação determinística;
 * CT.3 wira os hooks automáticos (Cobranca.PAGA → cria LancamentoCaixa
 * com naturezaAto já classificada); CT.4 (gate Walter) implementa o
 * motor de apuração tributária real.
 */
@Injectable()
export class ContabilidadeTributariaService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly factory: RegimeContabilFactory,
  ) {}

  /**
   * Classifica a natureza cooperativa de um lançamento futuro a partir
   * da fonte upstream + tenant. Resolve o regime contábil pela
   * `Cooperativa.regimeContabil` e delega ao implementador.
   *
   * Função pura (sem efeito colateral). Use antes de criar
   * LancamentoCaixa pra garantir naturezaAto correta na origem.
   */
  async classificarLancamento(
    cooperativaId: string,
    fonte: FonteLancamento,
  ): Promise<NaturezaCooperativa> {
    const coop = await this.prisma.cooperativa.findUnique({
      where: { id: cooperativaId },
      select: { id: true, regimeContabil: true },
    });
    if (!coop) throw new NotFoundException('Cooperativa não encontrada');

    const regime = this.factory.resolve(coop.regimeContabil);
    return regime.classificarLancamento(fonte);
  }
}
