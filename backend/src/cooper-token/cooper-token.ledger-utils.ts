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
