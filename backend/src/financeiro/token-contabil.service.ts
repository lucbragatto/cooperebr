import { Injectable, Logger } from '@nestjs/common';
import { Prisma, OrigemLancamento } from '@prisma/client';
import { PrismaService } from '../prisma.service';
import { isAmbienteReal } from '../common/safety/ambiente';

/**
 * Lançamentos contábeis automáticos para operações de CooperToken.
 *
 * REVISÃO Sprint Faxina Contábil do Token (22/06/2026 — re-review orquestrador
 * APROVADO). Re-alinhamento ao modelo voucher CPC 47 + ato cooperativo Lei
 * 5.764/71 Art. 79 § único:
 *
 *  - Token = VOUCHER de circuito fechado. Dinheiro que entra é PASSIVO DIFERIDO
 *    (a coop vai honrar), NUNCA receita imediata.
 *  - Receita da coop = MELT (spread + taxa circulação + quebra/expiração).
 *  - "Receita Venda Tokens" (`1.2.01`) APOSENTADA como armadilha tributária.
 *  - `5.1.02 → 2.3.01` (DESPESA → PASSIVO) — Q5 do orquestrador.
 *  - `5.1.10` Custo Desconto Token NOVA — Q6 (colisão com 5.1.01 Usina).
 *  - `1.2.10/11/12` Receitas de MELT criadas mas só usadas se gate liberado
 *    (parecer Walter + tributarista pendente — spec §1.1).
 *
 * Contas usadas:
 *  - **5.1.10** Custo Desconto Token        (DESPESA) ← BONIFICAÇÃO sem caixa
 *  - **5.1.03** Despesa de Bonificação      (DESPESA) ← BONIFICAÇÃO admin
 *  - **2.3.01** Passivo Tokens a Resgatar   (PASSIVO) ← TODOS os passivos
 *  - **1.2.02** Receita Tokens Expirados    (RECEITA) ← melt expiração
 *  - **1.2.10** Receita Spread Resgate      (RECEITA) ← gated
 *  - **1.2.11** Receita Taxa Circulação QR  (RECEITA) ← gated
 *  - **1.2.12** Receita Quebra Oxidação     (RECEITA) ← gated
 */

export const CONTA_PASSIVO_TOKEN = '2.3.01';
export const CONTA_CUSTO_DESCONTO_TOKEN = '5.1.10';
export const CONTA_DESPESA_BONIFICACAO = '5.1.03';
export const CONTA_RECEITA_EXPIRADOS = '1.2.02';
export const CONTA_RECEITA_SPREAD = '1.2.10';
export const CONTA_RECEITA_TAXA_QR = '1.2.11';
export const CONTA_RECEITA_OXIDACAO = '1.2.12';

/**
 * Sprint M52a v2 (23/06/2026) — conformidade P1: tipo do LancamentoCaixa
 * é String no schema (pré-existe 58 lançamentos legados). Pra dar
 * type-safety ao caller sem migration disruptiva, exportamos union
 * literal. Apuração tributária / DRE / livro caixa filtram em RECEITA
 * vs DESPESA — MUTACAO_PASSIVO e MUTACAO_DESPESA são movimentos de
 * BALANÇO (não DRE), portanto ficam fora dos totalizadores P&L.
 */
export type LancamentoCaixaTipo =
  | 'RECEITA'
  | 'DESPESA'
  | 'MUTACAO_PASSIVO'
  | 'MUTACAO_DESPESA'
  | 'PROVISIONAL';

/**
 * Sprint M52b (23/06/2026) — Gate dual MELT.
 *
 * Retorna `true` apenas quando AMBOS:
 *  (1) env `MELT_PRODUCAO_LIBERADA=true` (gate operacional Luciano)
 *  (2) `ConfigCooperToken.meltAtivado=true` (gate por tenant)
 *
 * Em DEV (`isAmbienteReal()=false`), o env é dispensado — facilita smokes.
 * Em PROD, AMBOS são obrigatórios. Default tudo OFF.
 *
 * Quando OFF:
 *  - oxidação: cron já gated por OXIDACAO_PRODUCAO_LIBERADA (mantém)
 *  - taxa QR: `processarPagamentoQr` força liquido=bruto (mata o leak)
 *  - spread resgate: `solicitarResgate` libera valor cheio (sem bloqueio)
 *
 * Quando ON:
 *  - cobra pela `ConfigCooperToken.taxa*Perc`
 *  - dispara `lancarMelt*` correspondente (D 2.3.01 / C 1.2.1x)
 *
 * Sem dependência NestJS — importável por service + cron + scripts.
 */
export function isMeltAtivado(config: { meltAtivado?: boolean | null } | null | undefined): boolean {
  const tenantOn = config?.meltAtivado === true;
  if (!tenantOn) return false;
  if (!isAmbienteReal()) return true; // DEV smokes — gate só pela config
  return process.env.MELT_PRODUCAO_LIBERADA === 'true';
}

interface LancamentoTokenParams {
  cooperativaId: string;
  cooperadoId?: string;
  valor: number;
  /** Competência YYYY-MM. Default = mês atual (via getCompetencia). */
  competencia?: string;
  descricao: string;
  observacoes?: string;
  /**
   * Sprint Faxina Contábil (22/06/2026) — Q4 do orquestrador.
   * Classificação ato cooperativo (Próprio/Auxiliar/NAO_COOPERATIVO).
   * Default `'PROPRIO'` via schema (LancamentoCaixa.naturezaAto).
   */
  naturezaAto?: 'PROPRIO' | 'AUXILIAR' | 'NAO_COOPERATIVO';
}

const CONTAS_TOKEN = [
  { codigo: CONTA_CUSTO_DESCONTO_TOKEN, nome: 'Custo Desconto Token', tipo: 'DESPESA', grupo: 'TOKENS' },
  { codigo: CONTA_DESPESA_BONIFICACAO, nome: 'Despesa de Bonificação CooperToken', tipo: 'DESPESA', grupo: 'TOKENS' },
  { codigo: CONTA_PASSIVO_TOKEN, nome: 'Passivo Tokens a Resgatar', tipo: 'PASSIVO', grupo: 'TOKENS' },
  { codigo: CONTA_RECEITA_EXPIRADOS, nome: 'Receita Tokens Expirados', tipo: 'RECEITA', grupo: 'TOKENS' },
  { codigo: CONTA_RECEITA_SPREAD, nome: 'Receita Spread Resgate Token', tipo: 'RECEITA', grupo: 'TOKENS' },
  { codigo: CONTA_RECEITA_TAXA_QR, nome: 'Receita Taxa Circulação QR', tipo: 'RECEITA', grupo: 'TOKENS' },
  { codigo: CONTA_RECEITA_OXIDACAO, nome: 'Receita Quebra Oxidação', tipo: 'RECEITA', grupo: 'TOKENS' },
] as const;

@Injectable()
export class TokenContabilService {
  private readonly logger = new Logger(TokenContabilService.name);

  constructor(private prisma: PrismaService) {}

  /**
   * Garante que as contas de token existem no plano de contas.
   *
   * Multi-tenant fix (P1 mtenant + financeiro 22/06): cooperativaId
   * OBRIGATÓRIO (era opcional — armadilha). O fallback do P2002 também
   * filtra por cooperativaId — antes retornava conta de outro tenant
   * (P2002 captura colisão global do @unique(codigo), mas o where do
   * findFirst sem cooperativaId vazava o id do outro tenant).
   */
  private async garantirContas(cooperativaId: string): Promise<Map<string, string>> {
    if (!cooperativaId) {
      throw new Error('garantirContas: cooperativaId obrigatório (lição M45).');
    }
    const mapa = new Map<string, string>();
    for (const conta of CONTAS_TOKEN) {
      let existing = await this.prisma.planoContas.findFirst({
        where: { codigo: conta.codigo, cooperativaId },
      });
      if (!existing) {
        try {
          existing = await this.prisma.planoContas.create({
            data: { ...conta, cooperativaId },
          });
          this.logger.log(`Plano de contas criado: ${conta.codigo} - ${conta.nome} (tenant ${cooperativaId.slice(0, 8)}…)`);
        } catch (err) {
          // Schema fix Faxina 22/06: agora @@unique([codigo, cooperativaId]).
          // P2002 só pode disparar em RACE — outra request paralela criou.
          // Re-lê apenas DO PRÓPRIO TENANT (fix P1 multitenant — NUNCA
          // retornar conta de outro tenant).
          const fallback = await this.prisma.planoContas.findFirst({
            where: { codigo: conta.codigo, cooperativaId },
          });
          if (!fallback) {
            this.logger.error(
              `garantirContas: race condition em ${conta.codigo} no tenant ${cooperativaId.slice(0, 8)}… SEM resolução.`,
            );
            throw err;
          }
          existing = fallback;
        }
      }
      mapa.set(conta.codigo, existing.id);
    }
    return mapa;
  }

  private getCompetencia(): string {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  }

  /**
   * SPRINT FAXINA (22/06/2026) — NOVO MÉTODO PRINCIPAL.
   *
   * **INGRESSO PAGO** — empresa cooperada paga por tokens (conveniada).
   *  - **D Caixa** (entrada de dinheiro)
   *  - **C Passivo Tokens a Resgatar** (2.3.01)
   *
   * Substitui `lancarCompraParceiroPago` (D nada / C Receita Venda — half-entry
   * tributário ERRADO) e `lancarEmissaoFaturaCheia` quando o caminho for
   * COMPRA_PJ_COOPERADA (não há "desconto concedido" — há ingresso pago).
   *
   * `naturezaAto` default `'PROPRIO'` se cooperado é PF cooperado; `'AUXILIAR'`
   * se convênio (Art. 88). Promoção `AUXILIAR → PROPRIO` exige documentação
   * (Q4 orquestrador). Tributação real validada por reviewer externo (Walter).
   */
  async lancarIngressoEmissaoPaga(params: LancamentoTokenParams) {
    const contas = await this.garantirContas(params.cooperativaId);
    const competencia = params.competencia || this.getCompetencia();
    const valor = Math.round(params.valor * 100) / 100;
    const naturezaAto = params.naturezaAto || 'PROPRIO';

    // Sprint Faxina C-G (23/06/2026) — Bloco G fix
    // D-novo-FAXINA-PARTIDAS-NAO-ATOMICAS P2: par dupla-partida em
    // $transaction. Se uma perna falhar, ambas revertem (livro balanceado).
    const [debito, credito] = await this.prisma.$transaction([
      this.prisma.lancamentoCaixa.create({
        data: {
          tipo: 'RECEITA', // entrada de caixa (LancamentoCaixa.tipo = movimento)
          descricao: `[Token] D: Caixa (ingresso pago) — ${params.descricao}`,
          valor,
          competencia,
          status: 'REALIZADO',
          dataPagamento: new Date(),
          // Caixa não tem PlanoContas dedicado — null preserva pattern existente
          // (relatórios consideram lançamento sem planoContasId como caixa).
          planoContasId: null,
          naturezaAto,
          cooperadoId: params.cooperadoId,
          cooperativaId: params.cooperativaId,
          observacoes: params.observacoes ?? 'Ingresso pago em tokens (caixa)',
        },
      }),
      this.prisma.lancamentoCaixa.create({
        data: {
          // Re-review orquestrador 23/06: aumento de passivo NÃO é receita
          // (viola NBC TG 1000 item 12.1). Convenção MUTACAO_PASSIVO pra
          // movimentação na conta 2.3.01 — apuração tributária + DRE
          // excluem este tipo do totalReceitas.
          tipo: 'MUTACAO_PASSIVO',
          descricao: `[Token] C: Passivo Tokens a Resgatar (ingresso pago) — ${params.descricao}`,
          valor,
          competencia,
          status: 'REALIZADO',
          dataPagamento: new Date(),
          planoContasId: contas.get(CONTA_PASSIVO_TOKEN),
          naturezaAto,
          cooperadoId: params.cooperadoId,
          cooperativaId: params.cooperativaId,
          observacoes: params.observacoes ?? 'Ingresso pago em tokens (passivo)',
        },
      }),
    ]);

    this.logger.log(
      `[token-contabil] INGRESSO PAGO: R$ ${valor} (${params.cooperativaId.slice(0, 8)}… natureza=${naturezaAto})`,
    );
    return { debito, credito };
  }

  /**
   * SPRINT FAXINA (22/06/2026).
   *
   * **BONIFICAÇÃO DE DESCONTO** — emissão de token vinculada a desconto/crédito
   * (FATURA_CHEIA, FLEX, GERACAO_EXCEDENTE). Coop bonifica sem entrada de caixa.
   *  - **D Custo Desconto Token** (5.1.10)
   *  - **C Passivo Tokens a Resgatar** (2.3.01)
   *
   * Substitui o legado `lancarEmissaoFaturaCheia` que apontava pra 5.1.01
   * (colisão com Usina — 9 lançamentos migrados na Fase A).
   */
  async lancarEmissaoFaturaCheia(params: LancamentoTokenParams) {
    const contas = await this.garantirContas(params.cooperativaId);
    const competencia = params.competencia || this.getCompetencia();
    const valor = Math.round(params.valor * 100) / 100;
    const naturezaAto = params.naturezaAto || 'PROPRIO';

    // Bloco G fix (23/06/2026) — par dupla-partida atomic via $transaction.
    const [debito, credito] = await this.prisma.$transaction([
      this.prisma.lancamentoCaixa.create({
        data: {
          tipo: 'DESPESA',
          descricao: `[Token] D: Custo Desconto Token — ${params.descricao}`,
          valor,
          competencia,
          status: 'REALIZADO',
          dataPagamento: new Date(),
          planoContasId: contas.get(CONTA_CUSTO_DESCONTO_TOKEN),
          naturezaAto,
          cooperadoId: params.cooperadoId,
          cooperativaId: params.cooperativaId,
          observacoes: params.observacoes ?? 'Bonificação de desconto em tokens',
        },
      }),
      this.prisma.lancamentoCaixa.create({
        data: {
          // Re-review orquestrador 23/06: aumento de passivo NÃO é receita
          // (NBC TG 1000 item 12.1). MUTACAO_PASSIVO em conta 2.3.01 é o
          // tipo correto pra apuração tributária + DRE.
          tipo: 'MUTACAO_PASSIVO',
          descricao: `[Token] C: Passivo Tokens a Resgatar — ${params.descricao}`,
          valor,
          competencia,
          status: 'REALIZADO',
          dataPagamento: new Date(),
          planoContasId: contas.get(CONTA_PASSIVO_TOKEN),
          naturezaAto,
          cooperadoId: params.cooperadoId,
          cooperativaId: params.cooperativaId,
          observacoes: params.observacoes ?? 'Bonificação de desconto em tokens (passivo)',
        },
      }),
    ]);

    this.logger.log(
      `[token-contabil] EMISSÃO BONIFICAÇÃO (desconto): R$ ${valor} (${params.cooperativaId.slice(0, 8)}…)`,
    );
    return { debito, credito };
  }

  /**
   * **ABATE NA FATURA** (usar-na-fatura) — uso do voucher.
   *  - **D Passivo Tokens a Resgatar** (2.3.01) — baixa do passivo
   *  - C — contrapartida implícita "Crédito Fatura" (a fatura já abateu)
   *
   * Idempotência (fix P2 financeiro-token 22/06): aceita `origemId` opcional
   * (ex: cobrancaId). Quando vier, usa `@@unique(origemTipo, origemId)` no
   * schema pra impedir double-baixa em caso de retry do listener. Para
   * preservar compat com callers antigos (cobrancas.service), origemId é
   * opcional — sem ele, fica vulnerável a duplicação (catalogado D-novo).
   */
  async lancarResgateFatura(
    params: LancamentoTokenParams & { origemId?: string },
  ) {
    const contas = await this.garantirContas(params.cooperativaId);
    const competencia = params.competencia || this.getCompetencia();
    const valor = Math.round(params.valor * 100) / 100;
    const naturezaAto = params.naturezaAto || 'PROPRIO';

    try {
      const lancamento = await this.prisma.lancamentoCaixa.create({
        data: {
          // Re-review orquestrador 23/06: baixa de passivo NÃO é despesa
          // (NBC TG 1000). MUTACAO_PASSIVO substitui DESPESA pra não distorcer
          // apuração tributária (apuração.service filtra por tipo).
          tipo: 'MUTACAO_PASSIVO',
          descricao: `[Token] D: Baixa Passivo (abate na fatura) — ${params.descricao}`,
          valor,
          competencia,
          status: 'REALIZADO',
          dataPagamento: new Date(),
          planoContasId: contas.get(CONTA_PASSIVO_TOKEN),
          naturezaAto,
          cooperadoId: params.cooperadoId,
          cooperativaId: params.cooperativaId,
          origemTipo: params.origemId ? 'COBRANCA_ABATE_FATURA' : null,
          origemId: params.origemId ?? null,
          observacoes: params.observacoes ?? 'Abate de tokens na fatura (baixa passivo)',
        },
      });

      this.logger.log(
        `[token-contabil] ABATE FATURA: R$ ${valor} (${params.cooperativaId.slice(0, 8)}…)`,
      );
      return lancamento;
    } catch (err) {
      // P2002 idempotência hit — listener replay sobre mesma cobrança.
      const isUniqueViolation =
        typeof err === 'object' &&
        err !== null &&
        (err as { code?: string }).code === 'P2002';
      if (isUniqueViolation && params.origemId) {
        const existente = await this.prisma.lancamentoCaixa.findFirst({
          where: {
            origemTipo: 'COBRANCA_ABATE_FATURA',
            origemId: params.origemId,
            cooperativaId: params.cooperativaId,
          },
          select: { id: true },
        });
        if (existente) {
          this.logger.log(
            `lancarResgateFatura: idempotência hit (cobranca=${params.origemId.slice(0, 8)}…)`,
          );
          return existente;
        }
      }
      throw err;
    }
  }

  /**
   * **RESGATE PIX** (estabelecimento/colaborador). Sprint D2.
   *  - **D Passivo Tokens a Resgatar** (2.3.01) — baixa do passivo
   *
   * SPREAD (face − líquido) é melt → **GATED** (`spread` opcional; quando
   * vier > 0 + tenant com flag receitaMeltAtivada, cria 2 lançamentos:
   * (a) D 2.3.01 valor líquido + (b) C 1.2.10 valor spread). Hoje taxa=0
   * → spread=0 → 1 lançamento só. Ativação real exige parecer Walter.
   *
   * Idempotência via `@@unique([origemTipo, origemId])` no schema.
   */
  async lancarResgatePix(
    params: LancamentoTokenParams & {
      referenciaId: string;
      referenciaTabela: string;
      /** Spread = face − líquido. Gated (default 0). */
      spreadReais?: number;
    },
  ) {
    const contas = await this.garantirContas(params.cooperativaId);
    const competencia = params.competencia ?? this.getCompetencia();
    const valor = Math.round(params.valor * 100) / 100;
    const naturezaAto = params.naturezaAto || 'PROPRIO';
    try {
      const lancamento = await this.prisma.lancamentoCaixa.create({
        data: {
          // Re-review orquestrador 23/06: D Passivo (2.3.01) NÃO é despesa.
          // MUTACAO_PASSIVO substitui DESPESA — saída de caixa do PIX entra
          // em outra perna (não modelada aqui, lançamento atual é só perna D).
          tipo: 'MUTACAO_PASSIVO',
          descricao: `[Token] Resgate PIX — ${params.descricao}`,
          valor,
          competencia,
          status: 'REALIZADO',
          dataPagamento: new Date(),
          planoContasId: contas.get(CONTA_PASSIVO_TOKEN),
          naturezaAto,
          cooperadoId: params.cooperadoId,
          cooperativaId: params.cooperativaId,
          origemTipo: 'TOKEN_TRANSACAO',
          origemId: params.referenciaId,
          observacoes:
            params.observacoes ??
            'Resgate de tokens via PIX — D Passivo / C Caixa (FUNDACAO §2.1)',
        },
      });
      this.logger.log(
        `[token-contabil] RESGATE PIX: R$ ${valor} ` +
          `(coop=${params.cooperativaId.slice(0, 8)}… recibo=${params.referenciaId.slice(0, 8)}…)`,
      );
      return lancamento;
    } catch (err) {
      // P2002 idempotência hit.
      const isUniqueViolation =
        typeof err === 'object' &&
        err !== null &&
        (err as { code?: string }).code === 'P2002';
      if (isUniqueViolation) {
        // Re-review orquestrador 23/06 (P1 mt + code + financeiro):
        // cooperativaId defense-in-depth no fallback de idempotência —
        // alinha com lancarResgateFatura :299-306 (que estava correto).
        const existente = await this.prisma.lancamentoCaixa.findFirst({
          where: {
            origemTipo: 'TOKEN_TRANSACAO',
            origemId: params.referenciaId,
            cooperativaId: params.cooperativaId,
          },
          select: { id: true },
        });
        if (existente) {
          this.logger.log(
            `lancarResgatePix: idempotência hit (recibo=${params.referenciaId.slice(0, 8)}…)`,
          );
          return existente;
        }
      }
      throw err;
    }
  }

  /**
   * **EXPIRAÇÃO** — quebra total (melt).
   *  - **D Passivo Tokens a Resgatar** (2.3.01) — baixa
   *  - **C Receita Tokens Expirados** (1.2.02) — RECEITA (CPC 47 item 56 breakage)
   *
   * Tributação por contraparte (PROPRIO isenta / NAO_COOPERATIVO tributável)
   * pendente parecer Walter (spec §1.1).
   */
  async lancarExpiracao(params: LancamentoTokenParams) {
    const contas = await this.garantirContas(params.cooperativaId);
    const competencia = params.competencia || this.getCompetencia();
    const valor = Math.round(params.valor * 100) / 100;
    const naturezaAto = params.naturezaAto || 'PROPRIO';

    // Bloco G fix (23/06/2026) — par dupla-partida atomic.
    const [baixaPassivo, receita] = await this.prisma.$transaction([
      this.prisma.lancamentoCaixa.create({
        data: {
          // Re-review orquestrador 23/06: baixa de passivo NÃO é despesa.
          // MUTACAO_PASSIVO substitui DESPESA.
          tipo: 'MUTACAO_PASSIVO',
          descricao: `[Token] D: Baixa Passivo (expiração) — ${params.descricao}`,
          valor,
          competencia,
          status: 'REALIZADO',
          dataPagamento: new Date(),
          planoContasId: contas.get(CONTA_PASSIVO_TOKEN),
          naturezaAto,
          cooperadoId: params.cooperadoId,
          cooperativaId: params.cooperativaId,
          observacoes: params.observacoes ?? 'Expiração de tokens (baixa passivo)',
        },
      }),
      this.prisma.lancamentoCaixa.create({
        data: {
          tipo: 'RECEITA',
          descricao: `[Token] C: Receita Tokens Expirados — ${params.descricao}`,
          valor,
          competencia,
          status: 'REALIZADO',
          dataPagamento: new Date(),
          planoContasId: contas.get(CONTA_RECEITA_EXPIRADOS),
          naturezaAto,
          cooperadoId: params.cooperadoId,
          cooperativaId: params.cooperativaId,
          observacoes: params.observacoes ?? 'Receita de tokens expirados',
        },
      }),
    ]);

    this.logger.log(`[token-contabil] EXPIRAÇÃO: R$ ${valor} (${params.cooperativaId.slice(0, 8)}…)`);
    return { baixaPassivo, receita };
  }

  /**
   * **EMISSÃO ADMIN EM LOTE** (M39 — BONIFICACAO_ADMIN).
   * Admin emite tokens novos sem entrada de caixa.
   *  - **D Despesa de Bonificação** (5.1.03)
   *  - **C Passivo Tokens a Resgatar** (2.3.01)
   */
  async lancarEmissaoAdminLote(params: LancamentoTokenParams & { loteId: string }) {
    const contas = await this.garantirContas(params.cooperativaId);
    const competencia = params.competencia || this.getCompetencia();
    const valor = Math.round(params.valor * 100) / 100;
    const naturezaAto = params.naturezaAto || 'PROPRIO';

    // Bloco G fix (23/06/2026) — par dupla-partida atomic.
    const [debito, credito] = await this.prisma.$transaction([
      this.prisma.lancamentoCaixa.create({
        data: {
          tipo: 'DESPESA',
          descricao: `[Token] D: Despesa de Bonificação — ${params.descricao}`,
          valor,
          competencia,
          status: 'REALIZADO',
          dataPagamento: new Date(),
          planoContasId: contas.get(CONTA_DESPESA_BONIFICACAO),
          naturezaAto,
          cooperadoId: params.cooperadoId,
          cooperativaId: params.cooperativaId,
          observacoes: `Emissão admin lote ${params.loteId} (BONIFICACAO_ADMIN)`,
        },
      }),
      this.prisma.lancamentoCaixa.create({
        data: {
          // Re-review orquestrador 23/06: aumento de passivo NÃO é receita
          // (NBC TG 1000 item 12.1). MUTACAO_PASSIVO em conta 2.3.01.
          tipo: 'MUTACAO_PASSIVO',
          descricao: `[Token] C: Passivo Tokens a Resgatar — ${params.descricao}`,
          valor,
          competencia,
          status: 'REALIZADO',
          dataPagamento: new Date(),
          planoContasId: contas.get(CONTA_PASSIVO_TOKEN),
          naturezaAto,
          cooperadoId: params.cooperadoId,
          cooperativaId: params.cooperativaId,
          observacoes: `Emissão admin lote ${params.loteId} (passivo)`,
        },
      }),
    ]);

    this.logger.log(
      `[token-contabil] EMISSÃO ADMIN LOTE=${params.loteId}: R$ ${valor} (${params.cooperativaId.slice(0, 8)}…)`,
    );
    return { debito, credito };
  }

  /**
   * **ESTORNO emissão admin** — reversão espelhada.
   *  - **D Passivo** / **C Despesa Bonificação**
   */
  async lancarEstornoEmissaoAdminLote(params: LancamentoTokenParams & { loteId: string }) {
    const contas = await this.garantirContas(params.cooperativaId);
    const competencia = params.competencia || this.getCompetencia();
    const valor = Math.round(params.valor * 100) / 100;
    const naturezaAto = params.naturezaAto || 'PROPRIO';

    // Bloco G fix (23/06/2026) — par dupla-partida atomic.
    const [baixaPassivo, reversaoDespesa] = await this.prisma.$transaction([
      this.prisma.lancamentoCaixa.create({
        data: {
          // Re-review orquestrador 23/06: baixa de passivo NÃO é despesa.
          // MUTACAO_PASSIVO substitui DESPESA na conta 2.3.01.
          tipo: 'MUTACAO_PASSIVO',
          descricao: `[Token] D: Baixa Passivo (estorno) — ${params.descricao}`,
          valor,
          competencia,
          status: 'REALIZADO',
          dataPagamento: new Date(),
          planoContasId: contas.get(CONTA_PASSIVO_TOKEN),
          naturezaAto,
          cooperadoId: params.cooperadoId,
          cooperativaId: params.cooperativaId,
          observacoes: `Estorno emissão admin lote ${params.loteId} (baixa passivo)`,
        },
      }),
      this.prisma.lancamentoCaixa.create({
        data: {
          // Re-review orquestrador 23/06: reversão de despesa NÃO é receita
          // (cancela despesa anterior, não gera ingresso). MUTACAO_DESPESA
          // mantém o lançamento espelhado da despesa original sem inflar
          // apuração tributária com receita fantasma.
          tipo: 'MUTACAO_DESPESA',
          descricao: `[Token] C: Reversão Despesa Bonificação — ${params.descricao}`,
          valor,
          competencia,
          status: 'REALIZADO',
          dataPagamento: new Date(),
          planoContasId: contas.get(CONTA_DESPESA_BONIFICACAO),
          naturezaAto,
          cooperadoId: params.cooperadoId,
          cooperativaId: params.cooperativaId,
          observacoes: `Estorno emissão admin lote ${params.loteId} (reversão despesa)`,
        },
      }),
    ]);

    this.logger.log(
      `[token-contabil] ESTORNO ADMIN LOTE=${params.loteId}: R$ ${valor} (${params.cooperativaId.slice(0, 8)}…)`,
    );
    return { baixaPassivo, reversaoDespesa };
  }

  // ════════════════════════════════════════════════════════════════════
  //  Sprint M52b Bloco F MELT (23/06/2026) — D-novo-FAXINA-MELT-F.
  //
  //  3 métodos contábeis pro circuito de RECEITA do token:
  //    - lancarMeltOxidacao    → D 2.3.01 / C 1.2.12 (Receita Quebra)
  //    - lancarMeltTaxaQR      → D 2.3.01 / C 1.2.11 (Receita Taxa QR)
  //    - lancarMeltSpreadResgate → D 2.3.01 / C 1.2.10 (Receita Spread)
  //
  //  TODOS atomic via $transaction + idempotentes via
  //  `@@unique(origemTipo, origemId)` no LancamentoCaixa.
  //
  //  CALLER deve verificar `isMeltAtivado(config)` ANTES de chamar — esses
  //  métodos NÃO checam o gate (responsabilidade do caller pra simplificar
  //  fluxo: gate OFF nem entra na perna contábil, gate ON cobra E lança).
  //
  //  Receita = tributação por contraparte (Walter pendente):
  //    - PROPRIO Art. 79: isento PIS/COFINS+IRPJ (cooperado típico).
  //    - AUXILIAR Art. 88: incide sobre spread se convênio.
  //    - NAO_COOPERATIVO Art. 86-87: tributação plena.
  // ════════════════════════════════════════════════════════════════════

  /**
   * MELT por OXIDAÇÃO (decay mensal). Caller: `aplicarOxidacao` (cron).
   *  - D Passivo 2.3.01 (baixa)
   *  - C Receita Quebra Oxidação 1.2.12
   *
   * Idempotência via `origemTipo='LEDGER_OXIDACAO' + origemId=ledgerId`
   * (cada ledger OXIDACAO gera no máximo 1 par contábil).
   */
  async lancarMeltOxidacao(
    params: LancamentoTokenParams & { ledgerOxidacaoId: string },
  ) {
    const contas = await this.garantirContas(params.cooperativaId);
    const competencia = params.competencia || this.getCompetencia();
    const valor = Math.round(params.valor * 100) / 100;
    const naturezaAto = params.naturezaAto || 'PROPRIO';
    try {
      const [baixaPassivo, receita] = await this.prisma.$transaction([
        this.prisma.lancamentoCaixa.create({
          data: {
            tipo: 'MUTACAO_PASSIVO',
            descricao: `[Token] D: Baixa Passivo (oxidação) — ${params.descricao}`,
            valor,
            competencia,
            status: 'REALIZADO',
            dataPagamento: new Date(),
            planoContasId: contas.get(CONTA_PASSIVO_TOKEN),
            naturezaAto,
            cooperadoId: params.cooperadoId,
            cooperativaId: params.cooperativaId,
            origemTipo: 'LEDGER_OXIDACAO',
            origemId: params.ledgerOxidacaoId,
            observacoes: params.observacoes ?? 'Melt oxidação — baixa passivo',
          },
        }),
        this.prisma.lancamentoCaixa.create({
          data: {
            tipo: 'RECEITA',
            descricao: `[Token] C: Receita Quebra Oxidação — ${params.descricao}`,
            valor,
            competencia,
            status: 'REALIZADO',
            dataPagamento: new Date(),
            planoContasId: contas.get(CONTA_RECEITA_OXIDACAO),
            naturezaAto,
            cooperadoId: params.cooperadoId,
            cooperativaId: params.cooperativaId,
            origemTipo: 'LEDGER_OXIDACAO_RECEITA',
            origemId: params.ledgerOxidacaoId,
            observacoes: params.observacoes ?? 'Melt oxidação — receita quebra',
          },
        }),
      ]);
      this.logger.log(
        `[token-contabil] MELT OXIDAÇÃO: R$ ${valor} (${params.cooperativaId.slice(0, 8)}… ledger=${params.ledgerOxidacaoId.slice(0, 8)}…)`,
      );
      return { baixaPassivo, receita };
    } catch (err) {
      return this.idempotencyFallback(
        err,
        params.cooperativaId,
        OrigemLancamento.LEDGER_OXIDACAO,
        OrigemLancamento.LEDGER_OXIDACAO_RECEITA,
        params.ledgerOxidacaoId,
        'lancarMeltOxidacao',
      );
    }
  }

  /**
   * MELT por TAXA QR (P2P circulação). Caller: `processarPagamentoQr`.
   *  - D Passivo 2.3.01 (a taxa "sai" do passivo total — o pagador debitou
   *    bruto, recebedor recebe líquido; a taxa que sumia agora vira receita)
   *  - C Receita Taxa Circulação QR 1.2.11
   *
   * Idempotência: `origemTipo='TOKEN_TRANSACAO_TAXA' + origemId=tokenTransacao.id`
   * (jti único pelo helper criarTokenTransacao).
   */
  async lancarMeltTaxaQR(
    params: LancamentoTokenParams & { tokenTransacaoId: string },
  ) {
    const contas = await this.garantirContas(params.cooperativaId);
    const competencia = params.competencia || this.getCompetencia();
    const valor = Math.round(params.valor * 100) / 100;
    const naturezaAto = params.naturezaAto || 'PROPRIO';
    if (valor <= 0) {
      // Taxa zero é caminho normal (gate OFF). Nenhum lançamento.
      return null;
    }
    try {
      const [baixaPassivo, receita] = await this.prisma.$transaction([
        this.prisma.lancamentoCaixa.create({
          data: {
            tipo: 'MUTACAO_PASSIVO',
            descricao: `[Token] D: Baixa Passivo (taxa QR) — ${params.descricao}`,
            valor,
            competencia,
            status: 'REALIZADO',
            dataPagamento: new Date(),
            planoContasId: contas.get(CONTA_PASSIVO_TOKEN),
            naturezaAto,
            cooperadoId: params.cooperadoId,
            cooperativaId: params.cooperativaId,
            origemTipo: 'TOKEN_TRANSACAO_TAXA',
            origemId: params.tokenTransacaoId,
            observacoes: params.observacoes ?? 'Melt taxa QR — baixa passivo',
          },
        }),
        this.prisma.lancamentoCaixa.create({
          data: {
            tipo: 'RECEITA',
            descricao: `[Token] C: Receita Taxa Circulação QR — ${params.descricao}`,
            valor,
            competencia,
            status: 'REALIZADO',
            dataPagamento: new Date(),
            planoContasId: contas.get(CONTA_RECEITA_TAXA_QR),
            naturezaAto,
            cooperadoId: params.cooperadoId,
            cooperativaId: params.cooperativaId,
            origemTipo: 'TOKEN_TRANSACAO_TAXA_RECEITA',
            origemId: params.tokenTransacaoId,
            observacoes: params.observacoes ?? 'Melt taxa QR — receita',
          },
        }),
      ]);
      this.logger.log(
        `[token-contabil] MELT TAXA QR: R$ ${valor} (${params.cooperativaId.slice(0, 8)}… tx=${params.tokenTransacaoId.slice(0, 8)}…)`,
      );
      return { baixaPassivo, receita };
    } catch (err) {
      return this.idempotencyFallback(
        err,
        params.cooperativaId,
        OrigemLancamento.TOKEN_TRANSACAO_TAXA,
        OrigemLancamento.TOKEN_TRANSACAO_TAXA_RECEITA,
        params.tokenTransacaoId,
        'lancarMeltTaxaQR',
      );
    }
  }

  /**
   * MELT por SPREAD RESGATE (haircut na saída via PIX). Caller:
   * `cooper-token.service.ts:processarWebhookResgate` ou wire equivalente
   * que confirma o PIX e tem o spread em R$ (face × valorToken − líquido).
   *  - D Passivo 2.3.01 (a parcela do haircut)
   *  - C Receita Spread Resgate 1.2.10
   *
   * Idempotência: `origemTipo='RESGATE_RECIBO_SPREAD' + origemId=resgateRecibo.id`.
   */
  async lancarMeltSpreadResgate(
    params: LancamentoTokenParams & { resgateReciboId: string },
  ) {
    const contas = await this.garantirContas(params.cooperativaId);
    const competencia = params.competencia || this.getCompetencia();
    const valor = Math.round(params.valor * 100) / 100;
    const naturezaAto = params.naturezaAto || 'PROPRIO';
    if (valor <= 0) {
      return null;
    }
    try {
      const [baixaPassivo, receita] = await this.prisma.$transaction([
        this.prisma.lancamentoCaixa.create({
          data: {
            tipo: 'MUTACAO_PASSIVO',
            descricao: `[Token] D: Baixa Passivo (spread resgate) — ${params.descricao}`,
            valor,
            competencia,
            status: 'REALIZADO',
            dataPagamento: new Date(),
            planoContasId: contas.get(CONTA_PASSIVO_TOKEN),
            naturezaAto,
            cooperadoId: params.cooperadoId,
            cooperativaId: params.cooperativaId,
            origemTipo: 'RESGATE_RECIBO_SPREAD',
            origemId: params.resgateReciboId,
            observacoes: params.observacoes ?? 'Melt spread resgate — baixa passivo',
          },
        }),
        this.prisma.lancamentoCaixa.create({
          data: {
            tipo: 'RECEITA',
            descricao: `[Token] C: Receita Spread Resgate — ${params.descricao}`,
            valor,
            competencia,
            status: 'REALIZADO',
            dataPagamento: new Date(),
            planoContasId: contas.get(CONTA_RECEITA_SPREAD),
            naturezaAto,
            cooperadoId: params.cooperadoId,
            cooperativaId: params.cooperativaId,
            origemTipo: 'RESGATE_RECIBO_SPREAD_RECEITA',
            origemId: params.resgateReciboId,
            observacoes: params.observacoes ?? 'Melt spread resgate — receita',
          },
        }),
      ]);
      this.logger.log(
        `[token-contabil] MELT SPREAD RESGATE: R$ ${valor} (${params.cooperativaId.slice(0, 8)}… recibo=${params.resgateReciboId.slice(0, 8)}…)`,
      );
      return { baixaPassivo, receita };
    } catch (err) {
      return this.idempotencyFallback(
        err,
        params.cooperativaId,
        OrigemLancamento.RESGATE_RECIBO_SPREAD,
        OrigemLancamento.RESGATE_RECIBO_SPREAD_RECEITA,
        params.resgateReciboId,
        'lancarMeltSpreadResgate',
      );
    }
  }

  /**
   * Sprint M52b Fatia 2 (23/06/2026) — D-novo-FAXINA-CONTABIL-LEDGER-ALIGN.
   *
   * Espelho contábil de uma entrada de ledger de RECONCILIACAO_HISTORICA
   * (ajuste APPEND-ONLY do script faxina-d). Cria o par D+C que faltou
   * (ledger v2 criou só CooperTokenLedger; o passivo 2.3.01 não foi
   * atualizado, gerando resíduo medido em R$ 116,55 = R$ 49 × 0,45 +
   * R$ 210 × 0,45 nos +259 do LUCIANO + AMAGES).
   *
   *  - D Despesa de Bonificação 5.1.03 (admin pagou pelo ajuste do passado)
   *  - C Passivo Tokens a Resgatar 2.3.01 (aumento de passivo pra alinhar
   *    com o saldo real)
   *
   * Idempotência via `origemTipo='RECONCILIACAO_HISTORICA' + origemId=
   * '2026-06-23-FAXINA-D-v2-{cooperadoId}'`. Rodar 2× não duplica.
   *
   * naturezaAto='PROPRIO' por default (cooperado ATIVO Art. 79). Override
   * permitido pra casos específicos (não esperado nesta sprint).
   */
  async lancarAjusteReconciliacao(
    params: LancamentoTokenParams & { origemReconciliacaoId: string },
  ) {
    const contas = await this.garantirContas(params.cooperativaId);
    const competencia = params.competencia || this.getCompetencia();
    const valor = Math.round(params.valor * 100) / 100;
    const naturezaAto = params.naturezaAto || 'PROPRIO';
    if (valor <= 0) return null;
    try {
      const [debito, credito] = await this.prisma.$transaction([
        this.prisma.lancamentoCaixa.create({
          data: {
            tipo: 'DESPESA',
            descricao: `[Token] D: Despesa Bonificação (ajuste reconciliação) — ${params.descricao}`,
            valor,
            competencia,
            status: 'REALIZADO',
            dataPagamento: new Date(),
            planoContasId: contas.get(CONTA_DESPESA_BONIFICACAO),
            naturezaAto,
            cooperadoId: params.cooperadoId,
            cooperativaId: params.cooperativaId,
            origemTipo: 'RECONCILIACAO_HISTORICA',
            origemId: params.origemReconciliacaoId,
            observacoes: params.observacoes ?? 'Ajuste contábil reconciliação histórica (espelho do ledger v2)',
          },
        }),
        this.prisma.lancamentoCaixa.create({
          data: {
            tipo: 'MUTACAO_PASSIVO',
            descricao: `[Token] C: Passivo Tokens a Resgatar (ajuste reconciliação) — ${params.descricao}`,
            valor,
            competencia,
            status: 'REALIZADO',
            dataPagamento: new Date(),
            planoContasId: contas.get(CONTA_PASSIVO_TOKEN),
            naturezaAto,
            cooperadoId: params.cooperadoId,
            cooperativaId: params.cooperativaId,
            origemTipo: 'RECONCILIACAO_HISTORICA_PASSIVO',
            origemId: params.origemReconciliacaoId,
            observacoes: params.observacoes ?? 'Ajuste contábil reconciliação histórica (aumento passivo)',
          },
        }),
      ]);
      this.logger.log(
        `[token-contabil] AJUSTE RECONCILIAÇÃO: R$ ${valor} (${params.cooperativaId.slice(0, 8)}… origemId=${params.origemReconciliacaoId})`,
      );
      return { debito, credito };
    } catch (err) {
      return this.idempotencyFallback(
        err,
        params.cooperativaId,
        OrigemLancamento.RECONCILIACAO_HISTORICA,
        OrigemLancamento.RECONCILIACAO_HISTORICA_PASSIVO,
        params.origemReconciliacaoId,
        'lancarAjusteReconciliacao',
      );
    }
  }

  /**
   * Sprint M52b F4 F1 (24/06/2026) — fix multitenant P1 + financeiro P3:
   * verificar AMBAS pernas D+C do par dupla-partida no fallback de
   * idempotência. Antes só verificava o origemTipo D → half-write
   * hipotético (D commitado mas C não) era declarado "idempotente" e
   * a perna C nunca era recriada — livro desbalanceado silenciosamente.
   *
   * Agora: P2002 → findFirst D AND findFirst C. Se ambos existem,
   * idempotência completa. Se só um existe (half-write detectado),
   * THROW EXPLÍCITO — alerta forte pra cron de invariante detectar.
   *
   * Tipo `OrigemLancamento` (não string) — fix mt P2 (eliminar `as any`).
   */
  private async idempotencyFallback(
    err: unknown,
    cooperativaId: string,
    debitoOrigemTipo: OrigemLancamento,
    creditoOrigemTipo: OrigemLancamento,
    origemId: string,
    metodo: string,
  ) {
    const isUniqueViolation =
      typeof err === 'object' &&
      err !== null &&
      (err as { code?: string }).code === 'P2002';
    if (!isUniqueViolation) throw err;
    const [debito, credito] = await Promise.all([
      this.prisma.lancamentoCaixa.findFirst({
        where: { origemTipo: debitoOrigemTipo, origemId, cooperativaId },
        select: { id: true },
      }),
      this.prisma.lancamentoCaixa.findFirst({
        where: { origemTipo: creditoOrigemTipo, origemId, cooperativaId },
        select: { id: true },
      }),
    ]);
    if (debito && credito) {
      // Idempotência completa (ambas pernas commitadas).
      this.logger.log(
        `${metodo}: idempotência hit (origemId=${origemId.slice(0, 8)}…) — par D+C completo`,
      );
      return { debito, credito };
    }
    // Half-write detectado — uma perna existe sem a outra. NÃO silenciar.
    // Throw original do P2002 com contexto adicional pra cron de invariante
    // contábil↔saldo (M52b Fatia 2) detectar e alertar admin.
    this.logger.error(
      `[${metodo}] HALF-WRITE detectado pra origemId=${origemId.slice(0, 8)}… ` +
        `cooperativaId=${cooperativaId.slice(0, 8)}… ` +
        `(D=${debito ? 'OK' : 'MISSING'}, C=${credito ? 'OK' : 'MISSING'}). ` +
        `Livro desbalanceado — invariante contábil↔saldo vai detectar. ` +
        `Não silenciado pra forçar visibilidade.`,
    );
    throw err;
  }
}
