/**
 * D-FISCAL-2.4.4a (02/06/2026) — Helper compartilhado de busca de tarifa
 * por distribuidora. Extraído da função privada em `faturas.service.ts:1618`
 * (decisão #7 da Fase 1) pra ser usado pelo motor de cobrança consolidada
 * de custeio (`convenios-custeio.service.ts`).
 *
 * Função pura: recebe prisma + distribuidora, devolve `{ tusd, te, tarifaKwh }`.
 * NÃO tem fallback silencioso (`0.5`) — o caminho consolidado (Caso 1
 * empresa paga total) precisa de erro EXPLÍCITO se não houver tarifa
 * cadastrada (decisão Luciano 02/06: "NUNCA o fallback 0.5 silencioso").
 *
 * O caller controla via `opts.throwIfNotFound: true|false`:
 *   - true (default): lança Error se nenhuma TarifaConcessionaria existir
 *     (uso no consolidado).
 *   - false: retorna o fallback histórico `{ tusd: 0.3, te: 0.2, tarifaKwh: 0.5 }`
 *     (uso legado em faturas.service, mantém comportamento atual).
 */

import { PrismaClient } from '@prisma/client';
import { PrismaService } from '../prisma.service';

export type TarifaInfo = {
  tusd: number;
  te: number;
  tarifaKwh: number;
  /**
   * M49 P3 (22/06/2026) — discriminador explícito de origem da tarifa,
   * pra callers não inferirem fallback por igualdade de valores frágil
   * (sizing.helper). True = retornou FALLBACK_LEGADO (tarifa não encontrada
   * + opts.throwIfNotFound=false). False = veio de TarifaConcessionaria real.
   */
  isFallback: boolean;
};

const FALLBACK_LEGADO: TarifaInfo = { tusd: 0.3, te: 0.2, tarifaKwh: 0.5, isFallback: true };

// Combining diacritical marks U+0300..U+036F — remoção de acentos pós NFD.
const DIACRITICAL_RE = /[̀-ͯ]/g;

function normalize(s: string): string {
  return s.toLowerCase().normalize('NFD').replace(DIACRITICAL_RE, '').trim();
}

export async function buscarTarifaPorDistribuidora(
  prisma: PrismaService | PrismaClient,
  distribuidora: string | null | undefined,
  opts: { throwIfNotFound: boolean } = { throwIfNotFound: true },
): Promise<TarifaInfo> {
  if (distribuidora) {
    const normDistrib = normalize(distribuidora);
    const todasTarifas = await prisma.tarifaConcessionaria.findMany({
      orderBy: { dataVigencia: 'desc' },
    });
    const tarifa = todasTarifas.find((t) => {
      const normConc = normalize(t.concessionaria);
      return normConc.includes(normDistrib) || normDistrib.includes(normConc);
    });
    if (tarifa) {
      const tusd = Number(tarifa.tusdNova);
      const te = Number(tarifa.teNova);
      return { tusd, te, tarifaKwh: tusd + te, isFallback: false };
    }
  }

  // Fallback: tarifa mais recente independente de distribuidora
  const tarifa = await prisma.tarifaConcessionaria.findFirst({
    orderBy: { dataVigencia: 'desc' },
  });
  if (tarifa) {
    const tusd = Number(tarifa.tusdNova);
    const te = Number(tarifa.teNova);
    return { tusd, te, tarifaKwh: tusd + te, isFallback: false };
  }

  if (opts.throwIfNotFound) {
    throw new Error(
      `Nenhuma TarifaConcessionaria cadastrada${
        distribuidora ? ` (procurando por "${distribuidora}")` : ''
      }. Cadastre uma tarifa antes de gerar cobrança consolidada de custeio.`,
    );
  }

  return FALLBACK_LEGADO;
}
