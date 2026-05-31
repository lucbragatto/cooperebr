import { NaturezaCooperativa } from '@prisma/client';
import {
  FonteLancamento,
  RegimeContabil,
  RegimeNaoImplementadoException,
} from './regime-contabil.interface';

/**
 * D-novo-BR-CT CT.2 — STUB Regime CONSORCIO_PROPORCIONAL.
 *
 * NÃO HERDA da cooperativa (P0-1 do parecer subagent). Bloqueio
 * explícito até implementação dedicada do regime proporcional
 * (Lei 6.404/76 Arts. 278-279 + Lei 14.300/2022).
 *
 * Quando onboarding Sinergia ativar, este stub é substituído por
 * implementação real com: percentualParticipacao por consorciada,
 * subregistros proporcionais, motor PIS/COFINS plena, IRPJ/CSLL
 * por consorciada.
 */
export class RegimeConsorcioStub implements RegimeContabil {
  readonly nome = 'CONSORCIO_PROPORCIONAL';

  classificarLancamento(_fonte: FonteLancamento): NaturezaCooperativa {
    throw new RegimeNaoImplementadoException(this.nome);
  }
}
