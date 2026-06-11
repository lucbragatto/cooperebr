import { Injectable } from '@nestjs/common';
import type { FaturaCanonica } from '../fatura-canonica/fatura-canonica.types';
import type {
  DetectorPadraoTributario,
  ResultadoDeteccao,
} from './detectores.types';
import { projetar60mSelic } from './detectores.types';

/**
 * Tese 2 do dossie CoopereBR - ICMS sobre TUSD-G e demanda/encargos.
 *
 * Fundamento: demanda != consumo (Sumula 391 STJ) + Tema 176 STF
 * (TUSD na geracao nao tem fato gerador de ICMS) + Lei GERAR/ES 11.253/2021
 * paragrafo 3 art. 5-D (exclui da isencao demanda/disponibilidade/encargos,
 * mas argumento da Tese 4 retaguarda diz que essas rubricas nem sequer
 * tem fato gerador constitucional de ICMS).
 *
 * Detector soma ICMS sobre rubricas:
 *   - TUSD_G (Demanda Geracao - principal indebito em usinas)
 *   - DEMANDA_CONTRATADA
 *   - DEMANDA_ULTRAPASSAGEM
 *   - DEMANDA_REATIVA_EXC (DRE)
 *   - ENERGIA_REATIVA_EXC (ERE)
 *
 * Achados nas 7 faturas:
 *  - Leonardo, Luciano (residenciais B1): R$ 0 (sem essas rubricas).
 *  - EXFISHES (B3 cooperada): R$ 0 (modalidade convencional sem demanda).
 *  - CUSD CoopereBR I (A4 usina): R$ 2.732,24/mes (R$ 2.661 so TUSD-G + DRE + ERE).
 *  - CUSD CoopereBR II (A4 usina+UC): R$ 2.868,00/mes (TUSD-G + Demanda + Ultrap + DRE + ERE).
 *
 * Em 60m + SELIC pra CoopereBR: ~R$ 400-450k apenas dessa tese.
 */
@Injectable()
export class DetectorTese2IcmsTusdGeracao implements DetectorPadraoTributario {
  readonly codigo = 'TESE_2_ICMS_TUSD_GERACAO' as const;

  detectar(fatura: FaturaCanonica): ResultadoDeteccao {
    const tiposAlvo = new Set([
      'TUSD_G',
      'DEMANDA_CONTRATADA',
      'DEMANDA_ULTRAPASSAGEM',
      'DEMANDA_REATIVA_EXC',
      'ENERGIA_REATIVA_EXC',
    ]);

    let icmsSomado = 0;
    const rubricasEnvolvidas: string[] = [];
    const detalhesPorTipo: Record<string, number> = {};

    for (const r of fatura.rubricas) {
      if (tiposAlvo.has(r.tipo) && r.valorIcms > 0) {
        icmsSomado += r.valorIcms;
        rubricasEnvolvidas.push(r.descricaoOriginal);
        detalhesPorTipo[r.tipo] = (detalhesPorTipo[r.tipo] ?? 0) + r.valorIcms;
      }
    }

    const TOLERANCIA = 1.0;
    if (icmsSomado < TOLERANCIA) {
      return { detector: this.codigo, padrao: null };
    }

    // Compoe detalhe textual por tipo de rubrica.
    const breakdown = Object.entries(detalhesPorTipo)
      .map(([tipo, v]) => `${tipo}: R$ ${v.toFixed(2)}`)
      .join(' | ');

    return {
      detector: this.codigo,
      padrao: {
        codigo: this.codigo,
        sinal: 'INDEBITO_TRIBUTARIO',
        valorIndebitoMensal: Math.round(icmsSomado * 100) / 100,
        valorIndebito60mSelic: projetar60mSelic(icmsSomado),
        fundamento: {
          tema: 'Tema 176 STF + Sumula 391 STJ + Lei 11.253/2021-ES (GERAR §3 art. 5-D)',
          numero: 'RE 1.041.816 (Tema 176)',
          ementa:
            'ICMS nao incide sobre TUSD na ponta geradora (Tema 176 STF) ' +
            'nem sobre demanda contratada (Sumula 391 STJ - demanda nao e consumo). ' +
            'Encargos reativos (DRE/ERE) e ultrapassagem seguem mesma logica ' +
            '(nao ha circulacao de mercadoria). Lei GERAR paragrafo 3 art. 5-D ' +
            'tenta excluir essas rubricas da isencao SCEE, mas Tese 4 ' +
            'argui inconstitucionalidade material.',
          classificacaoDossie: 'T2',
          risco: 'BAIXO',
        },
        detalhe:
          `ICMS total sobre rubricas-alvo: R$ ${icmsSomado.toFixed(2)} | ` +
          `Breakdown: ${breakdown}`,
        rubricasEnvolvidas,
      },
    };
  }
}
