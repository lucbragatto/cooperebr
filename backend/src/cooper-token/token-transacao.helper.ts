/**
 * Sprint Clube P1 — F4 Bloco B (12/06/2026).
 *
 * Helper centralizado pra criar registros `TokenTransacao` com:
 *  - `jti` UUID-hex (anti-replay; unique constraint no banco)
 *  - `tier` BAIXO/ALTO baseado em valor R$ (limiar R$ 50)
 *  - `motivoStepUp` (PRIMEIRO_USO | DESTINATARIO_NOVO | VALOR_ALTO | null)
 *  - Defesa multi-tenant (pagador.cooperativaId === pagadorCooperativaId
 *    do param; cross-tenant explicitamente bloqueado por default)
 *
 * Reuso: F4 Bloco C vai consumir aqui em `usarNaFatura`, `processarPagamentoQr`
 * e `enviarTokens` — espinha conceitual idêntica pros 3.
 *
 * Por que helper puro (não método do service):
 *  - Recebe `tx` (Prisma.TransactionClient) → roda dentro de tx Serializable
 *    do caller sem nested-transaction
 *  - Testável sem mockar `CooperTokenService` inteiro
 *  - Pode evoluir pra estender o model TokenTransacao sem mexer em 3 callers
 *
 * Decisões catalogadas (sessão 12/06):
 *  - jti gerado no backend via `gerarTokenHex(16)` (32 chars hex). Cliente
 *    não envia idempotency-key (decisão Luciano 12/06, Q6).
 *  - tier BAIXO (≤R$50) | ALTO (>R$50). Cooperado sempre PIN; OTP só ALTO.
 *  - Cross-tenant: bloqueado por default. Operação só prossegue se pagador
 *    e recebedor pertencerem ao mesmo `cooperativaId` (regra MMGD — Fase 3
 *    spec). Param `permitirCrossTenant: true` libera (uso interno F-G).
 *  - `qrExpiresAt`: null = operação NÃO-QR (Bloco B torna campo nullable).
 *    QR real preenche com `new Date(Date.now() + 60_000)` (Fase 3).
 */
import { Prisma } from '@prisma/client';
import { gerarTokenHex } from '../common/security/otp-helper';

/** Limiar de valor R$ pra step-up OTP (spec do model TokenTransacao). */
export const LIMIAR_TIER_REAIS = 50;

export type TipoOperacaoTokenTransacao =
  | 'PAGAMENTO'
  | 'TRANSFERENCIA'
  | 'RECEBIMENTO'
  | 'RESGATE'
  | 'COMPRA_TOKEN'
  | 'USO_FATURA';

export type MotivoStepUp =
  | 'PRIMEIRO_USO'
  | 'DESTINATARIO_NOVO'
  | 'VALOR_ALTO'
  | null;

export type TierTokenTransacao = 'BAIXO' | 'ALTO';

export interface CriarTokenTransacaoParams {
  /** Pagador (cooperado) — sempre obrigatório. */
  pagadorId: string;
  pagadorCooperativaId: string;

  /** Recebedor (cooperado) — opcional pra fluxos sem recebedor (resgate, uso-fatura). */
  recebedorId?: string | null;
  recebedorCooperativaId?: string | null;

  /** Quantidade de tokens (4 casas decimais). */
  quantidadeTokens: number | Prisma.Decimal;
  /** Valor estimado em R$ (2 casas) — usado pra calcular tier. */
  valorReaisEstimado: number | Prisma.Decimal;

  /** Tipo da operação (categorização do extrato). */
  tipoOperacao: TipoOperacaoTokenTransacao;

  /** Status inicial. Default PENDENTE_PIN. */
  status?: string;

  /** Quando o QR expira. `null` ou ausente = operação NÃO-QR. */
  qrExpiresAt?: Date | null;

  /** Marca PIN já validado pelo caller (default null — caller seta após validar). */
  pinValidadoEm?: Date | null;

  /** FK pro OTP desafio (quando tier=ALTO). */
  otpDesafioId?: string | null;

  /** Aparelho vinculado (Fase 3 device binding). */
  aparelhoVinculadoId?: string | null;

  /** Campos do extrato (todos opcionais). */
  merchantId?: string | null;
  merchantNome?: string | null;
  descricao?: string | null;
  categoria?: string | null;
  localCidade?: string | null;
  referenciaExterna?: string | null;

  /** Liberar cross-tenant explicitamente. Default false. */
  permitirCrossTenant?: boolean;

  /**
   * Override do jti (uso restrito a testes que precisam de jti determinístico).
   * Em produção SEMPRE deixe undefined → helper gera via gerarTokenHex(16).
   */
  jti?: string;
}

export interface TokenTransacaoCriada {
  id: string;
  jti: string;
  tier: TierTokenTransacao;
  motivoStepUp: MotivoStepUp;
  status: string;
}

/**
 * Determina tier do valor (BAIXO | ALTO) baseado no limiar de R$ 50.
 */
export function calcularTier(valorReais: number | Prisma.Decimal): TierTokenTransacao {
  const v = typeof valorReais === 'number' ? valorReais : Number(valorReais);
  return v > LIMIAR_TIER_REAIS ? 'ALTO' : 'BAIXO';
}

/**
 * Determina motivoStepUp baseado em histórico do pagador + tier.
 *
 * Ordem de precedência (decisão Luciano 12/06, Q5):
 *   1. PRIMEIRO_USO — pagador nunca confirmou TokenTransacao antes
 *   2. DESTINATARIO_NOVO — pagador nunca pagou pra este recebedor antes
 *   3. VALOR_ALTO — tier ALTO sem nenhum dos acima
 *   4. null — tier BAIXO sem nenhum dos acima
 *
 * Helper assume que os parâmetros `temHistorico` e `temHistoricoComRecebedor`
 * já foram consultados pelo caller (queries são tx-scoped no caller). Helper
 * NÃO faz queries — só decide o motivo baseado em flags.
 */
export function determinarMotivoStepUp(params: {
  tier: TierTokenTransacao;
  temHistorico: boolean;
  temHistoricoComRecebedor: boolean;
}): MotivoStepUp {
  if (!params.temHistorico) return 'PRIMEIRO_USO';
  if (!params.temHistoricoComRecebedor) return 'DESTINATARIO_NOVO';
  if (params.tier === 'ALTO') return 'VALOR_ALTO';
  return null;
}

/**
 * Cria registro TokenTransacao com jti + tier + motivoStepUp.
 *
 * Roda DENTRO da tx Serializable do caller (recebe `tx` como param). Helper
 * não abre tx própria — atomicidade fica com o caller.
 *
 * Defesa multi-tenant:
 *  - Valida que `pagador.cooperativaId === pagadorCooperativaId` do param
 *    (anti-IDOR, mesmo padrão da `creditar()` linha :110).
 *  - Bloqueia cross-tenant pagador↔recebedor por default. Liberar exige
 *    `permitirCrossTenant: true` explícito.
 *
 * Idempotência:
 *  - jti unique no banco → 2 chamadas com mesmo jti = P2002 violação. Caller
 *    pode tratar (idempotent retry) ou propagar.
 *  - Pra retry idempotente, caller deve passar o MESMO jti das chamadas
 *    anteriores (não gerar novo a cada vez). Em produção, jti vem do estado
 *    da operação (ex.: persistido em outro lugar antes do retry).
 */
export async function criarTokenTransacao(
  tx: Prisma.TransactionClient,
  params: CriarTokenTransacaoParams,
): Promise<TokenTransacaoCriada> {
  // Guard 1: pagador existe e pertence ao tenant declarado.
  const pagador = await tx.cooperado.findUnique({
    where: { id: params.pagadorId },
    select: { id: true, cooperativaId: true },
  });
  if (!pagador) {
    throw new Error(
      `criarTokenTransacao: pagador ${params.pagadorId} não encontrado.`,
    );
  }
  if (pagador.cooperativaId !== params.pagadorCooperativaId) {
    throw new Error(
      `criarTokenTransacao: cross-tenant bloqueado — pagador ${params.pagadorId} pertence a ${pagador.cooperativaId}, mas operação declarou ${params.pagadorCooperativaId}.`,
    );
  }

  // Guard 2: cross-tenant pagador↔recebedor (quando há recebedor).
  if (
    params.recebedorId &&
    params.recebedorCooperativaId &&
    params.recebedorCooperativaId !== params.pagadorCooperativaId &&
    !params.permitirCrossTenant
  ) {
    throw new Error(
      `criarTokenTransacao: cross-tenant pagador↔recebedor bloqueado (pagador=${params.pagadorCooperativaId}, recebedor=${params.recebedorCooperativaId}). Passe permitirCrossTenant:true se for intencional.`,
    );
  }

  // Guard 3: recebedor (se informado) existe e pertence ao tenant declarado.
  if (params.recebedorId) {
    const recebedor = await tx.cooperado.findUnique({
      where: { id: params.recebedorId },
      select: { id: true, cooperativaId: true },
    });
    if (!recebedor) {
      throw new Error(
        `criarTokenTransacao: recebedor ${params.recebedorId} não encontrado.`,
      );
    }
    if (
      params.recebedorCooperativaId &&
      recebedor.cooperativaId !== params.recebedorCooperativaId
    ) {
      throw new Error(
        `criarTokenTransacao: recebedor ${params.recebedorId} pertence a ${recebedor.cooperativaId}, mas operação declarou ${params.recebedorCooperativaId}.`,
      );
    }
  }

  // Calcular tier + buscar histórico pra motivoStepUp.
  const tier = calcularTier(params.valorReaisEstimado);

  const totalConfirmadas = await tx.tokenTransacao.count({
    where: {
      pagadorId: params.pagadorId,
      pagadorCooperativaId: params.pagadorCooperativaId,
      status: 'CONFIRMADA',
    },
  });
  const temHistorico = totalConfirmadas > 0;

  let temHistoricoComRecebedor = false;
  if (params.recebedorId && temHistorico) {
    const totalComRecebedor = await tx.tokenTransacao.count({
      where: {
        pagadorId: params.pagadorId,
        pagadorCooperativaId: params.pagadorCooperativaId,
        recebedorId: params.recebedorId,
        status: 'CONFIRMADA',
      },
    });
    temHistoricoComRecebedor = totalComRecebedor > 0;
  } else if (!params.recebedorId) {
    // Sem recebedor (ex.: uso-fatura, resgate) → trata como "tem histórico
    // com recebedor" pra não disparar DESTINATARIO_NOVO em ops sem destinatário.
    temHistoricoComRecebedor = true;
  }

  const motivoStepUp = determinarMotivoStepUp({
    tier,
    temHistorico,
    temHistoricoComRecebedor,
  });

  const jti = params.jti ?? gerarTokenHex(16);

  const created = await tx.tokenTransacao.create({
    data: {
      jti,
      pagadorId: params.pagadorId,
      pagadorCooperativaId: params.pagadorCooperativaId,
      recebedorId: params.recebedorId ?? null,
      recebedorCooperativaId: params.recebedorCooperativaId ?? null,
      quantidadeTokens: params.quantidadeTokens,
      valorReaisEstimado: params.valorReaisEstimado,
      tier,
      motivoStepUp,
      status: params.status ?? 'PENDENTE_PIN',
      qrExpiresAt: params.qrExpiresAt ?? null,
      pinValidadoEm: params.pinValidadoEm ?? null,
      otpDesafioId: params.otpDesafioId ?? null,
      aparelhoVinculadoId: params.aparelhoVinculadoId ?? null,
      merchantId: params.merchantId ?? null,
      merchantNome: params.merchantNome ?? null,
      descricao: params.descricao ?? null,
      categoria: params.categoria ?? null,
      localCidade: params.localCidade ?? null,
      referenciaExterna: params.referenciaExterna ?? null,
              tipoOperacao: params.tipoOperacao,
    },
    select: {
      id: true,
      jti: true,
      tier: true,
      motivoStepUp: true,
      status: true,
    },
  });

  return {
    id: created.id,
    jti: created.jti,
    tier: created.tier as TierTokenTransacao,
    motivoStepUp: (created.motivoStepUp ?? null) as MotivoStepUp,
    status: created.status,
  };
}
