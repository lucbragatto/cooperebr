import { Injectable, Logger } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma.service';

/**
 * Lançamentos contábeis automáticos para operações de CooperToken.
 *
 * Contas utilizadas (criadas automaticamente se não existirem):
 * - 5.1.01 Custo Desconto Concedido (DESPESA)
 * - 5.1.02 Passivo Tokens a Resgatar (DESPESA — ⚠️ tipo deveria PASSIVO;
 *           bug pré-existente; corrigir em sprint contábil dedicada,
 *           D-novo-EMISSAO-ADMIN-CONTABIL P2)
 * - 5.1.03 Despesa de Bonificação CooperToken (DESPESA) — M39 (16/06):
 *          contrapartida da emissão admin em lote (`BONIFICACAO_ADMIN`).
 *          Cooperativa BONIFICA → cria passivo SEM receber dinheiro em
 *          troca (distinto de F2 compra paga = `D Caixa / C Passivo`,
 *          distinto de F1 desconto não-aplicado = template atual errado).
 *          Sprint contábil dedicada vai reclassificar via
 *          `referenciaTabela='EMISSAO_ADMIN_LOTE'`.
 * - 1.2.01 Receita Venda Tokens (RECEITA)
 * - 1.2.02 Receita Tokens Expirados (RECEITA)
 */

interface LancamentoTokenParams {
  cooperativaId: string;
  cooperadoId?: string;
  valor: number;
  /** Competência YYYY-MM. Default = mês atual (via getCompetencia). */
  competencia?: string;
  descricao: string;
  observacoes?: string;
}

const CONTAS_TOKEN = [
  { codigo: '5.1.01', nome: 'Custo Desconto Concedido', tipo: 'DESPESA', grupo: 'TOKENS' },
  { codigo: '5.1.02', nome: 'Passivo Tokens a Resgatar', tipo: 'DESPESA', grupo: 'TOKENS' },
  // M39 (16/06/2026): conta nova, aditiva. Débito da emissão admin em lote
  // (`BONIFICACAO_ADMIN`) — cooperativa bonifica criando passivo sem entrada
  // de caixa. Distinto de 5.1.01 (desconto concedido a faturas já emitidas).
  { codigo: '5.1.03', nome: 'Despesa de Bonificação CooperToken', tipo: 'DESPESA', grupo: 'TOKENS' },
  { codigo: '1.2.01', nome: 'Receita Venda Tokens', tipo: 'RECEITA', grupo: 'TOKENS' },
  { codigo: '1.2.02', nome: 'Receita Tokens Expirados', tipo: 'RECEITA', grupo: 'TOKENS' },
] as const;

@Injectable()
export class TokenContabilService {
  private readonly logger = new Logger(TokenContabilService.name);

  constructor(private prisma: PrismaService) {}

  /** Garante que as contas de token existem no plano de contas */
  private async garantirContas(cooperativaId?: string): Promise<Map<string, string>> {
    const mapa = new Map<string, string>();
    for (const conta of CONTAS_TOKEN) {
      let existing = await this.prisma.planoContas.findFirst({
        where: { codigo: conta.codigo, cooperativaId: cooperativaId ?? undefined },
      });
      if (!existing) {
        existing = await this.prisma.planoContas.create({
          data: { ...conta, cooperativaId },
        });
        this.logger.log(`Plano de contas criado: ${conta.codigo} - ${conta.nome}`);
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
   * 1. Emissão FATURA_CHEIA_TOKEN
   * D: Custo Desconto Concedido (5.1.01)
   * C: Passivo Tokens a Resgatar (5.1.02)
   */
  async lancarEmissaoFaturaCheia(params: LancamentoTokenParams) {
    const contas = await this.garantirContas(params.cooperativaId);
    const competencia = params.competencia || this.getCompetencia();
    const valor = Math.round(params.valor * 100) / 100;

    const [debito, credito] = await Promise.all([
      this.prisma.lancamentoCaixa.create({
        data: {
          tipo: 'DESPESA',
          descricao: `[Token] D: Custo Desconto Concedido — ${params.descricao}`,
          valor,
          competencia,
          status: 'REALIZADO',
          dataPagamento: new Date(),
          planoContasId: contas.get('5.1.01'),
          cooperadoId: params.cooperadoId,
          cooperativaId: params.cooperativaId,
          observacoes: params.observacoes ?? 'Emissão token fatura-cheia',
        },
      }),
      this.prisma.lancamentoCaixa.create({
        data: {
          tipo: 'RECEITA',
          descricao: `[Token] C: Passivo Tokens a Resgatar — ${params.descricao}`,
          valor,
          competencia,
          status: 'REALIZADO',
          dataPagamento: new Date(),
          planoContasId: contas.get('5.1.02'),
          cooperadoId: params.cooperadoId,
          cooperativaId: params.cooperativaId,
          observacoes: params.observacoes ?? 'Emissão token fatura-cheia (passivo)',
        },
      }),
    ]);

    this.logger.log(`Lançamento contábil emissão fatura-cheia: R$ ${valor} (${params.cooperativaId})`);
    return { debito, credito };
  }

  /**
   * 2. Compra parceiro PAGO
   * D: Caixa (entrada de dinheiro — representada como RECEITA)
   * C: Receita Venda Tokens (1.2.01)
   */
  async lancarCompraParceiroPago(params: LancamentoTokenParams) {
    const contas = await this.garantirContas(params.cooperativaId);
    const competencia = params.competencia || this.getCompetencia();
    const valor = Math.round(params.valor * 100) / 100;

    const lancamento = await this.prisma.lancamentoCaixa.create({
      data: {
        tipo: 'RECEITA',
        descricao: `[Token] Receita Venda Tokens — ${params.descricao}`,
        valor,
        competencia,
        status: 'REALIZADO',
        dataPagamento: new Date(),
        planoContasId: contas.get('1.2.01'),
        cooperadoId: params.cooperadoId,
        cooperativaId: params.cooperativaId,
        observacoes: params.observacoes ?? 'Compra de tokens por parceiro',
      },
    });

    this.logger.log(`Lançamento contábil compra parceiro: R$ ${valor} (${params.cooperativaId})`);
    return lancamento;
  }

  /**
   * 3. Resgate na fatura (usar-na-fatura)
   * D: Passivo Tokens a Resgatar (5.1.02) — baixa do passivo
   */
  async lancarResgateFatura(params: LancamentoTokenParams) {
    const contas = await this.garantirContas(params.cooperativaId);
    const competencia = params.competencia || this.getCompetencia();
    const valor = Math.round(params.valor * 100) / 100;

    const lancamento = await this.prisma.lancamentoCaixa.create({
      data: {
        tipo: 'DESPESA',
        descricao: `[Token] Baixa Passivo Tokens (resgate fatura) — ${params.descricao}`,
        valor,
        competencia,
        status: 'REALIZADO',
        dataPagamento: new Date(),
        planoContasId: contas.get('5.1.02'),
        cooperadoId: params.cooperadoId,
        cooperativaId: params.cooperativaId,
        observacoes: params.observacoes ?? 'Resgate de tokens na fatura (baixa passivo)',
      },
    });

    this.logger.log(`Lançamento contábil resgate fatura: R$ ${valor} (${params.cooperativaId})`);
    return lancamento;
  }

  /**
   * 3b. Sprint D2 (16/06/2026) — Resgate em PIX (estabelecimento OU
   * colaborador via saqueColaboradorAtivo). Fecha D-novo-RESGATE-PIX-
   * SEM-CAIXA P1 (catalogado M40): hoje o webhook PAGO baixa saldo +
   * ledger sem emitir LancamentoCaixa, deixando passivo permanentemente
   * inflado.
   *
   * D: Passivo Tokens a Resgatar (5.1.02) — baixa do passivo
   * (LancamentoCaixa.tipo='DESPESA' = saída de caixa real, contraparte
   *  implícita "C Caixa" do modelo canônico FUNDACAO §2.1.)
   *
   * NOTA TIPAGEM 5.1.02: hoje DESPESA (errada — deveria PASSIVO,
   * catalogado D-novo-EMISSAO-ADMIN-CONTABIL P2). Forward-compatible:
   * quando a sprint contábil corrigir o tipo, todos os lançamentos
   * D 5.1.02 se acertam no balanço sem migration de dados.
   *
   * SPREAD: se cooperativa pagar abaixo do face (taxa>0), `valor` aqui é
   * o líquido pago — o diff face×líquido seria C Receita de Resgate.
   * Hoje taxa=0 por design (cooper-token.service:2086 rejeita taxa>0
   * com erro genérico — bloqueado até D-novo-TAXA-RESGATE-DESTINO P2
   * decidir destino contábil). Spread não implementado nesta sprint.
   */
  async lancarResgatePix(
    params: LancamentoTokenParams & {
      /**
       * P1 reviewer financeiro (16/06): referenciaId/Tabela obrigatórios pra
       * cron de reconciliação (D-novo-F6-RECONCILIACAO-CRON P2) saber se já
       * lançou — sem isso, retry duplicaria LancamentoCaixa pro mesmo recibo.
       */
      referenciaId: string;
      referenciaTabela: string;
    },
  ) {
    // Reviewers (16/06): este método é CHAMADO INTENCIONALMENTE FORA DA
    // TX SERIALIZABLE (Sprint D2 Bloco c — commit garantido de saldo+ledger
    // mesmo se contábil falhar; PIX é irreversível). Usa this.prisma direto,
    // SEM parâmetro tx enganoso que insinuasse tx-safety. Idempotência via
    // findFirst guard por referenciaId+Tabela (cron de reconciliação chama
    // 2× pro mesmo recibo em retry → guard impede duplicação).
    const existente = await this.prisma.lancamentoCaixa.findFirst({
      where: {
        cooperadoId: params.cooperadoId,
        cooperativaId: params.cooperativaId,
        descricao: { startsWith: `[Token] Resgate PIX — ${params.descricao}` },
      },
      select: { id: true },
    });
    if (existente) {
      this.logger.log(
        `lancarResgatePix: idempotência hit — recibo ${params.referenciaId} já tem LancamentoCaixa ${existente.id}, skip.`,
      );
      return existente;
    }

    const contas = await this.garantirContas(params.cooperativaId);
    const competencia = params.competencia ?? this.getCompetencia();
    // P2 reviewer financeiro (16/06): arredondamento defensivo no ponto de
    // origem (mesmo este método já arredondar) — padrão do projeto em valores
    // monetários. Decimal→Number pode introduzir ruído float.
    const valor = Math.round(params.valor * 100) / 100;
    const lancamento = await this.prisma.lancamentoCaixa.create({
      data: {
        tipo: 'DESPESA',
        descricao: `[Token] Resgate PIX — ${params.descricao}`,
        valor,
        competencia,
        status: 'REALIZADO',
        dataPagamento: new Date(),
        planoContasId: contas.get('5.1.02'),
        cooperadoId: params.cooperadoId,
        cooperativaId: params.cooperativaId,
        observacoes:
          params.observacoes ??
          'Resgate de tokens via PIX — D Passivo / C Caixa (FUNDACAO §2.1)',
      },
    });
    this.logger.log(
      `Lançamento contábil resgate PIX: R$ ${valor} ` +
        `(coop=${params.cooperativaId.slice(0, 8)}… recibo=${params.referenciaId.slice(0, 8)}…)`,
    );
    return lancamento;
  }

  /**
   * 4. Expiração de tokens
   * D: Passivo Tokens a Resgatar (5.1.02) — baixa
   * C: Receita Tokens Expirados (1.2.02)
   */
  async lancarExpiracao(params: LancamentoTokenParams) {
    const contas = await this.garantirContas(params.cooperativaId);
    const competencia = params.competencia || this.getCompetencia();
    const valor = Math.round(params.valor * 100) / 100;

    const [baixaPassivo, receita] = await Promise.all([
      this.prisma.lancamentoCaixa.create({
        data: {
          tipo: 'DESPESA',
          descricao: `[Token] Baixa Passivo Tokens (expiração) — ${params.descricao}`,
          valor,
          competencia,
          status: 'REALIZADO',
          dataPagamento: new Date(),
          planoContasId: contas.get('5.1.02'),
          cooperadoId: params.cooperadoId,
          cooperativaId: params.cooperativaId,
          observacoes: params.observacoes ?? 'Expiração de tokens (baixa passivo)',
        },
      }),
      this.prisma.lancamentoCaixa.create({
        data: {
          tipo: 'RECEITA',
          descricao: `[Token] Receita Tokens Expirados — ${params.descricao}`,
          valor,
          competencia,
          status: 'REALIZADO',
          dataPagamento: new Date(),
          planoContasId: contas.get('1.2.02'),
          cooperadoId: params.cooperadoId,
          cooperativaId: params.cooperativaId,
          observacoes: params.observacoes ?? 'Receita de tokens expirados',
        },
      }),
    ]);

    this.logger.log(`Lançamento contábil expiração: R$ ${valor} (${params.cooperativaId})`);
    return { baixaPassivo, receita };
  }

  /**
   * 5. M39 (16/06/2026) — Emissão Admin em Lote (BONIFICACAO_ADMIN)
   *
   * Admin/SUPER_ADMIN/OPERADOR emite tokens novos no ecossistema da
   * cooperativa pra N destinatários — cria passivo SEM entrada de caixa
   * (bonificação concedida pela coop).
   *
   * D: Despesa de Bonificação CooperToken (5.1.03)  ← NOVA, aditiva
   * C: Passivo Tokens a Resgatar (5.1.02)
   *
   * `referenciaTabela='EMISSAO_ADMIN_LOTE'` permite à sprint contábil
   * dedicada localizar e reclassificar TODOS de uma vez quando a conta
   * 5.1.02 for tipada corretamente (DESPESA → PASSIVO).
   *
   * Distinto:
   *  - `lancarEmissaoFaturaCheia` (5.1.01) — desconto NÃO-aplicado.
   *  - `lancarCompraParceiroPago` — F2 compra paga (D Caixa / C Receita).
   *  - Bonificação admin não tem contrapartida de caixa nem receita.
   */
  async lancarEmissaoAdminLote(params: LancamentoTokenParams & { loteId: string }) {
    const contas = await this.garantirContas(params.cooperativaId);
    const competencia = params.competencia || this.getCompetencia();
    const valor = Math.round(params.valor * 100) / 100;

    const [debito, credito] = await Promise.all([
      this.prisma.lancamentoCaixa.create({
        data: {
          tipo: 'DESPESA',
          descricao: `[Token] D: Despesa de Bonificação — ${params.descricao}`,
          valor,
          competencia,
          status: 'REALIZADO',
          dataPagamento: new Date(),
          planoContasId: contas.get('5.1.03'),
          cooperadoId: params.cooperadoId,
          cooperativaId: params.cooperativaId,
          observacoes: `Emissão admin lote ${params.loteId} (BONIFICACAO_ADMIN)`,
        },
      }),
      this.prisma.lancamentoCaixa.create({
        data: {
          tipo: 'RECEITA',
          descricao: `[Token] C: Passivo Tokens a Resgatar — ${params.descricao}`,
          valor,
          competencia,
          status: 'REALIZADO',
          dataPagamento: new Date(),
          planoContasId: contas.get('5.1.02'),
          cooperadoId: params.cooperadoId,
          cooperativaId: params.cooperativaId,
          observacoes: `Emissão admin lote ${params.loteId} (passivo)`,
        },
      }),
    ]);

    this.logger.log(
      `Lançamento contábil emissão admin lote=${params.loteId}: R$ ${valor} (${params.cooperativaId})`,
    );
    return { debito, credito };
  }

  /**
   * 6. M39 (16/06/2026) — Estorno de Emissão Admin em Lote (ESTORNO_BONIFICACAO_ADMIN)
   *
   * Reversa o lançamento contábil da emissão original — espelha o par
   * D/C invertido. NUNCA apaga o lançamento original (trilha auditável).
   *
   * D: Passivo Tokens a Resgatar (5.1.02)         ← baixa passivo
   * C: Despesa de Bonificação CooperToken (5.1.03) ← reversão da despesa
   *
   * `referenciaTabela='ESTORNO_EMISSAO_ADMIN_LOTE'` pra rastreabilidade.
   */
  async lancarEstornoEmissaoAdminLote(params: LancamentoTokenParams & { loteId: string }) {
    const contas = await this.garantirContas(params.cooperativaId);
    const competencia = params.competencia || this.getCompetencia();
    const valor = Math.round(params.valor * 100) / 100;

    const [baixaPassivo, reversaoDespesa] = await Promise.all([
      this.prisma.lancamentoCaixa.create({
        data: {
          tipo: 'DESPESA',
          descricao: `[Token] D: Baixa Passivo (estorno) — ${params.descricao}`,
          valor,
          competencia,
          status: 'REALIZADO',
          dataPagamento: new Date(),
          planoContasId: contas.get('5.1.02'),
          cooperadoId: params.cooperadoId,
          cooperativaId: params.cooperativaId,
          observacoes: `Estorno emissão admin lote ${params.loteId} (baixa passivo)`,
        },
      }),
      this.prisma.lancamentoCaixa.create({
        data: {
          tipo: 'RECEITA',
          descricao: `[Token] C: Reversão Despesa Bonificação — ${params.descricao}`,
          valor,
          competencia,
          status: 'REALIZADO',
          dataPagamento: new Date(),
          planoContasId: contas.get('5.1.03'),
          cooperadoId: params.cooperadoId,
          cooperativaId: params.cooperativaId,
          observacoes: `Estorno emissão admin lote ${params.loteId} (reversão despesa)`,
        },
      }),
    ]);

    this.logger.log(
      `Lançamento contábil estorno admin lote=${params.loteId}: R$ ${valor} (${params.cooperativaId})`,
    );
    return { baixaPassivo, reversaoDespesa };
  }
}
