import { NotImplementedException, BadRequestException } from '@nestjs/common';

/**
 * Helper canônico de cálculo de tarifa contratual (Fase B — 03/05/2026).
 *
 * Decisão B33 (Luciano, 03/05/2026):
 *   tarifaContratual = pós-desconto (valor R$/kWh que o cooperado paga).
 *   Engine consumidora NUNCA aplica desconto de novo em cima desta tarifa.
 *
 * Fonte canônica: docs/referencia/REGRAS-PLANOS-E-COBRANCA.md
 *
 * Esta função é a ÚNICA fonte de verdade do cálculo. Todos os caminhos de
 * criação de Contrato + engine DINAMICO devem usá-la.
 */
export type BaseCalculo = 'KWH_CHEIO' | 'SEM_TRIBUTO' | 'COM_ICMS' | 'CUSTOM';

export interface CalcularTarifaContratualInput {
  /** R$/kWh com tributos. Total fatura ÷ kWh consumidos. */
  valorCheioKwh: number;
  /** R$/kWh sem ICMS/PIS/COFINS. TUSD + TE direto da fatura. */
  tarifaSemImpostos: number;
  /** Modo de cálculo do desconto conforme plano. */
  baseCalculo: BaseCalculo;
  /** Percentual 0-100 (não fração). Ex: 15 para 15%. */
  descontoPercentual: number;
  /** Componentes específicos da fatura (apenas se baseCalculo === 'CUSTOM'). */
  componentesCustom?: string[];
}

/** Arredonda para 5 casas decimais (precisão R$/kWh). */
export function arredondar5(n: number): number {
  return Math.round(n * 100000) / 100000;
}

export function calcularTarifaContratual(input: CalcularTarifaContratualInput): number {
  const { valorCheioKwh, tarifaSemImpostos, baseCalculo, descontoPercentual } = input;

  if (!Number.isFinite(valorCheioKwh) || valorCheioKwh <= 0) {
    throw new BadRequestException(`valorCheioKwh inválido: ${valorCheioKwh}`);
  }
  if (!Number.isFinite(descontoPercentual) || descontoPercentual < 0 || descontoPercentual > 100) {
    throw new BadRequestException(`descontoPercentual fora do range 0-100: ${descontoPercentual}`);
  }

  const desc = descontoPercentual / 100;

  if (baseCalculo === 'KWH_CHEIO') {
    // Tipo I + KWH_CHEIO: cooperado paga "valor cheio × (1 - desc)".
    // Ex: R$ 1,02 × (1 - 0,15) = R$ 0,867/kWh.
    return arredondar5(valorCheioKwh * (1 - desc));
  }

  if (baseCalculo === 'SEM_TRIBUTO') {
    // Tipo II + SEM_TRIBUTO (padrão mercado GD): desconto incide só sobre TUSD+TE.
    // descontoEmReais = tarifaSemImpostos × desc; tarifaContratada = valorCheio − descontoEmReais.
    // Ex: 1,02 − (0,78 × 0,15) = 1,02 − 0,117 = R$ 0,903/kWh.
    if (!Number.isFinite(tarifaSemImpostos) || tarifaSemImpostos <= 0) {
      throw new BadRequestException(`tarifaSemImpostos inválido: ${tarifaSemImpostos}`);
    }
    const descontoEmReais = tarifaSemImpostos * desc;
    return arredondar5(valorCheioKwh - descontoEmReais);
  }

  if (baseCalculo === 'COM_ICMS') {
    // Spec parcial em REGRAS-PLANOS-E-COBRANCA.md Seção 6.7.
    // Não há plano em produção usando hoje. Implementar quando spec estiver fechada.
    throw new NotImplementedException('baseCalculo=COM_ICMS ainda não implementado (sem demanda)');
  }

  if (baseCalculo === 'CUSTOM') {
    // Soma componentes específicos da fatura conforme array componentesCustom.
    // Ver REGRAS-PLANOS Seção 6.7. Sem plano em produção usando hoje.
    throw new NotImplementedException('baseCalculo=CUSTOM ainda não implementado (sem demanda)');
  }

  throw new BadRequestException(`baseCalculo desconhecido: ${baseCalculo}`);
}
