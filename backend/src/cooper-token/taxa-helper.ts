/**
 * Sprint Clube P1 — Fase 1.5 Bloco 2 (10/06/2026).
 *
 * Helper puro de calculo de Taxa de Operacao do CooperToken. Substitui as
 * constantes chumbadas TAXA_EMISSAO (2%) e TAXA_QR (1%) que estavam em
 * cooper-token.service.ts:46-48 por leitura da config do tenant
 * (ConfigCooperToken — 8 colunas aditivas adicionadas no Bloco 1).
 *
 * Fallback OBRIGATORIO: se `config` for null/undefined OU se um campo
 * especifico vier null/undefined, usa o default da operacao — preservando
 * 100% do comportamento antigo (2% emissao, 1% QR, demais 0).
 *
 * Formula:
 *   taxa = round(bruto * perc / 100, 4) + round(fixa, 4)
 *   liquido = bruto - taxa (round 4 casas)
 *   Clamp: se taxa > bruto, taxa = bruto (liquido >= 0).
 *
 * Decisao 23 / Regra de Coerencia Sistemica: helper puro e testavel sem
 * mockar Prisma; spec separado garante invariantes (preserva 2%/1% por
 * default + custom config aplica certo + Math.round sem ruido float).
 *
 * F0 preservado: processarQrParceiro NAO chama este helper — continua
 * reusando resultado.taxa/quantidadeLiquida do processarPagamentoQr
 * (TAXA_QR cobrada UMA UNICA VEZ sobre o bruto).
 */

export type OperacaoTaxa = 'emissao' | 'qr' | 'transferencia' | 'resgate';

interface DefaultsTaxa {
  perc: number;
  fixa: number;
}

const DEFAULTS: Record<OperacaoTaxa, DefaultsTaxa> = {
  emissao: { perc: 2, fixa: 0 },
  qr: { perc: 1, fixa: 0 },
  transferencia: { perc: 0, fixa: 0 },
  resgate: { perc: 0, fixa: 0 },
};

/**
 * Forma minima do ConfigCooperToken consumida pelo helper. Campos opcionais
 * pra aceitar tanto registro Prisma completo quanto null/undefined/parcial.
 * Tipos `any` cobrem Decimal | number | null vindo do Prisma.
 */
export interface ConfigTaxaLike {
  taxaEmissaoPerc?: any;
  taxaEmissaoFixa?: any;
  taxaQrPerc?: any;
  taxaQrFixa?: any;
  taxaTransferenciaPerc?: any;
  taxaTransferenciaFixa?: any;
  taxaResgatePerc?: any;
  taxaResgateFixa?: any;
}

export interface TaxaResultado {
  /** Taxa aplicada (em tokens, 4 casas). */
  taxa: number;
  /** Bruto - taxa (em tokens, 4 casas). */
  liquido: number;
  /** Percentual efetivamente usado — telemetria. */
  perc: number;
  /** Fixo efetivamente usado (em tokens) — telemetria. */
  fixa: number;
}

function toNumOrNaN(v: any): number {
  if (v == null) return Number.NaN;
  if (typeof v === 'number') return v;
  // Prisma Decimal tem `toNumber()`.
  if (typeof v?.toNumber === 'function') return v.toNumber();
  const n = Number(v);
  return Number.isNaN(n) ? Number.NaN : n;
}

function lerCampo(
  operacao: OperacaoTaxa,
  config: ConfigTaxaLike,
  parte: 'perc' | 'fixa',
): number {
  if (parte === 'perc') {
    if (operacao === 'emissao') return toNumOrNaN(config.taxaEmissaoPerc);
    if (operacao === 'qr') return toNumOrNaN(config.taxaQrPerc);
    if (operacao === 'transferencia') return toNumOrNaN(config.taxaTransferenciaPerc);
    return toNumOrNaN(config.taxaResgatePerc);
  }
  if (operacao === 'emissao') return toNumOrNaN(config.taxaEmissaoFixa);
  if (operacao === 'qr') return toNumOrNaN(config.taxaQrFixa);
  if (operacao === 'transferencia') return toNumOrNaN(config.taxaTransferenciaFixa);
  return toNumOrNaN(config.taxaResgateFixa);
}

/**
 * Calcula taxa de operacao a partir da config do tenant.
 */
export function calcularTaxa(
  operacao: OperacaoTaxa,
  bruto: number,
  config: ConfigTaxaLike | null | undefined,
): TaxaResultado {
  const def = DEFAULTS[operacao];
  let perc = def.perc;
  let fixa = def.fixa;

  if (config) {
    const percRaw = lerCampo(operacao, config, 'perc');
    const fixaRaw = lerCampo(operacao, config, 'fixa');
    if (!Number.isNaN(percRaw)) perc = percRaw;
    if (!Number.isNaN(fixaRaw)) fixa = fixaRaw;
  }

  if (bruto <= 0) {
    return { taxa: 0, liquido: 0, perc, fixa };
  }

  const componentePerc = Math.round((bruto * perc) / 100 * 10000) / 10000;
  const componenteFixa = Math.round(fixa * 10000) / 10000;
  let taxa = Math.round((componentePerc + componenteFixa) * 10000) / 10000;

  // Clamp defensivo: taxa NUNCA pode passar do bruto (liquido sempre >= 0).
  if (taxa > bruto) taxa = bruto;
  if (taxa < 0) taxa = 0;

  const liquido = Math.round((bruto - taxa) * 10000) / 10000;
  return { taxa, liquido, perc, fixa };
}
