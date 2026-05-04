/**
 * Simulação de plano em TypeScript puro pra UI (Fase C.1, 03/05/2026).
 *
 * Replica matematicamente o helper canônico backend lib/calcular-tarifa-contratual.ts —
 * cobre as mesmas 2 baseCalculo intencionalmente (Sprint 5 ponto 3).
 *
 * Decisão Luciano (Gate 1 da Fase C): replicar fórmula no frontend pra
 * simulação em tempo real sem ida ao backend. Paridade verificada por
 * spec standalone em web/scripts/test-simular-plano.ts.
 *
 * NÃO depende de hooks, não chama API, não lê banco. Função pura.
 */

export type BaseCalculo = 'KWH_CHEIO' | 'SEM_TRIBUTO' | 'COM_ICMS' | 'CUSTOM';
export type ModeloCobranca = 'FIXO_MENSAL' | 'CREDITOS_COMPENSADOS' | 'CREDITOS_DINAMICO';
export type TipoDesconto = 'APLICAR_SOBRE_BASE' | 'ABATER_DA_CHEIA';
export type ReferenciaValor = 'ULTIMA_FATURA' | 'MEDIA_3M' | 'MEDIA_6M' | 'MEDIA_12M';

export interface SimularPlanoInput {
  /** R$/kWh com tributos. Default 1,02000 (fatura EDP típica). */
  valorCheioKwh: number;
  /** R$/kWh sem ICMS/PIS/COFINS. Default 0,78000 (TUSD+TE EDP). */
  tarifaSemImpostos: number;
  baseCalculo: BaseCalculo;
  /** Percentual 0-100 (não fração). */
  descontoBase: number;
  /** kWh/mês (apenas FIXO usa pra calcular valorContratado). */
  kwhContratoMensal: number;
  modeloCobranca: ModeloCobranca;
  /** Opcional — habilita avisos V4 contextuais. */
  tipoDesconto?: TipoDesconto;
  referenciaValor?: ReferenciaValor;
  /** Opcional — promo. */
  temPromocao?: boolean;
  descontoPromocional?: number;
  mesesPromocao?: number;
}

export interface SimulacaoFase {
  tarifaContratada: number;
  /** R$/mês (apenas FIXO). null em COMPENSADOS/DINAMICO. */
  valorContratado: number | null;
  /** kwhContratoMensal × valorCheioKwh. */
  valorBruto: number;
  valorLiquido: number;
  valorEconomiaMes: number;
  valorEconomiaAno: number;
  valorEconomia5anos: number;
  valorEconomia15anos: number;
}

export interface SimulacaoResultado extends SimulacaoFase {
  tarifaCheiaUsada: number;
  tarifaSemImpostosUsada: number;
  /** Avisos V4 da Fase B — combinações estranhas mas não-bloqueantes. */
  avisos: string[];
  /** Quando temPromocao: simulação da fase promocional separada. */
  promocional?: SimulacaoFase | null;
}

/** Arredonda para 5 casas decimais (R$/kWh). */
export function arredondar5(n: number): number {
  return Math.round(n * 100000) / 100000;
}

/** Arredonda para 2 casas decimais (R$). */
export function arredondar2(n: number): number {
  return Math.round(n * 100) / 100;
}

/**
 * Calcula tarifa contratada conforme baseCalculo + tipoDesconto do plano.
 *
 * Paridade com helper canônico backend (lib/calcular-tarifa-contratual.ts).
 * Cobre 2 das 4 baseCalculo por decisão Sprint 5 v1. Implementa as 4 combinações:
 *
 *   KWH_CHEIO + APLICAR_SOBRE_BASE → valorCheio × (1 − desc)
 *   KWH_CHEIO + ABATER_DA_CHEIA    → valorCheio − (valorCheio × desc)  ⇒ mesmo valor
 *   SEM_TRIBUTO + APLICAR_SOBRE_BASE → tarifaSemImpostos × (1 − desc)  ⇒ paga abaixo de TUSD+TE
 *   SEM_TRIBUTO + ABATER_DA_CHEIA  → valorCheio − (tarifaSemImpostos × desc)  ⇒ padrão mercado GD
 */
export function calcularTarifaContratada(
  valorCheioKwh: number,
  tarifaSemImpostos: number,
  baseCalculo: BaseCalculo,
  descontoPercentual: number,
  tipoDesconto: TipoDesconto = 'APLICAR_SOBRE_BASE',
): number {
  if (!Number.isFinite(valorCheioKwh) || valorCheioKwh <= 0) return 0;
  if (!Number.isFinite(descontoPercentual) || descontoPercentual < 0 || descontoPercentual > 100) return 0;

  const desc = descontoPercentual / 100;

  // tarifaBase: R$/kWh da base escolhida pelo admin (depende de baseCalculo).
  let tarifaBase: number;
  if (baseCalculo === 'KWH_CHEIO') {
    tarifaBase = valorCheioKwh;
  } else if (baseCalculo === 'SEM_TRIBUTO') {
    if (!Number.isFinite(tarifaSemImpostos) || tarifaSemImpostos <= 0) return 0;
    tarifaBase = tarifaSemImpostos;
  } else {
    // COM_ICMS / CUSTOM: ainda não implementados (paridade com backend).
    return 0;
  }

  // Tipo I (APLICAR_SOBRE_BASE) × Tipo II (ABATER_DA_CHEIA) — Seções 4.2/4.3 das REGRAS-PLANOS.
  if (tipoDesconto === 'ABATER_DA_CHEIA') {
    const abatimentoPorKwh = tarifaBase * desc;
    return arredondar5(valorCheioKwh - abatimentoPorKwh);
  }
  return arredondar5(tarifaBase * (1 - desc));
}

function calcularFase(
  input: SimularPlanoInput,
  descontoPct: number,
): SimulacaoFase {
  const tarifaContratada = calcularTarifaContratada(
    input.valorCheioKwh,
    input.tarifaSemImpostos,
    input.baseCalculo,
    descontoPct,
    input.tipoDesconto,
  );
  const ehFixo = input.modeloCobranca === 'FIXO_MENSAL';
  const valorContratado = ehFixo
    ? arredondar2(tarifaContratada * input.kwhContratoMensal)
    : null;
  const valorBruto = arredondar2(input.valorCheioKwh * input.kwhContratoMensal);
  const valorLiquido = ehFixo
    ? (valorContratado ?? 0)
    : arredondar2(tarifaContratada * input.kwhContratoMensal);
  const valorEconomiaMes = Math.max(0, arredondar2(valorBruto - valorLiquido));
  return {
    tarifaContratada,
    valorContratado,
    valorBruto,
    valorLiquido,
    valorEconomiaMes,
    valorEconomiaAno: arredondar2(valorEconomiaMes * 12),
    valorEconomia5anos: arredondar2(valorEconomiaMes * 60),
    valorEconomia15anos: arredondar2(valorEconomiaMes * 180),
  };
}

/**
 * V4 da Fase B (combinações estranhas, não-bloqueantes).
 * Mesmo conjunto de avisos do helper backend warnings-plano.ts.
 */
function gerarAvisos(input: SimularPlanoInput): string[] {
  const avisos: string[] = [];

  if (
    input.modeloCobranca === 'CREDITOS_COMPENSADOS' &&
    input.referenciaValor &&
    input.referenciaValor !== 'ULTIMA_FATURA'
  ) {
    avisos.push(
      `COMPENSADOS com referência "${input.referenciaValor}": esperado ULTIMA_FATURA pra capturar tarifa do mês de aceite.`,
    );
  }
  if (input.tipoDesconto === 'ABATER_DA_CHEIA' && input.baseCalculo === 'KWH_CHEIO') {
    avisos.push(
      'Para baseCalculo=KWH_CHEIO os dois modos de aplicação resultam no mesmo valor. A escolha entre "Sobre o total" e "Sobre a parte da energia" só muda o resultado quando baseCalculo=SEM_TRIBUTO. Pode manter ou trocar — não afeta o cooperado.',
    );
  }
  if (input.tipoDesconto === 'APLICAR_SOBRE_BASE' && input.baseCalculo === 'SEM_TRIBUTO') {
    avisos.push(
      'Combinação rara: cooperado pagaria abaixo da TUSD+TE (sem ICMS/PIS/COFINS embutidos), gerando economia efetiva acima de 40%. Faz sentido só em acordos específicos — confira se é intencional.',
    );
  }
  if (input.baseCalculo === 'COM_ICMS' || input.baseCalculo === 'CUSTOM') {
    avisos.push(
      `Plano configurado com baseCalculo "${input.baseCalculo}" — modo não disponível na UI v1 nem na API v1 (decisão Sprint 5 v1, fórmula não implementada). Pra editar, troque pra KWH_CHEIO ou SEM_TRIBUTO. Reabertura depende de spec ANEEL.`,
    );
  }
  if (
    input.temPromocao === true &&
    typeof input.descontoPromocional === 'number' &&
    input.descontoPromocional <= input.descontoBase
  ) {
    avisos.push(
      `Promoção (${input.descontoPromocional}%) precisa ser maior que desconto base (${input.descontoBase}%) — caso contrário não há promoção real.`,
    );
  }

  return avisos;
}

export function simularPlano(input: SimularPlanoInput): SimulacaoResultado {
  const fase = calcularFase(input, input.descontoBase);
  const avisos = gerarAvisos(input);

  let promocional: SimulacaoFase | null | undefined;
  if (
    input.temPromocao === true &&
    typeof input.descontoPromocional === 'number' &&
    input.descontoPromocional > 0
  ) {
    promocional = calcularFase(input, input.descontoPromocional);
  }

  return {
    ...fase,
    tarifaCheiaUsada: input.valorCheioKwh,
    tarifaSemImpostosUsada: input.tarifaSemImpostos,
    avisos,
    promocional,
  };
}
