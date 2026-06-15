import { Injectable } from '@nestjs/common';
import type { FaturaCanonica } from '../fatura-canonica/fatura-canonica.types';
import type {
  DetectorPadraoTributario,
  ResultadoDeteccao,
} from './detectores.types';
import { projetar60mSelic } from './detectores.types';

/**
 * Tese CDE Escassez Hidrica - encargo embutido na tarifa.
 *
 * MECANISMO:
 *   Por determinacao da ANEEL (Lei 14.182/2021 + REH ANEEL 928/2021),
 *   os consumidores pagaram bandeira ESCASSEZ HIDRICA (R$ 14,20/100 kWh)
 *   entre 09/2021 e 04/2022, e ate hoje carregam encargo CDE residual
 *   embutido na tarifa.
 *
 *   A Tese argumenta que esse encargo:
 *   1. Foi instituido sem base legal solida (medida provisoria)
 *   2. Beneficia geradores termicos privados sem reciprocidade ao consumidor
 *   3. Configura tributo disfarcado em encargo setorial
 *   4. Atinge desproporcionalmente quem participa de GD (paga sem usar
 *      energia hidrica/termica - paga pela propria solar)
 *
 * APLICABILIDADE: faturas que mostram "Enc. CDE-Esc. Hidrica incluso
 * na tarifa" no quadro de "Detalhes do Faturamento" ou similar.
 * Adapter EDP_ES e CEMIG/MG normalmente listam essa informacao.
 *
 * SEM PRECEDENTE STF (08/2025 ate jul/2026 — monitorar).
 * Algumas decisoes monocraticas favoraveis em TJ-SP/TJ-RJ.
 *
 * RISCO: ALTO - tese inovadora, sem trânsito em julgado.
 *
 * STATUS: Detector marca quando encargo aparece - valor exato requer
 * extracao especifica do OCR (rubrica especifica ou nota informativa).
 * Indebito mensal e ESTIMADO em R$ 3,47/MWh consumido (media historica).
 */
@Injectable()
export class DetectorCdeEscassezHidrica implements DetectorPadraoTributario {
  readonly codigo = 'TESE_CDE_ESCASSEZ_HIDRICA' as const;

  detectar(fatura: FaturaCanonica): ResultadoDeteccao {
    // Procura por TUSD/TE fornecidas pra estimar consumo
    let kwhConsumidoBruto = 0;
    let rubricasEnergeticas: string[] = [];

    for (const r of fatura.rubricas) {
      if ((r.tipo === 'TUSD' || r.tipo === 'TE') && r.valorTotalReais > 0) {
        kwhConsumidoBruto = Math.max(kwhConsumidoBruto, r.quantidade);
        rubricasEnergeticas.push(r.descricaoOriginal);
      }
    }

    if (kwhConsumidoBruto <= 0) {
      return { detector: this.codigo, padrao: null };
    }

    // Estimativa CDE Escassez Hidrica embutido na tarifa.
    // Base ANEEL atualizada: R$ 0,00347/kWh (R$ 3,47/MWh) - referencia REH 928/2021.
    // Valor varia por concessionaria. Magnitude aproximada pra triagem.
    const RATIO_CDE_POR_KWH = 0.00347;
    const indebitoEstimado = kwhConsumidoBruto * RATIO_CDE_POR_KWH;

    const TOLERANCIA = 0.5;
    if (indebitoEstimado < TOLERANCIA) {
      return { detector: this.codigo, padrao: null };
    }

    const ementa =
      'Encargo CDE Escassez Hidrica (REH ANEEL 928/2021 c/c Lei 14.182/2021) ' +
      'foi instituido em regime de excecao (escassez hidrica 2021-22) e mantido ' +
      'embutido na tarifa apos o fim da crise. Tese argumenta: (a) ausencia de ' +
      'base legal solida para perpetuidade do encargo; (b) caracterizacao como ' +
      'tributo disfarcado de encargo setorial (violacao art. 150 II CF); ' +
      '(c) desproporcionalidade contra consumidores GD (pagam por geracao ' +
      'termica sem usar). SEM PRECEDENTE STF - tese inovadora. Recomenda-se ' +
      'aguardar consolidacao das demais antes de acionar judicialmente.';

    return {
      detector: this.codigo,
      padrao: {
        codigo: this.codigo,
        sinal: 'INDEBITO_TRIBUTARIO',
        valorIndebitoMensal: Math.round(indebitoEstimado * 100) / 100,
        valorIndebito60mSelic: projetar60mSelic(indebitoEstimado),
        fundamento: {
          tema: 'REH ANEEL 928/2021 + Lei 14.182/2021 + art. 150 II CF/88',
          numero: 'Sem precedente STF (ago/2025)',
          ementa,
          classificacaoDossie: 'T4_RETAGUARDA',
          risco: 'ALTO',
        },
        detalhe:
          `Consumo bruto estimado: ${kwhConsumidoBruto.toFixed(0)} kWh | ` +
          `Ratio CDE estimado: R$ ${(RATIO_CDE_POR_KWH * 1000).toFixed(2)}/MWh | ` +
          `Indebito mensal estimado: R$ ${indebitoEstimado.toFixed(2)} | ` +
          `60m+SELIC: R$ ${projetar60mSelic(indebitoEstimado).toFixed(2)} | ` +
          `Rubricas energeticas: ${rubricasEnergeticas.join(' / ')} | ` +
          `OBS: ESTIMATIVA pra triagem. Valor real depende da composicao tarifaria ` +
          `de cada concessionaria. Confirmar via Plano Tarifario ANEEL antes de acionar.`,
        rubricasEnvolvidas: rubricasEnergeticas,
      },
    };
  }
}
