import { Injectable } from '@nestjs/common';
import type { FaturaCanonica } from '../fatura-canonica/fatura-canonica.types';
import type {
  DetectorPadraoTributario,
  ResultadoDeteccao,
} from './detectores.types';
import { projetar60mSelic } from './detectores.types';

/**
 * Tese 4 do dossie CoopereBR - Lei GERAR (rubricas excluidas da base ICMS).
 *
 * Lei GERAR 11.253/2021-ES, art. 3 paragrafo unico, exclui da base de
 * calculo do ICMS as rubricas que NAO representam consumo efetivo de
 * energia eletrica:
 *   - DRE (Demanda Reativa Excedente)
 *   - ERE (Energia Reativa Excedente)
 *   - Demanda Ultrapassagem
 *
 * Sao penalidades por mau uso da rede - nao "venda de mercadoria".
 * Convenio CONFAZ 16/2015 ratifica tratamento isencional.
 *
 * APLICABILIDADE: APENAS Grupo A com geracao distribuida (rubrica TUSD_G
 * presente). Refinamento 14/06/2026 (apontado por Luciano):
 * a Lei GERAR ES tem foco em UCs GERADORAS - aplicar a consumidores
 * Grupo A genericos (industria, mineracao sem GD) seria interpretacao
 * extensiva indevida da norma estadual. Detector exige `tipo === TUSD_G`
 * em alguma rubrica como sinal claro de UC geradora.
 *
 * RISCO: ALTO (T4 RETAGUARDA do dossie).
 *  - Lei GERAR foi renovada e esta vigente em 2026
 *  - Mas Fazenda ES tem historico de questionamento
 *  - Recomendacao: ajuizar apos consolidacao primaria das outras teses
 *
 * MAGNITUDE OBSERVADA (faturas reais 14/06/2026):
 *  - CUSD CooperBR II: R$ 236,02/mes (DRE R$ 60,73 + ERE R$ 114,56 + Ultrap R$ 60,73)
 *  - CUSD CooperBR I:  R$ 70,93/mes (DRE R$ 43,49 + ERE R$ 27,44)
 */
@Injectable()
export class DetectorTese4Gerar implements DetectorPadraoTributario {
  readonly codigo = 'TESE_4_ICMS_RUBRICAS_EXCLUIDAS_GERAR' as const;

  detectar(fatura: FaturaCanonica): ResultadoDeteccao {
    // Apenas Grupo A — Grupo B nao tem DRE/ERE/Ultrapassagem
    if (fatura.grupoTarifario !== 'A') {
      return { detector: this.codigo, padrao: null };
    }

    // Refinamento 14/06/2026 noite (apontado por Luciano):
    // Lei GERAR ES 11.253/2021 aplica especificamente a UCs GERADORAS
    // (usinas), nao a consumidores Grupo A genericos. Filtro: a UC
    // precisa ter rubrica TUSD_G (Demanda Geracao) = sinal claro
    // de que e uma usina injetando na rede.
    const ehUsina = fatura.rubricas.some((r) => r.tipo === 'TUSD_G');
    if (!ehUsina) {
      return { detector: this.codigo, padrao: null };
    }

    let icmsAcumulado = 0;
    let valorBaseAcumulado = 0;
    const rubricasEnvolvidas = new Set<string>();

    for (const r of fatura.rubricas) {
      if (
        r.tipo === 'DEMANDA_REATIVA_EXC' ||
        r.tipo === 'ENERGIA_REATIVA_EXC' ||
        r.tipo === 'DEMANDA_ULTRAPASSAGEM'
      ) {
        icmsAcumulado += r.valorIcms;
        valorBaseAcumulado += r.valorTotalReais;
        rubricasEnvolvidas.add(r.descricaoOriginal);
      }
    }

    const TOLERANCIA = 0.5;
    if (icmsAcumulado < TOLERANCIA) {
      return { detector: this.codigo, padrao: null };
    }

    const ementa =
      'Lei GERAR (11.253/2021-ES) art. 3 paragrafo unico, c/c Convenio CONFAZ 16/2015, ' +
      'excluem da base de calculo do ICMS as rubricas Demanda Reativa Excedente (DRE), ' +
      'Energia Reativa Excedente (ERE) e Demanda Ultrapassagem. Tais rubricas configuram ' +
      'PENALIDADE por mau uso da rede de distribuicao - NAO ha "circulacao de mercadoria" ' +
      '(art. 155, II, CF/88). A base de calculo do ICMS sobre essas rubricas configura ' +
      'extrapolacao do fato gerador. Indebito recuperavel via repeticao de indebito ' +
      'tributario (art. 165 CTN), prescricao 5 anos.';

    return {
      detector: this.codigo,
      padrao: {
        codigo: this.codigo,
        sinal: 'INDEBITO_TRIBUTARIO',
        valorIndebitoMensal: Math.round(icmsAcumulado * 100) / 100,
        valorIndebito60mSelic: projetar60mSelic(icmsAcumulado),
        fundamento: {
          tema: 'Lei GERAR 11.253/2021-ES + Convenio CONFAZ 16/2015',
          numero: 'Lei estadual ES 11.253/2021 art. 3 PU',
          ementa,
          classificacaoDossie: 'T4_RETAGUARDA',
          risco: 'ALTO',
        },
        detalhe:
          `Grupo tarifario: ${fatura.grupoTarifario}/${fatura.subgrupo} | ` +
          `Valor rubricas penalizantes (DRE+ERE+Ultrap): R$ ${valorBaseAcumulado.toFixed(2)} | ` +
          `Aliq ICMS: ${(fatura.totaisTributarios.aliquotaIcms * 100).toFixed(2)}% | ` +
          `ICMS cobrado indevidamente: R$ ${icmsAcumulado.toFixed(2)} | ` +
          `Rubricas: ${Array.from(rubricasEnvolvidas).join(' / ')} | ` +
          `Indebito mensal: R$ ${icmsAcumulado.toFixed(2)} | ` +
          `60m+SELIC (1.25x): R$ ${projetar60mSelic(icmsAcumulado).toFixed(2)} | ` +
          `OBS: Tese T4 RETAGUARDA - acionar apos consolidacao das Teses 2/3/6 primarias.`,
        rubricasEnvolvidas: Array.from(rubricasEnvolvidas),
      },
    };
  }
}
