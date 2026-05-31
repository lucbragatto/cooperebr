import { NaturezaCooperativa } from '@prisma/client';
import {
  FonteLancamento,
  RegimeContabil,
  RegimeNaoImplementadoException,
} from './regime-contabil.interface';

/**
 * D-novo-BR-CT CT.2 — STUB Regime CONDOMINIO_EDILICIO.
 *
 * NÃO HERDA da cooperativa (P0-1). Bloqueio explícito até implementação
 * dedicada (CC Arts. 1.314-1.358-A + Lei 14.300/2022).
 *
 * Quando onboarding CONDOMINIO ativar: SEM IRPJ/CSLL (P0-2 do parecer
 * — condomínio NÃO é pessoa jurídica contribuinte), SEM PIS/COFINS
 * próprio, motor de retenção na fonte (4,65% PJ + IRRF arrendamento PF),
 * sub-modalidade EMUC vs GERACAO_COMPARTILHADA, plano simplificado.
 */
export class RegimeCondominioStub implements RegimeContabil {
  readonly nome = 'CONDOMINIO_EDILICIO';

  classificarLancamento(_fonte: FonteLancamento): NaturezaCooperativa {
    throw new RegimeNaoImplementadoException(this.nome);
  }
}
