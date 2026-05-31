import { NaturezaCooperativa } from '@prisma/client';
import {
  FonteLancamento,
  RegimeContabil,
  RegimeNaoImplementadoException,
} from './regime-contabil.interface';

/**
 * D-novo-BR-CT CT.2 — STUB Regime ASSOCIACAO_SEM_FINS_LUCRATIVOS.
 *
 * NÃO HERDA da cooperativa (P0-1). Bloqueio explícito até implementação
 * dedicada (CC Arts. 53-61 + Lei 9.532/97).
 *
 * Quando onboarding ASSOCIACAO ativar: enum NaturezaReceitaAssociacao
 * (ATIVIDADE_PROPRIA / RECEITA_ATIPICA / CONVENIO), motor PIS-Folha (1%
 * sobre salários), COFINS isento sobre própria + 3% sobre atípica, IRPJ
 * isento sobre superávit reinvestido.
 */
export class RegimeAssociacaoStub implements RegimeContabil {
  readonly nome = 'ASSOCIACAO_SEM_FINS_LUCRATIVOS';

  classificarLancamento(_fonte: FonteLancamento): NaturezaCooperativa {
    throw new RegimeNaoImplementadoException(this.nome);
  }
}
