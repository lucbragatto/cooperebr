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
import { CooperTokenOperacao } from '@prisma/client';

// ════════════════════════════════════════════════════════════════════
//  Sprint M52b Fatia 2 (23/06/2026) — D-novo-FAXINA-PASSIVO-PRE-M50.
//
//  BASELINE PRÉ-M50 documentado: passivo histórico não-escriturado do
//  tenant CoopereBR antes da implantação do modelo voucher CPC 47 (M50).
//
//  Medição via `scripts/check-invariante-contabil-tenant.ts` (23/06/2026
//  pós-merge M52a v2):
//   - Σ saldoTotal face   = 2114,32 tokens
//   - Passivo ESPERADO    = R$ 951,44 (2114,32 × R$ 0,45)
//   - Passivo CONTÁBIL    = R$ 93,10 (13 lançamentos 2.3.01 ativos)
//   - RESÍDUO total       = R$ 858,34
//   - Após Fatia 2 APPLY  = R$ 858,34 − R$ 116,55 = R$ 741,79 (baseline)
//
//  O cron `reconciliarInvariantesContabil` (M52b Fatia 2) DESCONTA esse
//  baseline ao reportar — só alerta divergência NOVA além dele. Senão
//  o cron dispara alarme todo dia sobre os R$ 741 parados aguardando
//  Walter (D-novo-FAXINA-PASSIVO-PRE-M50 P1 catalogado).
//
//  NÃO escriturar cego os R$ 741 — exige parecer Walter sobre como
//  lançar passivo histórico de exercícios anteriores (NBC TG 1000 item
//  10.6 — correção retrospectiva vs lançamento de abertura de balanço).
//
//  Quando Walter responder, este baseline vira ZERO (ou um valor
//  específico de transição) — ajustar aqui + commit + reviewer.
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
    documentacao: 'D-novo-FAXINA-PASSIVO-PRE-M50 — passivo histórico não-escriturado pré-M50. Aguarda parecer Walter (docs/conformidade/parecer-walter-passivo-pre-m50-PENDENTE.md).',
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
