import { Injectable } from '@nestjs/common';
import type { FaturaCanonica } from '../fatura-canonica/fatura-canonica.types';
import type {
  DetectorPadraoTributario,
  ResultadoDeteccao,
} from './detectores.types';
import { projetar60mSelic } from './detectores.types';

/**
 * Tese Demanda Nao Utilizada - PIS/COFINS sobre rubrica sem fato gerador.
 *
 * MECANISMO:
 *   Em UCs Grupo A com modalidade tarifaria que exige Demanda Contratada
 *   (Verde/Azul), quando a demanda medida no mes e inferior a demanda
 *   contratada, a diferenca aparece na fatura como "Demanda Nao Utilizada".
 *
 *   A propria concessionaria reconhece a AUSENCIA de fato gerador zerando
 *   o ICMS sobre essa rubrica (aplicando Tema 176 STF). Mas mantem a
 *   cobranca de PIS/COFINS sobre ela.
 *
 *   A Tese argumenta: se nao houve consumo efetivo (a propria EDP admite
 *   zerando ICMS), nao ha receita auferida que componha base de PIS/COFINS.
 *   Por simetria com Tema 69 STF - a base de PIS/COFINS pressupoe fato
 *   gerador completo da operacao.
 *
 * FUNDAMENTOS:
 *   1. Tema 176 STF (ICMS sobre demanda contratada nao usada - pacificado)
 *   2. Tema 69 STF por extensao (base PIS/COFINS exige fato gerador completo)
 *   3. Art. 145, par. 1 CF/88 (capacidade contributiva)
 *   4. Art. 195, I, b CF/88 (PIS/COFINS sobre RECEITA, nao sobre cobranca virtual)
 *
 * APLICABILIDADE: Grupo A + rubrica DEMANDA_CONTRATADA + rubrica
 *                  DEMANDA_NAO_UTILIZADA simultaneas. Garante que o
 *                  cliente realmente contrata demanda (modalidade
 *                  Verde/Azul) e que houve subutilizacao no mes.
 *
 * RISCO: MEDIO-ALTO (T3 do dossie). Tese inovadora especificamente em
 * PIS/COFINS - jurisprudencia consolidada e em ICMS (Tema 176). Argumento
 * por extensao tem sido aceito em TJ-SP e TJ-MG. Risco maior em STJ/STF.
 *
 * STATUS: Implementado em 15/06/2026 apos auditoria do Consorcio Sinergia
 * Ambiental (R$ 14,73/mes de PIS/COFINS sobre R$ 418,33 de Demanda Nao
 * Utilizada - 12,64 kW de 30 kW contratados).
 */
@Injectable()
export class DetectorDemandaNaoUtilizada implements DetectorPadraoTributario {
  readonly codigo = 'TESE_DEMANDA_NAO_UTILIZADA' as const;

  detectar(fatura: FaturaCanonica): ResultadoDeteccao {
    // Filtro 1: apenas Grupo A (Grupo B nao contrata demanda)
    if (fatura.grupoTarifario !== 'A') {
      return { detector: this.codigo, padrao: null };
    }

    // Filtro 2: precisa ter Demanda Contratada na fatura (= contrato real
    // de demanda, modalidade Verde/Azul). Sem isso, nao ha base pra tese.
    const temDemandaContratada = fatura.rubricas.some(
      (r) => r.tipo === 'DEMANDA_CONTRATADA',
    );
    if (!temDemandaContratada) {
      return { detector: this.codigo, padrao: null };
    }

    // Filtro 3: precisa ter rubrica DEMANDA_NAO_UTILIZADA. So a aparicao
    // confirma que houve subutilizacao + cobranca penalizante.
    let pisCofinsAcumulado = 0;
    let valorBaseAcumulado = 0;
    let kwAcumulado = 0;
    const rubricasEnvolvidas = new Set<string>();

    for (const r of fatura.rubricas) {
      if (r.tipo === 'DEMANDA_NAO_UTILIZADA') {
        pisCofinsAcumulado += r.valorPisCofins;
        valorBaseAcumulado += r.valorTotalReais;
        kwAcumulado += r.quantidade;
        rubricasEnvolvidas.add(r.descricaoOriginal);
      }
    }

    if (rubricasEnvolvidas.size === 0) {
      return { detector: this.codigo, padrao: null };
    }

    // Tolerancia: indebito tem que ser efetivamente cobrado
    const TOLERANCIA = 0.5;
    if (pisCofinsAcumulado < TOLERANCIA) {
      return { detector: this.codigo, padrao: null };
    }

    const ementa =
      'A propria EDP-ES reconhece a AUSENCIA de fato gerador na rubrica ' +
      '"Demanda Nao Utilizada" ao aplicar ICMS = 0 sobre ela (cumprindo Tema 176 STF). ' +
      'Por simetria juridica e logica do art. 195, I, "b" da CF/88, tambem nao ha ' +
      'RECEITA auferida que componha a base de PIS/COFINS sobre essa parcela. ' +
      'Cobrar PIS/COFINS sobre demanda contratada mas nao consumida configura ' +
      'extrapolacao do fato gerador tributario (art. 145, par. 1 CF). Aplica-se ' +
      'por extensao o Tema 69 STF: PIS/COFINS pressupoe receita real, nao cobranca ' +
      'virtual sobre kW nao medidos. Indebito recuperavel via repeticao de ' +
      'indebito (art. 165 CTN), prescricao 5 anos.';

    return {
      detector: this.codigo,
      padrao: {
        codigo: this.codigo,
        sinal: 'INDEBITO_TRIBUTARIO',
        valorIndebitoMensal: Math.round(pisCofinsAcumulado * 100) / 100,
        valorIndebito60mSelic: projetar60mSelic(pisCofinsAcumulado),
        fundamento: {
          tema: 'Tema 69 STF + Tema 176 STF por extensao + art. 195 CF/88',
          numero: 'RE 574.706 + RE 593.824',
          ementa,
          classificacaoDossie: 'T3',
          risco: 'MEDIO',
        },
        detalhe:
          `Grupo tarifario: ${fatura.grupoTarifario}/${fatura.subgrupo} | ` +
          `Modalidade: ${fatura.modalidadeTarifaria} | ` +
          `Demanda nao utilizada: ${kwAcumulado.toFixed(2)} kW | ` +
          `Valor base cobrado: R$ ${valorBaseAcumulado.toFixed(2)} | ` +
          `PIS+COFINS cobrado sobre demanda nao utilizada: R$ ${pisCofinsAcumulado.toFixed(2)} | ` +
          `60m+SELIC (1.25x): R$ ${projetar60mSelic(pisCofinsAcumulado).toFixed(2)} | ` +
          `Rubricas: ${Array.from(rubricasEnvolvidas).join(' / ')} | ` +
          `OBS: A propria EDP-ES aplica ICMS=0 nesta rubrica (cumpre Tema 176). ` +
          `Argumento simetrico: se ICMS nao incide por ausencia de fato gerador, ` +
          `PIS/COFINS tambem nao pode incidir sobre a mesma base.`,
        rubricasEnvolvidas: Array.from(rubricasEnvolvidas),
      },
    };
  }
}
