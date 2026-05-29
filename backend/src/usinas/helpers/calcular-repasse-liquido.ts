/**
 * BH.5 (M41, 2026-05-30) — Envelope sobre `calcularRepasse` puro que
 * subtrai despesas `tratamento=DESCONTO_NO_REPASSE`, `statusAprovacao=APROVADA`,
 * `statusResolucao=PENDENTE` do período (default = mês da competência).
 *
 * Decisões:
 *   - `calcularRepasse` PURO permanece intacto — caller que precisar do valor
 *     contratual sem abater (ex: simulação) continua usando direto.
 *   - Líquido nunca negativo: `Math.max(0, bruto - despesas)`.
 *   - Multi-tenant defense in depth: query Prisma exige `cooperativaId` E
 *     `usinaId` — IDOR-safe mesmo se caller esquecer um.
 *   - `repasseAbatidoId` NÃO é populado nesta fatia (D-novo-AN sprint próprio
 *     do RepasseProprietario). Despesas continuam PENDENTE até serem
 *     marcadas como RESOLVIDAS por outra etapa (manual ou cron futuro).
 *
 * Período de abatimento:
 *   - Se `periodoInicio`/`periodoFim` explícitos → usa.
 *   - Senão → deriva do mês de `geracaoMes.competencia` (todo o mês).
 *   - Sem geracaoMes E sem período → não abate nada (líquido = bruto).
 */

import { PrismaClient } from '@prisma/client';
import {
  calcularRepasse,
  type GeracaoMesParaCalculo,
  type ResultadoCalculoRepasse,
  type TarifaResolver,
  type UsinaParaCalculo,
} from './calcular-repasse';

export interface CalcularRepasseLiquidoParams {
  usina: UsinaParaCalculo;
  usinaId: string;
  cooperativaId: string;
  geracaoMes: GeracaoMesParaCalculo | null;
  tarifaResolver: TarifaResolver;
  prisma: Pick<PrismaClient, 'contaAPagar'>;
  /** Início (inclusive) do período de abatimento. Default = primeiro dia do mês de geracaoMes.competencia. */
  periodoInicio?: Date;
  /** Fim (inclusive) do período. Default = primeiro dia do mês seguinte (consulta usa < periodoFim). */
  periodoFim?: Date;
}

export interface DespesaAbatida {
  id: string;
  categoria: string;
  valor: number;
  descricao: string;
  dataOcorrencia: Date | null;
}

export interface ResultadoCalculoRepasseLiquido extends ResultadoCalculoRepasse {
  /** Valor LÍQUIDO (bruto - despesasAbatidas, nunca negativo). Compat com chamadores que liam `valor`. */
  valor: number | null;
  /** Valor BRUTO antes do abatimento (igual ao retorno do `calcularRepasse` puro). */
  valorBruto: number | null;
  /** Despesas DESCONTO_NO_REPASSE APROVADA + PENDENTE descontadas no período. */
  despesasAbatidas: DespesaAbatida[];
  /** Soma dos valores em `despesasAbatidas` (já arredondado). */
  totalDespesasAbatidas: number;
}

function arredondar(valor: number): number {
  return Math.round(valor * 100) / 100;
}

function inicioDoMes(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), 1);
}

function inicioDoMesSeguinte(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth() + 1, 1);
}

export async function calcularRepasseLiquido(
  params: CalcularRepasseLiquidoParams,
): Promise<ResultadoCalculoRepasseLiquido> {
  const {
    usina,
    usinaId,
    cooperativaId,
    geracaoMes,
    tarifaResolver,
    prisma,
    periodoInicio,
    periodoFim,
  } = params;

  // 1. Repasse bruto — helper puro inalterado
  const bruto = await calcularRepasse(usina, geracaoMes, tarifaResolver);

  // 2. Período de abatimento
  let inicio: Date | null = periodoInicio ?? null;
  let fim: Date | null = periodoFim ?? null;
  if (!inicio && geracaoMes) {
    inicio = inicioDoMes(geracaoMes.competencia);
  }
  if (!fim && geracaoMes) {
    fim = inicioDoMesSeguinte(geracaoMes.competencia);
  }

  // Sem período → não abate
  if (!inicio || !fim) {
    return {
      ...bruto,
      valorBruto: bruto.valor,
      despesasAbatidas: [],
      totalDespesasAbatidas: 0,
    };
  }

  // 3. Buscar despesas DESCONTO_NO_REPASSE APROVADAS pendentes no período
  const despesas = await prisma.contaAPagar.findMany({
    where: {
      cooperativaId,
      usinaId,
      tratamento: 'DESCONTO_NO_REPASSE',
      statusAprovacao: 'APROVADA',
      statusResolucao: 'PENDENTE',
      dataOcorrencia: { gte: inicio, lt: fim },
    },
    select: {
      id: true,
      categoria: true,
      valor: true,
      descricao: true,
      dataOcorrencia: true,
    },
  });

  const despesasAbatidas: DespesaAbatida[] = despesas.map((d) => ({
    id: d.id,
    categoria: d.categoria,
    valor: Number(d.valor),
    descricao: d.descricao,
    dataOcorrencia: d.dataOcorrencia,
  }));

  const totalDespesasAbatidas = arredondar(
    despesasAbatidas.reduce((s, d) => s + d.valor, 0),
  );

  // 4. Líquido: bruto - despesas (nunca negativo)
  let valorLiquido: number | null = null;
  if (bruto.valor !== null) {
    valorLiquido = arredondar(Math.max(0, bruto.valor - totalDespesasAbatidas));
  }

  return {
    ...bruto,
    valor: valorLiquido,
    valorBruto: bruto.valor,
    despesasAbatidas,
    totalDespesasAbatidas,
  };
}
