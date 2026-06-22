/**
 * Sprint Convênio FAMÍLIA M49 (22/06/2026) — Fatia E (G4 sizing).
 *
 * Helper puro pra estimativa **display-only** de tokens a partir do consumo
 * declarado da cooperada SEM UC (`cotaKwhMensal`).
 *
 * Q6 do orquestrador 22/06: retorno = `{ tokens, valorReais, premissas }`.
 * NÃO tributa, NÃO persiste, NÃO emite token — só responde "se eu declarar
 * X kWh/mês, posso esperar ~Y tokens (~R$ Z)?" pra UI do cadastro/portal.
 *
 * Conversão:
 *   - kWh → R$ via `buscarTarifaPorDistribuidora` (helper `common/tarifa-helper.ts`)
 *     sem throw (fallback 0.5 legado é OK pra display).
 *   - R$ → tokens via `ConfigCooperToken.valorTokenReais` (fallback 0.45).
 *
 * Multi-tenant: `cooperativaId` é obrigatório; ConfigCooperToken é
 * findUnique por cooperativaId (lookup é tenant-bound estruturalmente).
 *
 * Premissas no retorno são explicitas pra UI mostrar "estimativa: 100 kWh
 * × R$ 0,789 ÷ R$ 0,45 = ~175 tokens" + auditoria do número (tarifa veio
 * de qual fonte).
 */
import { PrismaService } from '../prisma.service';
import { buscarTarifaPorDistribuidora } from '../common/tarifa-helper';

export interface SizingPremissas {
  cotaKwhMensal: number;
  tarifaKwh: number;
  tarifaFonte: 'tarifa_concessionaria' | 'fallback';
  valorTokenReais: number;
  valorTokenFonte: 'config_tenant' | 'fallback';
}

export interface SizingResultado {
  tokens: number;
  valorReais: number;
  premissas: SizingPremissas;
}

export interface SizingParams {
  cooperativaId: string;
  cotaKwhMensal: number;
  /** Opcional; se vier, busca tarifa específica da distribuidora. */
  distribuidora?: string | null;
}

const FALLBACK_VALOR_TOKEN_REAIS = 0.45;

export async function estimarTokensPorConsumo(
  prisma: PrismaService,
  params: SizingParams,
): Promise<SizingResultado> {
  const { cooperativaId, cotaKwhMensal, distribuidora } = params;

  if (!cooperativaId) {
    throw new Error('cooperativaId obrigatório.');
  }
  if (!Number.isFinite(cotaKwhMensal) || cotaKwhMensal < 0) {
    throw new Error('cotaKwhMensal deve ser >= 0.');
  }

  // 1) kWh → R$
  // M49 P3 fix (22/06/2026) — usa `isFallback` explícito (additive em
  // tarifa-helper) em vez de inferir por igualdade de valores frágil.
  const tarifaInfo = await buscarTarifaPorDistribuidora(prisma, distribuidora, {
    throwIfNotFound: false,
  });
  const tarifaFonte: 'tarifa_concessionaria' | 'fallback' = tarifaInfo.isFallback
    ? 'fallback'
    : 'tarifa_concessionaria';

  const valorReaisRaw = cotaKwhMensal * tarifaInfo.tarifaKwh;
  const valorReais = Math.round(valorReaisRaw * 100) / 100;

  // 2) R$ → tokens (via ConfigCooperToken do tenant)
  const config = await prisma.configCooperToken.findUnique({
    where: { cooperativaId },
    select: { valorTokenReais: true },
  });
  const valorTokenReais = config?.valorTokenReais
    ? Number(config.valorTokenReais)
    : FALLBACK_VALOR_TOKEN_REAIS;
  const valorTokenFonte: 'config_tenant' | 'fallback' = config?.valorTokenReais
    ? 'config_tenant'
    : 'fallback';

  const tokens = valorTokenReais > 0 ? Math.floor(valorReais / valorTokenReais) : 0;

  return {
    tokens,
    valorReais,
    premissas: {
      cotaKwhMensal,
      tarifaKwh: tarifaInfo.tarifaKwh,
      tarifaFonte,
      valorTokenReais,
      valorTokenFonte,
    },
  };
}
