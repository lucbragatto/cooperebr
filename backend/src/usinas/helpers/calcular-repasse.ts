/**
 * Sub-Sprint F Sessao 1 MVP+ Etapa C (M30, 2026-05-26).
 *
 * Helper puro de calculo do repasse mensal pro proprietario (dono) da usina.
 * SUBSTITUI o R$ 0,50/kWh hardcoded que estava em
 * UsinasService.proprietarioDashboard.
 *
 * Regras conforme Mini-Bloco H'.9 (17/05) + Caminho B do Sub-Sprint F:
 *
 *   FIXO        => retorna valorAluguelFixo (independe de geracao)
 *   PERCENTUAL  => kwhGerado * tarifaKwh * percentualGeracaoDono/100
 *                   onde tarifaKwh = usina.valorKwhPadrao (override usina)
 *                              ?? tarifaResolver(distribuidora, anoMes)  (fallback)
 *                              ?? erro tipado FONTE_TARIFA_AUSENTE
 *   HIBRIDO     => valorAluguelFixo + calculo PERCENTUAL acima
 *   null/auto   => retorna valor=null com motivo 'forma_pagamento_dono_nao_definida'
 *
 * NUNCA usa valor hardcoded. Quando faltam dados, retorna { valor: null, motivo }
 * com explicacao clara — caller decide se mostra "previsto: a definir" na UI.
 *
 * Decisao Luciano 27/05: tarifaKwh = TUSD + TE (soma) da TarifaConcessionaria
 * vigente — mesma logica usada por RelatoriosService.projecaoReceita.
 */

import { FormaPagamentoDono } from '@prisma/client';

export interface UsinaParaCalculo {
  formaPagamentoDono: FormaPagamentoDono | null;
  valorAluguelFixo: number | null; // Decimal -> number (Prisma Decimal.toNumber)
  percentualGeracaoDono: number | null;
  valorKwhPadrao: number | null;
  distribuidora: string | null;
}

export interface GeracaoMesParaCalculo {
  kwhGerado: number;
  competencia: Date;
}

/**
 * Resolver de tarifa por distribuidora e mes. Retorna o R$/kWh combinado
 * (TUSD + TE) vigente naquela data. Null se nao houver tarifa cadastrada.
 *
 * Implementacao real consulta `prisma.tarifaConcessionaria` ordenada por
 * dataVigencia desc, filtrando por nome de concessionaria normalizado.
 */
export type TarifaResolver = (
  distribuidora: string | null,
  competencia: Date,
) => Promise<number | null> | number | null;

export type FonteTarifa =
  | 'usina_override'
  | 'tarifa_concessionaria'
  | 'ausente';

export interface ResultadoCalculoRepasse {
  valor: number | null;
  formula: string;
  fonteTarifa: FonteTarifa | null;
  motivo?: string;
  detalhes?: {
    kwhGerado?: number;
    tarifaKwh?: number;
    percentual?: number;
    valorFixo?: number;
  };
}

/**
 * Arredonda valor monetario pra 2 casas (padrao CLAUDE.md financeiro).
 */
function arredondar(valor: number): number {
  return Math.round(valor * 100) / 100;
}

export async function calcularRepasse(
  usina: UsinaParaCalculo,
  geracaoMes: GeracaoMesParaCalculo | null,
  tarifaResolver: TarifaResolver,
): Promise<ResultadoCalculoRepasse> {
  // Caso 1: formaPagamentoDono nao definido
  if (!usina.formaPagamentoDono) {
    return {
      valor: null,
      formula: 'forma_pagamento_dono_nao_definida',
      fonteTarifa: null,
      motivo:
        'formaPagamentoDono nao cadastrado na usina. Definir via /dashboard/usinas/[id]/editar.',
    };
  }

  // Caso 2: FIXO — so depende de valorAluguelFixo
  if (usina.formaPagamentoDono === 'FIXO') {
    if (
      usina.valorAluguelFixo === null ||
      usina.valorAluguelFixo === undefined
    ) {
      return {
        valor: null,
        formula: 'FIXO sem valor cadastrado',
        fonteTarifa: null,
        motivo: 'valorAluguelFixo obrigatorio quando formaPagamentoDono=FIXO.',
      };
    }
    return {
      valor: arredondar(usina.valorAluguelFixo),
      formula: 'FIXO',
      fonteTarifa: null,
      detalhes: { valorFixo: usina.valorAluguelFixo },
    };
  }

  // Casos 3 e 4: PERCENTUAL ou HIBRIDO — precisam de geracao + tarifa + pct
  if (
    usina.formaPagamentoDono === 'PERCENTUAL' ||
    usina.formaPagamentoDono === 'HIBRIDO'
  ) {
    if (!geracaoMes || geracaoMes.kwhGerado <= 0) {
      return {
        valor: null,
        formula: `${usina.formaPagamentoDono} sem geracao registrada`,
        fonteTarifa: null,
        motivo:
          'Geracao mensal nao registrada — sem kWh nao da pra calcular o componente PERCENTUAL.',
      };
    }

    if (
      usina.percentualGeracaoDono === null ||
      usina.percentualGeracaoDono === undefined
    ) {
      return {
        valor: null,
        formula: `${usina.formaPagamentoDono} sem percentual cadastrado`,
        fonteTarifa: null,
        motivo:
          'percentualGeracaoDono obrigatorio quando formaPagamentoDono inclui PERCENTUAL.',
      };
    }

    // Resolver tarifa R$/kWh: override usina vs fallback distribuidora
    let tarifaKwh: number | null = null;
    let fonteTarifa: FonteTarifa = 'ausente';

    if (
      usina.valorKwhPadrao !== null &&
      usina.valorKwhPadrao !== undefined &&
      usina.valorKwhPadrao > 0
    ) {
      tarifaKwh = usina.valorKwhPadrao;
      fonteTarifa = 'usina_override';
    } else {
      const fromResolver = await tarifaResolver(
        usina.distribuidora,
        geracaoMes.competencia,
      );
      if (fromResolver !== null && fromResolver > 0) {
        tarifaKwh = fromResolver;
        fonteTarifa = 'tarifa_concessionaria';
      }
    }

    if (tarifaKwh === null) {
      return {
        valor: null,
        formula: `${usina.formaPagamentoDono} sem tarifa de referencia`,
        fonteTarifa: 'ausente',
        motivo:
          `Tarifa R$/kWh nao encontrada — defina usina.valorKwhPadrao OU cadastre ` +
          `TarifaConcessionaria pra distribuidora "${usina.distribuidora}".`,
      };
    }

    const valorPercentual =
      geracaoMes.kwhGerado *
      tarifaKwh *
      (usina.percentualGeracaoDono / 100);

    if (usina.formaPagamentoDono === 'PERCENTUAL') {
      return {
        valor: arredondar(valorPercentual),
        formula: 'PERCENTUAL: kwh * tarifaKwh * pct/100',
        fonteTarifa,
        detalhes: {
          kwhGerado: geracaoMes.kwhGerado,
          tarifaKwh,
          percentual: usina.percentualGeracaoDono,
        },
      };
    }

    // HIBRIDO: soma o fixo
    const valorFixo = usina.valorAluguelFixo ?? 0;
    if (valorFixo <= 0) {
      return {
        valor: null,
        formula: 'HIBRIDO sem valor fixo cadastrado',
        fonteTarifa,
        motivo:
          'formaPagamentoDono=HIBRIDO exige valorAluguelFixo > 0 ALEM do percentual.',
      };
    }

    return {
      valor: arredondar(valorFixo + valorPercentual),
      formula: 'HIBRIDO: valorAluguelFixo + (kwh * tarifaKwh * pct/100)',
      fonteTarifa,
      detalhes: {
        valorFixo,
        kwhGerado: geracaoMes.kwhGerado,
        tarifaKwh,
        percentual: usina.percentualGeracaoDono,
      },
    };
  }

  // Defesa: enum exaustivo
  return {
    valor: null,
    formula: `formaPagamentoDono desconhecida: ${String(usina.formaPagamentoDono)}`,
    fonteTarifa: null,
    motivo: 'Tipo de pagamento nao tratado pelo helper.',
  };
}
