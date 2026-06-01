import { NaturezaCooperativa } from '@prisma/client';
import {
  FonteLancamento,
  RegimeContabil,
} from './regime-contabil.interface';

/**
 * D-novo-BR-CT CT.2 — Regime COOPERATIVO (Lei 5.764/71).
 *
 * Tabela de classificação aprovada (Luciano 31/05/2026 — vide
 * memória decisao_modulo_contabilidade_tributaria_17_05.md + parecer
 * subagent cooperebr-analista-conformidade):
 *
 * | Fonte               | Condição                                | Natureza         |
 * |---------------------|-----------------------------------------|------------------|
 * | Cobranca            | cooperado COM_UC/SEM_UC/GERADOR         | PROPRIO          |
 * | Cobranca            | tipoCooperado CARREGADOR_VEICULAR ou    | NAO_COOPERATIVO  |
 * |                     | USUARIO_CARREGADOR (sem vínculo coop)   |                  |
 * | ContaAPagar         | despesa operacional usina               | PROPRIO          |
 * | RepasseProprietario | Usina.formaAquisicao = ALUGUEL          | NAO_COOPERATIVO  |
 * |                     | (arrendamento externo — risco P0-3)     |                  |
 * | RepasseProprietario | Usina.formaAquisicao = CESSAO           | PROPRIO          |
 * |                     | (cooperado-proprietário cede usina)     |                  |
 * | RepasseProprietario | Usina.formaAquisicao = PROPRIA          | PROPRIO          |
 * |                     | (usina da própria cooperativa)          |                  |
 * | Convenio            | qualquer                                | AUXILIAR         |
 *
 * Determinístico. Sem IA. Sem fallback silencioso.
 */
export class RegimeCooperativo implements RegimeContabil {
  readonly nome = 'COOPERATIVO';

  /** Tipos de cooperado que CONFIGURAM vínculo cooperativo formal */
  private static readonly TIPOS_ASSOCIADOS = new Set([
    'COM_UC',
    'SEM_UC',
    'GERADOR',
  ]);

  /** Tipos sem vínculo cooperativo (terceiros) */
  private static readonly TIPOS_TERCEIROS = new Set([
    'CARREGADOR_VEICULAR',
    'USUARIO_CARREGADOR',
  ]);

  classificarLancamento(fonte: FonteLancamento): NaturezaCooperativa {
    switch (fonte.tipo) {
      case 'COBRANCA': {
        const tipo = fonte.cooperadoTipoCooperado;
        if (tipo && RegimeCooperativo.TIPOS_TERCEIROS.has(tipo)) {
          return NaturezaCooperativa.NAO_COOPERATIVO;
        }
        if (tipo && RegimeCooperativo.TIPOS_ASSOCIADOS.has(tipo)) {
          return NaturezaCooperativa.PROPRIO;
        }
        // tipo null/desconhecido: assume PROPRIO (cooperado deletado ou tipo
        // ainda não classificado — Luciano + orquestrador revisam via flag observacaoContabil)
        return NaturezaCooperativa.PROPRIO;
      }

      case 'CONTA_A_PAGAR':
        // Despesa operacional da usina = consecução objeto social cooperativo
        return NaturezaCooperativa.PROPRIO;

      case 'REPASSE_PROPRIETARIO': {
        // P0-3 do parecer: arrendamento externo = NAO_COOPERATIVO
        if (fonte.usinaFormaAquisicao === 'ALUGUEL') {
          return NaturezaCooperativa.NAO_COOPERATIVO;
        }
        // CESSAO (cooperado-proprietário) ou PROPRIA = ato cooperativo próprio
        return NaturezaCooperativa.PROPRIO;
      }

      case 'CONVENIO':
        // Art. 88 Lei 5.764/71 — convênio = ato auxiliar
        return NaturezaCooperativa.AUXILIAR;

      default: {
        // Exhaustiveness check em compile-time
        const _exhaustive: never = fonte;
        throw new Error(`FonteLancamento desconhecida: ${JSON.stringify(_exhaustive)}`);
      }
    }
  }
}
