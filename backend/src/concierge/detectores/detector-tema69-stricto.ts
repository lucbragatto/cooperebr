import { Injectable } from '@nestjs/common';
import type { FaturaCanonica } from '../fatura-canonica/fatura-canonica.types';
import type {
  DetectorPadraoTributario,
  ResultadoDeteccao,
} from './detectores.types';
import { projetar60mSelic } from './detectores.types';

/**
 * Tema 69 STF (RE 574.706) stricto sensu - "Tese do Seculo".
 *
 * Determina que PIS/COFINS NAO incidem sobre o ICMS destacado na NF.
 * Base correta de PIS/COFINS = (base de venda) - (ICMS destacado).
 *
 * O detector compara a base PIS/COFINS DECLARADA na fatura com a base
 * ESPERADA pelo Tema 69. Quando divergem:
 *   - Declarada > Esperada -> concessionaria nao excluiu ICMS -> INDEBITO
 *   - Declarada < Esperada -> concessionaria excluiu A MAIS -> FAVORAVEL
 *   - Declarada == Esperada -> Tema 69 aplicado corretamente -> SEM_DIVERGENCIA
 *
 * Achados nas 7 faturas analisadas (Sprint C2):
 *  - Leonardo, Luciano, EXFISHES (ambas), CUSD I: SEM_DIVERGENCIA (EDP aplica).
 *  - CUSD II: FAVORAVEL_AO_CLIENTE em ~R$ 248/mes (EDP excluiu a mais).
 *
 * Tema 69 stricto raramente gera indebito em faturas EDP pos-2017 -
 * mas o detector existe pra catalogar divergencias e ficar pronto pra
 * faturas retroativas (antes do julgamento) onde a maioria das
 * concessionarias NAO aplicava.
 */
@Injectable()
export class DetectorTema69Stricto implements DetectorPadraoTributario {
  readonly codigo = 'TEMA_69_STRICTO_DIVERGENCIA' as const;

  detectar(fatura: FaturaCanonica): ResultadoDeteccao {
    const t = fatura.totaisTributarios;

    // Base esperada Tema 69:
    //   sobre a porcao TRIBUTADA (baseIcms positiva sobre fornecida),
    //   exclui o ICMS dessa porcao.
    // Aqui usamos icmsCobrado (positivo) e a base ICMS positiva implicita,
    // que e o que a concessionaria efetivamente tributou. A base PIS/COFINS
    // DEVE ser essa porcao menos o ICMS.
    //
    // Soma do baseIcms positiva = soma dos rubricas com aliquotaIcms > 0
    let baseIcmsTributada = 0;
    for (const r of fatura.rubricas) {
      if (r.aliquotaIcms > 0 && r.baseCalculoIcms > 0) {
        baseIcmsTributada += r.baseCalculoIcms;
      }
    }

    const baseEsperada = baseIcmsTributada - t.icmsCobrado;
    const baseDeclarada = t.basePisCofinsDeclarada;
    const divergenciaBase = baseDeclarada - baseEsperada;

    // Tolerancia: arredondamentos centavos. Acima de R$ 1 marca divergencia.
    const TOLERANCIA = 1.0;
    if (Math.abs(divergenciaBase) < TOLERANCIA) {
      return {
        detector: this.codigo,
        padrao: null,
      };
    }

    const aliqTotal = t.aliquotaPis + t.aliquotaCofins;
    const valorAjuste = Math.abs(divergenciaBase) * aliqTotal;

    // Declarada > Esperada: cliente paga PIS/COFINS sobre base maior -> indebito
    // Declarada < Esperada: cliente paga PIS/COFINS sobre base menor -> favoravel
    const sinal =
      divergenciaBase > 0 ? 'INDEBITO_TRIBUTARIO' : 'FAVORAVEL_AO_CLIENTE';

    const valorIndebito = sinal === 'INDEBITO_TRIBUTARIO' ? valorAjuste : 0;

    return {
      detector: this.codigo,
      padrao: {
        codigo: this.codigo,
        sinal,
        valorIndebitoMensal: Math.round(valorIndebito * 100) / 100,
        valorIndebito60mSelic: projetar60mSelic(valorIndebito),
        fundamento: {
          tema: 'Tema 69 STF',
          numero: 'RE 574.706',
          ementa:
            'O ICMS nao compoe a base de calculo do PIS e da COFINS. ' +
            'Base correta = base de venda - ICMS destacado.',
          classificacaoDossie: 'T3',
          risco: 'BAIXO',
        },
        detalhe:
          `Base PIS/COFINS declarada: R$ ${baseDeclarada.toFixed(2)} | ` +
          `Base esperada Tema 69: R$ ${baseEsperada.toFixed(2)} | ` +
          `Divergencia: R$ ${divergenciaBase.toFixed(2)} | ` +
          `Aliquota PIS+COFINS efetiva: ${(aliqTotal * 100).toFixed(2)}% | ` +
          `Valor mensal calculado: R$ ${valorAjuste.toFixed(2)}`,
        rubricasEnvolvidas: fatura.rubricas
          .filter((r) => r.aliquotaIcms > 0)
          .map((r) => r.descricaoOriginal),
      },
    };
  }
}
