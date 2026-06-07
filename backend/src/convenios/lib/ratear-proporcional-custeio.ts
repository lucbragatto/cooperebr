/**
 * Sprint Onboarding Bloco 2 Fatia 2.2 (07/06/2026) — helper puro de rateio
 * PROPORCIONAL_CONSUMO pra custeio de convênio.
 *
 * Função pura (sem I/O): recebe total + pesos, devolve parcelas + modo.
 * Reusa a fórmula consagrada de `condominios.calcularRateio:PROPORCIONAL_CONSUMO`
 * (porte direto), com **um reforço crítico**: a soma das parcelas fecha EXATAMENTE
 * com o total — o último item absorve a diferença de arredondamento de centavo.
 *
 * Sem isso, `Math.round` por item pode comer (ou criar) R$0,01 e a soma das
 * parcelas da fatura da empresa diverge do total cobrado.
 *
 * Modos:
 *  - 'PROPORCIONAL': soma dos pesos > 0 → fórmula consumo/total
 *  - 'IGUALITARIO_FALLBACK': soma dos pesos = 0 → distribui igualmente
 *    (caller pode mostrar warning UI tipo "rateio aproximado, sem cota capturada").
 *
 * Genérico: funciona pra kWh, R$, ou qualquer grandeza divisível.
 */

export interface RateioEntrada {
  /** Identificador opaco do item (ex: cooperadoId, unidadeId). */
  id: string;
  /** Peso do item no rateio (ex: cotaKwhMensal). 0 ou negativo conta como 0. */
  peso: number;
}

export interface RateioSaida {
  id: string;
  /** Parcela alocada com 2 casas decimais. */
  valor: number;
}

export type RateioModo = 'PROPORCIONAL' | 'IGUALITARIO_FALLBACK';

export interface RateioResult {
  saidas: RateioSaida[];
  modo: RateioModo;
}

/**
 * Arredonda pra 2 casas (Math.round monetário/kWh padrão do projeto).
 */
function round2(x: number): number {
  return Math.round(x * 100) / 100;
}

/**
 * Soma pesos válidos (não-negativos e finitos).
 */
function somaPesosValidos(entradas: RateioEntrada[]): number {
  return entradas.reduce((acc, e) => {
    const p = Number(e.peso);
    return acc + (Number.isFinite(p) && p > 0 ? p : 0);
  }, 0);
}

/**
 * Rateia `total` entre `entradas` proporcionalmente ao peso de cada uma.
 *
 * Quando soma dos pesos = 0 (ninguém tem cota capturada), cai em rateio
 * IGUALITARIO_FALLBACK — total dividido igualmente pelos N itens.
 *
 * INVARIANTE CRÍTICA: `saidas.reduce((a, s) => a + s.valor, 0) === total` pra
 * o `total` arredondado em 2 casas. O último item absorve a diferença de
 * arredondamento (técnica do remainder). Garante que a fatura consolidada
 * NUNCA tem R$0,01 sobrando ou faltando.
 */
export function ratearProporcionalCusteio(
  total: number,
  entradas: RateioEntrada[],
): RateioResult {
  const totalArredondado = round2(Number(total));
  const n = entradas.length;
  if (n === 0) {
    return { saidas: [], modo: 'PROPORCIONAL' };
  }

  const somaPesos = somaPesosValidos(entradas);
  const modo: RateioModo =
    somaPesos > 0 ? 'PROPORCIONAL' : 'IGUALITARIO_FALLBACK';

  const saidas: RateioSaida[] =
    modo === 'PROPORCIONAL'
      ? entradas.map((e) => {
          const pesoNorm =
            Number.isFinite(e.peso) && e.peso > 0 ? Number(e.peso) : 0;
          return {
            id: e.id,
            valor: round2((totalArredondado * pesoNorm) / somaPesos),
          };
        })
      : entradas.map((e) => ({
          id: e.id,
          valor: round2(totalArredondado / n),
        }));

  // Reconcilia centavo final — o último item absorve a diferença
  // (positiva ou negativa) pra fechar com totalArredondado.
  const somaSaidas = round2(saidas.reduce((acc, s) => acc + s.valor, 0));
  const diff = round2(totalArredondado - somaSaidas);
  if (diff !== 0 && saidas.length > 0) {
    const ultimo = saidas[saidas.length - 1]!;
    saidas[saidas.length - 1] = {
      id: ultimo.id,
      valor: round2(ultimo.valor + diff),
    };
  }

  return { saidas, modo };
}
