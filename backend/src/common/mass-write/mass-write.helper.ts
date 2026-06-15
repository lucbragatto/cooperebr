/**
 * Sprint Clube P1 — F3 Bloco A (12/06/2026).
 *
 * Helper genérico pra operações de mass-write intra-tenant com 5 controles:
 *
 *   1. CAP por lote — limite máximo de itens (default 200; cross-ref Sprint
 *      Hardening P2 absorverá quando rodar).
 *   2. PREVIEW (dry-run) — modo `PREVIEW` retorna resumo sem tocar banco.
 *      Modo `CONFIRM` abre `$transaction Serializable` única.
 *   3. IDEMPOTÊNCIA por lote — `clientRequestId` checado via callback do
 *      consumer (cada caso de uso registra em tabela própria via
 *      `referenciaId+referenciaTabela`).
 *   4. LOG auditável — `AuditLog.create` com `acao` + payload completo
 *      (nItens, cap, modo, alertas).
 *   5. ALERTAS — preview retorna lista de alertas (ex.: SALDO_INSUFICIENTE,
 *      MEMBROS_INVALIDOS, CLT_NAO_CONFIRMADO) sem precisar lançar.
 *
 * Por que helper puro com callbacks (não classe de service):
 *  - Cada consumer (F3 distribuição, Hardening P2 mass-write SUPER_ADMIN, etc)
 *    tem queries diferentes — callback é o ponto de injeção.
 *  - Helper centraliza o FLUXO (validações universais + log), não a lógica de
 *    domínio.
 *  - Testável isoladamente sem mockar consumer.
 *
 * Cross-ref: F3 é o PRIMEIRO consumer. Sprint Hardening Mass-Write SUPER_ADMIN
 * P2 reusa este helper sem alterar a API — apenas injeta callbacks próprios
 * (preview de mudança em massa, commit que toca múltiplas tabelas, etc).
 */
import { BadRequestException, Logger } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma.service';

export type MassWriteMode = 'PREVIEW' | 'CONFIRM';

export interface MassWriteAlerta {
  /** Código curto pra UI traduzir (SALDO_INSUFICIENTE, CAP_EXCEDIDO, etc). */
  codigo: string;
  /** Mensagem humana já formatada (PT-BR). */
  mensagem: string;
  /** Severidade: `bloqueante` impede commit; `aviso` deixa passar. */
  severidade: 'bloqueante' | 'aviso';
}

export interface MassWritePreview {
  /** Quantos itens vão ser processados (após filtragens). */
  totalItens: number;
  /** Lista de alertas (vazia = OK pra commit). */
  alertas: MassWriteAlerta[];
  /** Payload livre do consumer pra UI (soma, saldos, etc). */
  resumo?: Record<string, unknown>;
}

export interface MassWriteCommitContext<TItem> {
  tx: Prisma.TransactionClient;
  items: TItem[];
}

export interface MassWriteOptions<TItem, TCommitOut> {
  /** Identificador da ação (ex.: 'MASS_WRITE_DISTRIBUICAO'). Vai pro AuditLog. */
  acao: string;
  /** Multi-tenant — exigido. AuditLog também filtra por isso. */
  cooperativaId: string;
  /** Quem disparou — vai pro AuditLog. Empresa-PJ usa o `cooperadoId` ou `usuarioId`. */
  usuarioId: string;
  /**
   * Idempotência por lote: chave gerada no cliente (UUID v4 recomendado).
   * Helper passa pro callback `verificarIdempotencia` decidir.
   */
  clientRequestId: string;
  /** Itens a processar (cada elemento vira 1 linha de commit). */
  items: TItem[];
  /** Cap máximo de itens por lote (default 200). */
  cap?: number;
  /** PREVIEW = dry-run; CONFIRM = commit em $transaction Serializable. */
  mode: MassWriteMode;
  /**
   * Callback consumer: retorna resultado anterior se já processado
   * (idempotência hit), ou null pra prosseguir.
   * Tipicamente faz `ledger.findFirst({referenciaId: clientRequestId,
   * referenciaTabela: 'MASS_WRITE_*'})`.
   */
  verificarIdempotencia: () => Promise<TCommitOut | null>;
  /**
   * Build preview SEM writes. Recebe `items` filtrados (após cap-check) e
   * retorna preview com alertas.
   */
  preview: (items: TItem[]) => Promise<MassWritePreview>;
  /**
   * Execute writes dentro da tx Serializable. Recebe `tx` (transaction
   * client) e `items` filtrados. Retorna `TCommitOut` (forma livre).
   */
  commit: (ctx: MassWriteCommitContext<TItem>) => Promise<TCommitOut>;
  /** Payload extra pro AuditLog.metadata (ex.: saldoAntes, saldoDepois). */
  logExtra?: () => Record<string, unknown>;
  /** IP / userAgent do request (opcionais, vão pro AuditLog). */
  ip?: string;
  userAgent?: string;
  /**
   * Perfil do usuário que disparou (vai pro AuditLog.usuarioPerfil). Default
   * 'COOPERADO' por compat com F3 distribuir (primeiro consumer). M39 admin
   * passa 'ADMIN'/'SUPER_ADMIN'/'OPERADOR' do `req.user.perfil`. P2 reviewer
   * multitenant 16/06: sem isso, AuditLog grava perfil errado em operação
   * de emissão de dinheiro (rastreabilidade comprometida).
   */
  usuarioPerfil?: string;
}

export interface MassWritePreviewResult {
  modo: 'PREVIEW';
  preview: MassWritePreview;
  podeProsseguir: boolean;
}

export interface MassWriteCommitResult<TCommitOut> {
  modo: 'CONFIRM';
  preview: MassWritePreview;
  resultado: TCommitOut;
  idempotente?: boolean;
}

export type MassWriteResult<TCommitOut> =
  | MassWritePreviewResult
  | MassWriteCommitResult<TCommitOut>;

export const MASS_WRITE_CAP_DEFAULT = 200;

const logger = new Logger('MassWriteHelper');

/**
 * Executa operação de mass-write com 5 controles: cap, preview/confirm,
 * idempotência, log auditável, alertas.
 *
 * Sequência:
 *   1. Validar cooperativaId + clientRequestId + items.length > 0.
 *   2. Cap-check: se exceder, lança BadRequest com mensagem clara.
 *   3. Modo CONFIRM: chama verificarIdempotencia; se hit, retorna
 *      resultado anterior + idempotente=true + log com flag.
 *   4. Build preview (sempre, mesmo em CONFIRM — usado pra alertas e log).
 *   5. Se PREVIEW: retorna preview + podeProsseguir (true se sem alertas
 *      bloqueantes). Sem writes, sem log de commit.
 *   6. Se CONFIRM:
 *      - Se preview tem alertas bloqueantes, lança BadRequest com lista.
 *      - Abre `$transaction Serializable`, executa commit callback.
 *      - Cria AuditLog com payload completo APÓS commit (fora da tx — não
 *        bloqueia tx por log).
 *      - Retorna resultado + preview snapshot.
 *
 * Multi-tenant: cooperativaId é injetado pelo caller (do JWT) — helper
 * não verifica, só passa adiante pro AuditLog e callbacks. Quem chama
 * é responsável por filtrar items pelo tenant.
 */
export async function executarMassWrite<TItem, TCommitOut>(
  prisma: PrismaService,
  options: MassWriteOptions<TItem, TCommitOut>,
): Promise<MassWriteResult<TCommitOut>> {
  const cap = options.cap ?? MASS_WRITE_CAP_DEFAULT;

  // [1] Validações universais
  if (!options.cooperativaId) {
    throw new BadRequestException('cooperativaId obrigatório no mass-write.');
  }
  if (!options.clientRequestId || options.clientRequestId.trim().length < 8) {
    throw new BadRequestException(
      'clientRequestId obrigatório (mínimo 8 chars; recomendado UUID v4). Usado pra idempotência: retry do mesmo lote não duplica.',
    );
  }
  if (!options.items || options.items.length === 0) {
    throw new BadRequestException('Lote vazio — informe ao menos 1 item.');
  }

  // [2] Cap-check
  if (options.items.length > cap) {
    throw new BadRequestException(
      `Lote excede o cap (${options.items.length} > ${cap}). Divida em lotes menores.`,
    );
  }

  // [3] Idempotência (só CONFIRM — PREVIEW pode ser repetido livremente).
  if (options.mode === 'CONFIRM') {
    const resultadoAnterior = await options.verificarIdempotencia();
    if (resultadoAnterior !== null) {
      logger.log(
        `[${options.acao}] idempotência hit — clientRequestId=${options.clientRequestId} já processado, retornando resultado anterior`,
      );
      // Log do hit pra auditoria (importante: retry observado).
      try {
        await prisma.auditLog.create({
          data: {
            usuarioId: options.usuarioId,
            usuarioPerfil: options.usuarioPerfil ?? 'COOPERADO',
            cooperativaId: options.cooperativaId,
            acao: `${options.acao}.IDEMPOTENT_RETRY`,
            recurso: 'MassWrite',
            recursoId: options.clientRequestId,
            metadata: {
              nItens: options.items.length,
              ...(options.logExtra?.() ?? {}),
            } as unknown as Prisma.InputJsonValue,
            ip: options.ip ?? null,
            userAgent: options.userAgent ?? null,
          },
        });
      } catch (err) {
        // AuditLog não pode quebrar fluxo idempotente.
        logger.warn(
          `AuditLog IDEMPOTENT_RETRY falhou (não derruba): ${(err as Error).message}`,
        );
      }

      // Preview "sintético" — apenas indica que foi reuso, sem chamar callback
      // novamente (que poderia ter side-effects implícitos).
      return {
        modo: 'CONFIRM',
        preview: { totalItens: options.items.length, alertas: [] },
        resultado: resultadoAnterior,
        idempotente: true,
      };
    }
  }

  // [4] Build preview (sempre).
  const preview = await options.preview(options.items);

  // [5] PREVIEW mode: retorna sem writes nem log de commit.
  if (options.mode === 'PREVIEW') {
    const bloqueantes = preview.alertas.filter((a) => a.severidade === 'bloqueante');
    return {
      modo: 'PREVIEW',
      preview,
      podeProsseguir: bloqueantes.length === 0,
    };
  }

  // [6] CONFIRM mode
  const bloqueantes = preview.alertas.filter((a) => a.severidade === 'bloqueante');
  if (bloqueantes.length > 0) {
    throw new BadRequestException(
      `Não foi possível confirmar o lote — alertas bloqueantes: ${bloqueantes
        .map((a) => `[${a.codigo}] ${a.mensagem}`)
        .join('; ')}`,
    );
  }

  const resultado = await prisma.$transaction(
    async (tx) => {
      return options.commit({ tx, items: options.items });
    },
    { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
  );

  // Log APÓS commit (fora da tx — log falhando não derruba dinheiro).
  try {
    await prisma.auditLog.create({
      data: {
        usuarioId: options.usuarioId,
        usuarioPerfil: options.usuarioPerfil ?? 'COOPERADO',
        cooperativaId: options.cooperativaId,
        acao: options.acao,
        recurso: 'MassWrite',
        recursoId: options.clientRequestId,
        metadata: {
          nItens: options.items.length,
          cap,
          alertas: preview.alertas,
          resumo: preview.resumo ?? null,
          ...(options.logExtra?.() ?? {}),
        } as unknown as Prisma.InputJsonValue,
        ip: options.ip ?? null,
        userAgent: options.userAgent ?? null,
      },
    });
  } catch (err) {
    logger.warn(
      `AuditLog ${options.acao} falhou (não derruba commit): ${(err as Error).message}`,
    );
  }

  return {
    modo: 'CONFIRM',
    preview,
    resultado,
  };
}
