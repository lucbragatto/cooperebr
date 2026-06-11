import { Injectable } from '@nestjs/common';
import type { FaturaCanonica } from '../fatura-canonica/fatura-canonica.types';
import type {
  DetectorPadraoTributario,
  ResultadoDeteccao,
} from './detectores.types';
import { projetar60mSelic } from './detectores.types';

/**
 * Tese 3 do dossie CoopereBR - PIS/COFINS sobre SCEE.
 *
 * Fundamento: energia compensada via SCEE != receita. E "emprestimo
 * gratuito" do cooperado pra distribuidora (kWh injetado e devolvido).
 * Logo nao deve compor base de PIS/COFINS - apenas o CONSUMO LIQUIDO
 * (pos-compensacao) e fato gerador. Aplicacao por analogia ao Tema 69.
 *
 * EDP/Energisa cobram PIS/COFINS sobre TUSD+TE FORNECIDA BRUTA (sem
 * descontar injecao). Detector recalcula:
 *   - base correta = (TUSD+TE liquido pos-SCEE) - ICMS liquido
 *   - PIS/COFINS legitimo = base correta * (aliqPis + aliqCofins)
 *   - indebito = PIS/COFINS cobrado - PIS/COFINS legitimo
 *
 * Achados nas 7 faturas:
 *  - Leonardo (cativo sem SCEE): R$ 0 (tese nao aplica).
 *  - Luciano (B1 GD): ~R$ 49,91/mes em conta de R$ 184 (27%).
 *  - EXFISHES MAR/26 antes GDIII: ~R$ 3.611/mes em conta de R$ 3.997 (90%!).
 *  - EXFISHES ABR/26 GDIII: ~R$ 2.515/mes em conta de R$ 32.486 (7,7%).
 *  - CUSD I/II (usina): proximo de R$ 0 (TUSD/TE cancelam com injecao).
 */
@Injectable()
export class DetectorTese3PisCofinsSobreScee implements DetectorPadraoTributario {
  readonly codigo = 'TESE_3_PIS_COFINS_SOBRE_SCEE' as const;

  detectar(fatura: FaturaCanonica): ResultadoDeteccao {
    const t = fatura.totaisTributarios;
    const aliqTotal = t.aliquotaPis + t.aliquotaCofins;

    // Sem GD - tese nao aplica.
    if (fatura.classificacaoScee === 'NAO_GD') {
      return { detector: this.codigo, padrao: null };
    }

    // Calcula valor liquido das rubricas energeticas pos-SCEE.
    // Soma TUSD + TE positivas (fornecida) com TUSD + TE negativas (injecao).
    let valorEnergeticoLiquido = 0;
    let icmsEnergeticoLiquido = 0;
    const rubricasEnergeticas = new Set<string>();

    for (const r of fatura.rubricas) {
      if (r.tipo === 'TUSD' || r.tipo === 'TE' || r.tipo === 'INJECAO_SCEE') {
        valorEnergeticoLiquido += r.valorTotalReais;
        icmsEnergeticoLiquido += r.valorIcms;
        rubricasEnergeticas.add(r.descricaoOriginal);
      }
    }

    // Base correta sob Tese 3 = valor liquido SCEE menos ICMS liquido.
    const baseCorreta = valorEnergeticoLiquido - icmsEnergeticoLiquido;

    // Quanto a concessionaria cobrou de PIS+COFINS sobre rubricas energeticas
    // (so as positivas - INJECAO_SCEE nesta faturas vem com PIS/COFINS == 0).
    let pisCofinsCobradoEnergetico = 0;
    for (const r of fatura.rubricas) {
      if ((r.tipo === 'TUSD' || r.tipo === 'TE') && r.valorPisCofins > 0) {
        pisCofinsCobradoEnergetico += r.valorPisCofins;
      }
    }

    if (pisCofinsCobradoEnergetico <= 0) {
      // Sem PIS/COFINS sobre energetico - sem indebito tese 3.
      return { detector: this.codigo, padrao: null };
    }

    // PIS/COFINS que SERIA legitimo se a base fosse liquida.
    const pisCofinsLegitimo = Math.max(0, baseCorreta * aliqTotal);

    const indebito = pisCofinsCobradoEnergetico - pisCofinsLegitimo;
    const TOLERANCIA = 0.5;

    if (indebito < TOLERANCIA) {
      return { detector: this.codigo, padrao: null };
    }

    return {
      detector: this.codigo,
      padrao: {
        codigo: this.codigo,
        sinal: 'INDEBITO_TRIBUTARIO',
        valorIndebitoMensal: Math.round(indebito * 100) / 100,
        valorIndebito60mSelic: projetar60mSelic(indebito),
        fundamento: {
          tema: 'Tema 69 STF por analogia + Tema 986 STJ (ressalva SCEE)',
          numero: 'RE 574.706 + REsp 1.677.524',
          ementa:
            'Energia eletrica injetada e compensada via SCEE configura ' +
            'emprestimo gratuito (Tema 986 STJ ressalva). Nao constitui ' +
            'receita da concessionaria - logo nao integra base de PIS/COFINS. ' +
            'Base correta = consumo liquido pos-compensacao (sem ICMS).',
          classificacaoDossie: 'T3',
          risco: 'MEDIO',
        },
        detalhe:
          `Valor energetico bruto (TUSD+TE fornecida): R$ ${(valorEnergeticoLiquido - valorEnergeticoLiquido + this.somarRubricas(fatura, 'TUSD', 'TE')).toFixed(2)} | ` +
          `Valor energetico liquido pos-SCEE: R$ ${valorEnergeticoLiquido.toFixed(2)} | ` +
          `ICMS sobre liquido: R$ ${icmsEnergeticoLiquido.toFixed(2)} | ` +
          `Base correta (liquido sem ICMS): R$ ${baseCorreta.toFixed(2)} | ` +
          `Aliq PIS+COFINS: ${(aliqTotal * 100).toFixed(2)}% | ` +
          `PIS+COFINS legitimo: R$ ${pisCofinsLegitimo.toFixed(2)} | ` +
          `PIS+COFINS cobrado sobre energetico: R$ ${pisCofinsCobradoEnergetico.toFixed(2)} | ` +
          `Indebito mensal: R$ ${indebito.toFixed(2)}`,
        rubricasEnvolvidas: Array.from(rubricasEnergeticas),
      },
    };
  }

  private somarRubricas(
    fatura: FaturaCanonica,
    ...tipos: Array<'TUSD' | 'TE'>
  ): number {
    let soma = 0;
    for (const r of fatura.rubricas) {
      if (tipos.includes(r.tipo as 'TUSD' | 'TE') && r.valorTotalReais > 0) {
        soma += r.valorTotalReais;
      }
    }
    return soma;
  }
}
