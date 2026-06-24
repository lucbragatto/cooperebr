/**
 * Sprint M52a v2 (23/06/2026) — re-review code (a)+(b).
 *
 * Helpers puros do ledger de CooperToken, extraídos de `cooper-token.job.ts`
 * pra evitar que scripts/specs importem a classe `CooperTokenJob` inteira
 * (com decorators `@Cron`, dependências opcionais, metadata NestJS) quando
 * só precisam da função `sinalDaOperacao`.
 *
 * Zero dependência NestJS — pode ser importado por scripts standalone
 * via `ts-node` sem bootstrapping da aplicação.
 */
import { CooperTokenOperacao, OrigemLancamento } from '@prisma/client';

// ════════════════════════════════════════════════════════════════════
//  Sprint M52b Fatia 2 (23/06/2026) — D-novo-FAXINA-CONTABIL-LEDGER-ALIGN.
//  F12 REVISADO (24/06/2026 — orquestrador confirmou):
//
//  BASELINE PRÉ-M50 = R$ 741,79 (resíduo PÓS-apply do ajuste v2).
//
//  Luciano confirmou (23/06, 2× — contador + advogado) que a classificação
//  contábil dos R$ 116,55 da reconciliação v2 (LUCIANO +49 + AMAGES +210)
//  como D 5.1.03 Despesa Bonificação / C 2.3.01 está RESOLVIDA E FAVORÁVEL.
//  O APPLY do `aplicar-ajuste-reconciliacao-v2.ts` está LIBERADO — roda
//  pós-merge e o baseline já antecipa o estado pós-apply.
//
//  Estado esperado pós-apply do script:
//   - Σ saldoTotal face            = 2.114,32 tokens
//   - valorTokenReais              = R$ 0,45
//   - Passivo ESPERADO             = R$ 951,44
//   - Passivo CONTÁBIL pós-apply   = R$ 209,65 (R$ 93,10 + R$ 116,55)
//   - RESÍDUO pós-apply            = R$ 741,79 ← este baseline
//
//  O R$ 741,79 remanescente é passivo histórico pré-M50 não-escriturado
//  (catalogado como D-novo-FAXINA-PASSIVO-PRE-M50 P1). É **tarefa de
//  código** — Luciano confirmou que a abordagem está resolvida na sua
//  ponta (regularização contábil retrospectiva favorável). Quando o
//  sprint de escrituração rodar (M52c ou posterior), este baseline cai
//  pra zero.
//
//  O cron `reconciliarInvariantesContabil` (M52b Fatia 2) DESCONTA esse
//  baseline ao reportar — só alerta divergência NOVA além dos R$ 741,79.
// ════════════════════════════════════════════════════════════════════
export interface BaselineContabilTenant {
  cooperativaId: string;
  baselineReais: number;
  documentacao: string;
}

export const BASELINES_CONTABIL_PRE_M50: readonly BaselineContabilTenant[] = [
  {
    cooperativaId: 'cmn0ho8bx0000uox8wu96u6fd', // CoopereBR
    baselineReais: 741.79,
    documentacao: 'Resíduo pós-apply da reconciliação v2 — passivo histórico pré-M50 (D-novo-FAXINA-PASSIVO-PRE-M50). Classificação contábil resolvida e favorável (contador+advogado, Luciano 23/06). Cai pra zero quando o sprint de escrituração retrospectiva rodar.',
  },
];

/**
 * Retorna o baseline pré-M50 documentado pro tenant (zero se não há
 * baseline registrado). Usado pelo cron de invariante contábil↔saldo
 * pra suprimir o falso-positivo histórico documentado.
 */
export function getBaselineContabilPreM50(cooperativaId: string): number {
  const baseline = BASELINES_CONTABIL_PRE_M50.find((b) => b.cooperativaId === cooperativaId);
  return baseline?.baselineReais ?? 0;
}

// ════════════════════════════════════════════════════════════════════
//  Sprint M52b F4 F2 (24/06/2026) — fix financeiro-token P2 + multitenant
//  P2 (re-review M52b): cron `reconciliarInvariantesContabil` usava
//  `descricao.includes()` pra discriminar D/C do passivo 2.3.01 — frágil
//  a renames + silent-drop pra lançamentos sem padrão conhecido.
//
//  Substituído por `classificarPartidaPassivo(lanc)` que usa `origemTipo`
//  (enum dedicado) como classificador primário + fallback descricao apenas
//  pra lançamentos legados pré-M52a sem origemTipo. NAO_CLASSIFICADO
//  reporta warn explícito (sem silent-drop).
// ════════════════════════════════════════════════════════════════════

export type LancamentoCaixaPartidaPassivo =
  | 'CREDITO_PASSIVO' // aumenta 2.3.01 (emissão de tokens)
  | 'DEBITO_PASSIVO'  // baixa 2.3.01 (uso/expiração/melt/resgate)
  | 'NAO_CLASSIFICADO'; // sem padrão reconhecido — caller deve alertar

/**
 * Mapa de `OrigemLancamento` que CREDITA o passivo 2.3.01 (aumenta).
 * Inclui apenas valores que apontam pra perna C de 2.3.01.
 *
 * Atualmente só `RECONCILIACAO_HISTORICA_PASSIVO` (M52b Fatia 2 — quando
 * APPLY do script `aplicar-ajuste-reconciliacao-v2.ts` rodar pós-Walter).
 *
 * Emissões antigas (`lancarIngressoEmissaoPaga`/`lancarEmissaoFaturaCheia`/
 * `lancarEmissaoAdminLote`) NÃO populam origemTipo na perna C — caem no
 * fallback descricao no helper abaixo.
 */
const ORIGEMTIPO_CREDITO_PASSIVO = new Set<OrigemLancamento>([
  'RECONCILIACAO_HISTORICA_PASSIVO',
]);

/**
 * Mapa de `OrigemLancamento` que DEBITA o passivo 2.3.01 (baixa).
 * Inclui apenas valores que apontam pra perna D de 2.3.01.
 */
const ORIGEMTIPO_DEBITO_PASSIVO = new Set<OrigemLancamento>([
  'COBRANCA_ABATE_FATURA',       // M50 — D 2.3.01 no abate de fatura
  'TOKEN_TRANSACAO',              // M50 — D 2.3.01 no resgate PIX
  'LEDGER_OXIDACAO',              // M52b — D 2.3.01 melt oxidação
  'TOKEN_TRANSACAO_TAXA',         // M52b — D 2.3.01 melt taxa QR
  'RESGATE_RECIBO_SPREAD',        // M52b — D 2.3.01 melt spread
]);

/**
 * Classifica um lançamento de `LancamentoCaixa` (que JÁ foi filtrado por
 * `planoContasId=2.3.01`) como crédito ou débito do passivo.
 *
 * Estratégia:
 *  1. Se `origemTipo` está num dos Sets acima, usa o classificador enum
 *     (forma robusta).
 *  2. Senão, fallback pra padrão `descricao` `'[Token] C:' / '[Token] D:'`
 *     (retro-compat lançamentos M50 sem origemTipo na perna C).
 *  3. Senão, retorna `NAO_CLASSIFICADO` — caller DEVE logar warn.
 */
export function classificarPartidaPassivo(lanc: {
  origemTipo: OrigemLancamento | null | undefined;
  descricao: string | null | undefined;
}): LancamentoCaixaPartidaPassivo {
  if (lanc.origemTipo && ORIGEMTIPO_CREDITO_PASSIVO.has(lanc.origemTipo)) {
    return 'CREDITO_PASSIVO';
  }
  if (lanc.origemTipo && ORIGEMTIPO_DEBITO_PASSIVO.has(lanc.origemTipo)) {
    return 'DEBITO_PASSIVO';
  }
  // Fallback retrocompat — lançamentos pré-M52b sem origemTipo populado.
  const desc = lanc.descricao ?? '';
  if (desc.includes('C: Passivo') || desc.includes('C Passivo')) {
    return 'CREDITO_PASSIVO';
  }
  if (
    desc.includes('D: Baixa Passivo') ||
    desc.includes('Resgate PIX') ||
    desc.includes('D Passivo')
  ) {
    return 'DEBITO_PASSIVO';
  }
  return 'NAO_CLASSIFICADO';
}

/**
 * Sinal canônico de cada CooperTokenOperacao sobre o saldo do
 * cooperado/parceiro (re-review orquestrador 23/06). Exaustivo —
 * TypeScript detecta no compile-time qualquer operação nova que não
 * foi classificada (via `never` branch). Quebra explícita previne
 * regressões silenciosas.
 *
 * Classificação:
 *   ENTRA (+1): CREDITO, DOACAO_RECEBIDA, COMPRA_PARCEIRO
 *   SAI   (-1): DEBITO, EXPIRACAO, DOACAO_ENVIADA, ABATIMENTO_ENERGIA,
 *                TRANSFERENCIA_PARCEIRO, RESGATE_CLUBE, OXIDACAO
 *
 * `quantidade` é SEMPRE positiva (fix estrutural M52a); a direção
 * vem 100% da operacao via este switch.
 */
export function sinalDaOperacao(op: CooperTokenOperacao): 1 | -1 {
  switch (op) {
    case CooperTokenOperacao.CREDITO:
    case CooperTokenOperacao.DOACAO_RECEBIDA:
    case CooperTokenOperacao.COMPRA_PARCEIRO:
      return 1;
    case CooperTokenOperacao.DEBITO:
    case CooperTokenOperacao.EXPIRACAO:
    case CooperTokenOperacao.DOACAO_ENVIADA:
    case CooperTokenOperacao.ABATIMENTO_ENERGIA:
    case CooperTokenOperacao.TRANSFERENCIA_PARCEIRO:
    case CooperTokenOperacao.RESGATE_CLUBE:
    case CooperTokenOperacao.OXIDACAO:
      return -1;
    default: {
      const _exhaustive: never = op;
      throw new Error(
        `[invariante] CooperTokenOperacao não classificada: ${String(_exhaustive)}. Atualizar sinalDaOperacao() antes de adicionar valor novo ao enum.`,
      );
    }
  }
}
