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
 * Achado estrategico Concierge 11/06/2026: ELFSM aplica corretamente
 * (PIS/COFINS sobre SCEE com linha negativa cancelando), enquanto EDP
 * cobra sobre TUSD+TE bruta. ELFSM e PROVA CABAL de descumprimento da
 * EDP - nao mais "argumento por analogia" e sim tratamento desigual
 * sob mesma jurisdicao ES + mesma legislacao federal.
 */
@Injectable()
export class DetectorTese3PisCofinsSobreScee implements DetectorPadraoTributario {
  readonly codigo = 'TESE_3_PIS_COFINS_SOBRE_SCEE' as const;

  detectar(fatura: FaturaCanonica): ResultadoDeteccao {
    const t = fatura.totaisTributarios;
    const aliqTotal = t.aliquotaPis + t.aliquotaCofins;

    if (fatura.classificacaoScee === 'NAO_GD') {
      return { detector: this.codigo, padrao: null };
    }

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

    const baseCorreta = valorEnergeticoLiquido - icmsEnergeticoLiquido;

    // PIS+COFINS LIQUIDO sobre rubricas energeticas - soma com sinal.
    // EDP: injecao SCEE tem PIS/COFINS == 0 (so positivos contam).
    // ELFSM: injecao tem PIS/COFINS NEGATIVO cancelando o positivo.
    let pisCofinsCobradoEnergetico = 0;
    for (const r of fatura.rubricas) {
      if (r.tipo === 'TUSD' || r.tipo === 'TE' || r.tipo === 'INJECAO_SCEE') {
        pisCofinsCobradoEnergetico += r.valorPisCofins;
      }
    }

    // Patch 14/06/2026 noite — Pergunta destravadora do Luciano:
    // EDP_ES NAO distribui PIS/COFINS por rubrica (cobra agregado na
    // lateral "Reservado ao Fisco"). Se as rubricas vierem com PIS/COFINS=0
    // mas a fatura declarar `basePisCofinsDeclarada > 0`, usar a base
    // declarada x aliquota como proxy do que EDP esta efetivamente cobrando.
    // Isso pega o cenario EDP_ES sem alterar o cenario ELFSM (que distribui).
    let metodoDeteccao: 'rubricas-distribuidas' | 'base-declarada-fallback' =
      'rubricas-distribuidas';
    if (pisCofinsCobradoEnergetico <= 0 && t.basePisCofinsDeclarada > 0) {
      pisCofinsCobradoEnergetico = t.basePisCofinsDeclarada * aliqTotal;
      metodoDeteccao = 'base-declarada-fallback';
    }

    if (pisCofinsCobradoEnergetico <= 0) {
      return { detector: this.codigo, padrao: null };
    }

    const pisCofinsLegitimo = Math.max(0, baseCorreta * aliqTotal);
    const indebito = pisCofinsCobradoEnergetico - pisCofinsLegitimo;
    const TOLERANCIA = 0.5;

    if (indebito < TOLERANCIA) {
      return { detector: this.codigo, padrao: null };
    }

    const ementaCabal =
      'Energia eletrica injetada e compensada via SCEE configura ' +
      'emprestimo gratuito (Tema 986 STJ ressalva). Nao constitui ' +
      'receita da concessionaria - logo nao integra base de PIS/COFINS. ' +
      'Base correta = consumo liquido pos-compensacao (sem ICMS). ' +
      'PROVA CABAL DE DESCUMPRIMENTO (achado Concierge 11/06/2026): ' +
      'a propria EDP-ES reconhece a SCEE no ICMS (Lei GERAR 11.253/2021-ES) ' +
      'mas se recusa a fazer o mesmo no PIS/COFINS. A ELFSM (Empresa Luz e ' +
      'Forca Santa Maria), concessionaria sob a MESMA jurisdicao do ES, ' +
      'MESMA legislacao federal (Tema 69 STF, Decreto 12.068/2024, REN 1.059/2023) ' +
      'e MESMOS orgaos fiscalizadores, aplica a SCEE em AMBOS os tributos - ' +
      'traz linha de injecao com PIS/COFINS NEGATIVO cancelando o positivo do ' +
      'Consumo SCEE. Nao e argumento por analogia: e tratamento desigual sob ' +
      'mesma lei. A EDP nao tem defesa de impossibilidade tecnica nem de ' +
      'ausencia de precedente operacional - ELFSM e precedente direto no ES. ' +
      'Inverte o onus argumentativo: cabe a EDP explicar por que NAO faz o ' +
      'que a ELFSM faz.';

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
          ementa: ementaCabal,
          classificacaoDossie: 'T3',
          risco: 'MEDIO',
        },
        detalhe:
          `Metodo deteccao: ${metodoDeteccao} | ` +
          `Valor energetico bruto (TUSD+TE fornecida): R$ ${this.somarRubricas(fatura, 'TUSD', 'TE').toFixed(2)} | ` +
          `Valor energetico liquido pos-SCEE: R$ ${valorEnergeticoLiquido.toFixed(2)} | ` +
          `ICMS sobre liquido: R$ ${icmsEnergeticoLiquido.toFixed(2)} | ` +
          `Base correta (liquido sem ICMS): R$ ${baseCorreta.toFixed(2)} | ` +
          `Aliq PIS+COFINS: ${(aliqTotal * 100).toFixed(2)}% | ` +
          `PIS+COFINS legitimo: R$ ${pisCofinsLegitimo.toFixed(2)} | ` +
          `PIS+COFINS cobrado (efetivo): R$ ${pisCofinsCobradoEnergetico.toFixed(2)} | ` +
          `Indebito mensal: R$ ${indebito.toFixed(2)} | ` +
          `RATIFICACAO ELFSM: concessionaria sob mesma lei ES aplica SCEE em PIS/COFINS - ` +
          `EDP nao tem defesa de impossibilidade tecnica. Inversao de onus argumentativo.`,
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
