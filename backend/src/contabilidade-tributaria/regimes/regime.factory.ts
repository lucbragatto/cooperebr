import { Injectable } from '@nestjs/common';
import { TipoRegimeContabil } from '@prisma/client';
import { RegimeContabil } from './regime-contabil.interface';
import { RegimeCooperativo } from './cooperativo.regime';
import { RegimeConsorcioStub } from './consorcio.regime.stub';
import { RegimeAssociacaoStub } from './associacao.regime.stub';
import { RegimeCondominioStub } from './condominio.regime.stub';

/**
 * D-novo-BR-CT CT.2 — Factory que resolve a implementação correta a partir
 * de `Cooperativa.regimeContabil`. Não-implementados = stub explícito
 * (não fallback silencioso pra cooperativo).
 *
 * Uso em service:
 *   const regime = this.factory.resolve(cooperativa.regimeContabil);
 *   const natureza = regime.classificarLancamento({ tipo: 'COBRANCA', ... });
 */
@Injectable()
export class RegimeContabilFactory {
  private readonly cooperativo = new RegimeCooperativo();
  private readonly consorcioStub = new RegimeConsorcioStub();
  private readonly associacaoStub = new RegimeAssociacaoStub();
  private readonly condominioStub = new RegimeCondominioStub();

  resolve(regime: TipoRegimeContabil): RegimeContabil {
    switch (regime) {
      case TipoRegimeContabil.COOPERATIVO:
        return this.cooperativo;
      case TipoRegimeContabil.CONSORCIO_PROPORCIONAL:
        return this.consorcioStub;
      case TipoRegimeContabil.ASSOCIACAO_SEM_FINS_LUCRATIVOS:
        return this.associacaoStub;
      case TipoRegimeContabil.CONDOMINIO_EDILICIO:
        return this.condominioStub;
      default: {
        const _exhaustive: never = regime;
        throw new Error(`TipoRegimeContabil desconhecido: ${_exhaustive}`);
      }
    }
  }
}
