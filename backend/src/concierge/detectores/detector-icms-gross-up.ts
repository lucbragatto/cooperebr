import { Injectable } from '@nestjs/common';
import type { FaturaCanonica } from '../fatura-canonica/fatura-canonica.types';
import type {
  DetectorPadraoTributario,
  ResultadoDeteccao,
} from './detectores.types';
import { projetar60mSelic } from './detectores.types';

/**
 * Tese ICMS Base Gross-Up - assimetria do calculo "por dentro".
 *
 * MECANISMO:
 *   ICMS no Brasil e calculado "por dentro" - a base inclui o proprio
 *   ICMS:  base = preco_liquido / (1 - aliq_icms)
 *
 *   Para aliq 17% (ES):
 *     - Tarifa base ANEEL: R$ 0,46863/kWh
 *     - Tarifa c/ tributos: R$ 0,46863 / (1 - 0,17) = R$ 0,56462... aproximadamente
 *     - Mas faturas EDP_ES mostram: R$ 0,59596/kWh - DIFERENCA de R$ 0,03/kWh
 *
 *   Essa diferenca representa gross-up sobre PIS+COFINS tambem,
 *   resultando em alíquota efetiva > 17%. A Tese argumenta que o
 *   gross-up adicional excede o que a Constituicao permite.
 *
 * APLICABILIDADE: faturas com tarifa_com_tributos > 1.21 x tarifa_base
 * (indicando gross-up acima do esperado pra ICMS 17%).
 *
 * RISCO: ALTO - tese tecnica complexa, sem precedente STF direto.
 * Argumento mais forte como SOMA com Tema 69 (que ja eliminou ICMS
 * da base PIS/COFINS).
 *
 * STATUS: Detector marca quando gross-up excede 25% (heuristica
 * triagem). Calculo exato do indebito requer analise por rubrica.
 */
@Injectable()
export class DetectorIcmsGrossUp implements DetectorPadraoTributario {
  readonly codigo = 'TESE_ICMS_GROSS_UP' as const;

  detectar(fatura: FaturaCanonica): ResultadoDeteccao {
    const aliqIcms = fatura.totaisTributarios.aliquotaIcms;
    if (aliqIcms <= 0) {
      return { detector: this.codigo, padrao: null };
    }

    // Calcula gross-up real por rubrica TUSD/TE fornecida
    let grossUpAcumulado = 0;
    let valorBaseAcumulado = 0;
    let qtdRubricasGrossUp = 0;
    const exemplos: string[] = [];

    for (const r of fatura.rubricas) {
      if ((r.tipo === 'TUSD' || r.tipo === 'TE') && r.valorTotalReais > 0) {
        if (r.tarifaUnitariaBase > 0 && r.precoUnitarioComTributos > 0) {
          // Gross-up esperado APENAS pra ICMS: tarifa / (1 - aliq)
          const grossUpEsperado = r.tarifaUnitariaBase / (1 - aliqIcms);
          const grossUpReal = r.precoUnitarioComTributos;
          const excedente = grossUpReal - grossUpEsperado;

          if (excedente > 0 && r.quantidade > 0) {
            const indebitoRubrica = excedente * r.quantidade;
            grossUpAcumulado += indebitoRubrica;
            valorBaseAcumulado += r.valorTotalReais;
            qtdRubricasGrossUp++;
            if (exemplos.length < 3) {
              exemplos.push(
                `${r.descricaoOriginal} (gross-up real ${(grossUpReal / r.tarifaUnitariaBase * 100).toFixed(1)}% vs esperado ${((1 / (1 - aliqIcms) - 1) * 100).toFixed(1)}%)`,
              );
            }
          }
        }
      }
    }

    const TOLERANCIA = 5.0;
    if (grossUpAcumulado < TOLERANCIA) {
      return { detector: this.codigo, padrao: null };
    }

    // Aplica aliq ICMS sobre o excedente do gross-up — esse e o indebito real
    const indebito = grossUpAcumulado * aliqIcms;

    const ementa =
      'O ICMS calculado "por dentro" (art. 13 par. 1 LC 87/96) sobre rubricas ' +
      'energeticas considera no gross-up nao apenas a aliquota nominal de ICMS, ' +
      'mas tambem PIS+COFINS. Isso amplifica a base de calculo do ICMS sobre ' +
      'tributos federais que nao deveriam compor o fato gerador estadual ' +
      '(violacao indireta do Tema 69 STF). A diferenca entre o gross-up real ' +
      '(observado na coluna "Preco c/ Tributos" da fatura) e o gross-up matematico ' +
      'esperado (tarifa base / (1 - aliq_ICMS)) configura ICMS pago em excesso. ' +
      'Tese tecnica, complementar a Tema 69 e a tema da modulacao de efeitos.';

    return {
      detector: this.codigo,
      padrao: {
        codigo: this.codigo,
        sinal: 'INDEBITO_TRIBUTARIO',
        valorIndebitoMensal: Math.round(indebito * 100) / 100,
        valorIndebito60mSelic: projetar60mSelic(indebito),
        fundamento: {
          tema: 'Art. 13 par. 1 LC 87/96 (Kandir) c/c Tema 69 STF',
          numero: 'Argumento extensivo do Tema 69',
          ementa,
          classificacaoDossie: 'T4_RETAGUARDA',
          risco: 'ALTO',
        },
        detalhe:
          `Aliq ICMS: ${(aliqIcms * 100).toFixed(2)}% | ` +
          `Gross-up matematico esperado: ${((1 / (1 - aliqIcms) - 1) * 100).toFixed(2)}% | ` +
          `Rubricas com gross-up excedente: ${qtdRubricasGrossUp} | ` +
          `Valor base afetado: R$ ${valorBaseAcumulado.toFixed(2)} | ` +
          `Excedente acumulado de tarifa: R$ ${grossUpAcumulado.toFixed(2)} | ` +
          `Indebito ICMS estimado: R$ ${indebito.toFixed(2)} | ` +
          `60m+SELIC: R$ ${projetar60mSelic(indebito).toFixed(2)} | ` +
          `Exemplos: ${exemplos.join(' / ')} | ` +
          `OBS: tese tecnica complementar - usar SOMADA a Tema 69, nao isolada.`,
        rubricasEnvolvidas: exemplos,
      },
    };
  }
}
