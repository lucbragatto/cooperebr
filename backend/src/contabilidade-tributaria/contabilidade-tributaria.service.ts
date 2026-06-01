import { BadRequestException, Injectable, Logger, NotFoundException, Optional } from '@nestjs/common';
import { NaturezaCooperativa, OrigemLancamento, Prisma, TipoRegimeContabil } from '@prisma/client';
import { PrismaService } from '../prisma.service';
import { runAsPlatform } from '../common/tenant-context';
import { RegimeContabilFactory } from './regimes/regime.factory';
import { FonteLancamento } from './regimes/regime-contabil.interface';
import { ApuracaoService } from './apuracao.service';

/**
 * D-novo-BR-CT CT.2+CT.3 (31/05/2026) — Service nuclear da contabilidade
 * tributária segregada.
 *
 * CT.2: classificação determinística (regime resolve fonte → natureza).
 * CT.3: hook automático que cria LancamentoCaixa classificado a partir
 *       de eventos upstream (Cobranca/ContaAPagar/RepasseProprietario
 *       PAGOS). Idempotente via @@unique([origemTipo, origemId]).
 * CT.4 (gate de validação fiscal): motor de apuração tributária real.
 */
@Injectable()
export class ContabilidadeTributariaService {
  private readonly logger = new Logger(ContabilidadeTributariaService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly factory: RegimeContabilFactory,
    @Optional() private readonly apuracaoService?: ApuracaoService,
  ) {}

  /**
   * Classifica a natureza cooperativa de um lançamento a partir da fonte
   * upstream + tenant. Resolve o regime via factory e delega.
   * Função pura (sem efeito colateral).
   */
  async classificarLancamento(
    cooperativaId: string,
    fonte: FonteLancamento,
  ): Promise<NaturezaCooperativa> {
    const coop = await this.prisma.cooperativa.findUnique({
      where: { id: cooperativaId },
      select: { id: true, regimeContabil: true },
    });
    if (!coop) throw new NotFoundException('Cooperativa não encontrada');

    const regime = this.factory.resolve(coop.regimeContabil);
    return regime.classificarLancamento(fonte);
  }

  /**
   * D-novo-BR-CT CT.3 — Hook automático: cria LancamentoCaixa classificado.
   *
   * Idempotente: @@unique([origemTipo, origemId]) garante 1 lançamento por
   * evento upstream. P2002 (violação unique) é tratado como sucesso (já existe).
   *
   * Multi-tenant: cooperativaId vem da FONTE (cobranca.cooperativaId,
   * contaAPagar.cooperativaId, etc) — não do contexto request. Tudo rodando
   * dentro de runAsPlatform pra extension F1.3 não logar TENANT-LEAK.
   *
   * IMPORTANTE: chamar com fire-and-forget no upstream:
   *   service.criarLancamentoAutomatico(...).catch(err =>
   *     logger.error(`Hook contábil falhou: ${err.message}`));
   * NUNCA reverte o pagamento original — falha contábil só loga.
   */
  /**
   * D-novo-BR-CT CT.3 — Helper específico pra RepasseProprietario.
   * Consulta Usina.formaAquisicao + delega pra criarLancamentoAutomatico
   * com a fonte certa. Fire-and-forget no caller.
   */
  async criarLancamentoRepasse(
    repasseId: string,
    cooperativaId: string,
    usinaId: string,
    valorLiquido: Prisma.Decimal,
    dataPagamento: Date,
  ): Promise<{ id: string; criado: boolean; naturezaAto: NaturezaCooperativa }> {
    const usina = await this.prisma.usina.findUnique({
      where: { id: usinaId },
      select: { formaAquisicao: true, nome: true },
    });
    const competencia = `${dataPagamento.getFullYear()}-${String(dataPagamento.getMonth() + 1).padStart(2, '0')}`;
    return this.criarLancamentoAutomatico({
      cooperativaId,
      origemTipo: OrigemLancamento.REPASSE,
      origemId: repasseId,
      fonte: {
        tipo: 'REPASSE_PROPRIETARIO',
        usinaFormaAquisicao: (usina?.formaAquisicao as any) ?? null,
      },
      tipo: 'DESPESA',
      descricao: `[CT] Repasse usina ${usina?.nome ?? usinaId.slice(0, 8)}`,
      valor: valorLiquido,
      competencia,
      dataPagamento,
    });
  }

  /**
   * D-novo-CT-CT.9 (01/06/2026) — Cria LancamentoCaixa AUXILIAR a partir
   * de um movimento manual de Convênio (Art. 88 Lei 5.764/71).
   *
   * SÍNCRONO (NÃO fire-and-forget — é ação direta do usuário). Erros sobem
   * pro caller propagar à UI (gate apuração FECHADA → ConflictException
   * com mensagem legível; P0-1 multi-regime → BadRequest).
   *
   * Sentido do lançamento derivado de `Convenio.fluxoFinanceiro`:
   *  - INGRESSO_CUSTEIO_AUXILIAR → tipo=RECEITA (entrada)
   *  - REPASSE_PROVEDOR_EXTERNO   → tipo=DESPESA (saída pra provedor)
   *  - CUSTO_OPERACIONAL_INTERNO → tipo=DESPESA (custo interno)
   *
   * ENFORCEMENT P0-1: classificação Auxiliar (Art. 88) é exclusiva de
   * COOPERATIVA. Se a cooperativa dona do convênio for de outro regime,
   * bloqueia com BadRequest claro citando D-novo-CT-MULTI-REGIME-CLASSIFICACAO.
   */
  async criarLancamentoConvenio(opts: {
    convenioId: string;
    valor: Prisma.Decimal | number | string;
    dataMovimento: Date;
    /** CT.9.1: competência YYYY-MM já calculada (preferir esta — caller derivou da string original).
     *  Se omitida, deriva de dataMovimento (sujeito a TZ shift). */
    competencia?: string;
    descricao?: string;
    cooperativaId: string;
  }): Promise<{
    id: string;
    naturezaAto: NaturezaCooperativa;
    tipo: 'RECEITA' | 'DESPESA';
    valor: string;
    competencia: string;
    dataPagamento: Date;
    descricao: string;
  }> {
    // Carrega convênio + tipoParceiro da cooperativa dona
    const convenio = await this.prisma.convenio.findFirst({
      where: { id: opts.convenioId, cooperativaId: opts.cooperativaId },
      select: {
        id: true,
        nome: true,
        fluxoFinanceiro: true,
        cooperativaId: true,
        ativo: true,
        cooperativa: {
          select: { tipoParceiro: true, regimeContabil: true, nome: true },
        },
      },
    });
    if (!convenio) {
      throw new NotFoundException(
        `Convênio ${opts.convenioId} não encontrado neste tenant`,
      );
    }
    if (!convenio.ativo) {
      throw new BadRequestException(
        `Convênio "${convenio.nome}" está inativo — reative antes de lançar movimento`,
      );
    }

    // ENFORCEMENT P0-1 multi-regime
    if (
      convenio.cooperativa.tipoParceiro !== 'COOPERATIVA' ||
      convenio.cooperativa.regimeContabil !== TipoRegimeContabil.COOPERATIVO
    ) {
      throw new BadRequestException(
        `Classificação Auxiliar (Art. 88) é exclusiva de cooperativa. ` +
          `${convenio.cooperativa.nome} é ${convenio.cooperativa.tipoParceiro} ` +
          `e recolhe por regime próprio — registrar movimentos de convênio com ` +
          `classificação auxiliar não se aplica. ` +
          `Vide D-novo-CT-MULTI-REGIME-CLASSIFICACAO (P1).`,
      );
    }

    // Sentido do lançamento
    const tipo: 'RECEITA' | 'DESPESA' =
      convenio.fluxoFinanceiro === 'INGRESSO_CUSTEIO_AUXILIAR' ? 'RECEITA' : 'DESPESA';

    // CT.9.1: prefere competencia explícita do caller (string original — sem TZ shift)
    let competencia: string;
    if (opts.competencia && /^\d{4}-\d{2}$/.test(opts.competencia)) {
      competencia = opts.competencia;
    } else {
      // Fallback: deriva da Date (sujeito a TZ shift se dataMovimento veio de UTC parse)
      const ano = opts.dataMovimento.getFullYear();
      const mes = String(opts.dataMovimento.getMonth() + 1).padStart(2, '0');
      competencia = `${ano}-${mes}`;
    }

    // Valor arredondado (CLAUDE.md: Math.round(x*100)/100)
    const valorNum =
      typeof opts.valor === 'string'
        ? Number(opts.valor)
        : typeof opts.valor === 'number'
        ? opts.valor
        : Number(opts.valor.toString());
    const valorArredondado = Math.round(valorNum * 100) / 100;
    if (!isFinite(valorArredondado) || valorArredondado <= 0) {
      throw new BadRequestException('Valor deve ser positivo');
    }

    const descricaoFinal = (opts.descricao?.trim() || `Movimento convênio ${convenio.nome}`).slice(0, 300);

    // origemId precisa ser único por movimento. cuid gerado:
    const origemId = `convmov-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

    const resultado = await this.criarLancamentoAutomatico({
      cooperativaId: opts.cooperativaId,
      origemTipo: OrigemLancamento.CONVENIO,
      origemId,
      fonte: { tipo: 'CONVENIO' },
      tipo,
      descricao: descricaoFinal,
      valor: new Prisma.Decimal(valorArredondado.toString()),
      competencia,
      dataPagamento: opts.dataMovimento,
      convenioContabilId: convenio.id,
    });

    this.logger.log(
      `[CT.9] Movimento convênio criado: convenio=${convenio.id} ${tipo} R$ ${valorArredondado} → ${resultado.naturezaAto} (lanc=${resultado.id})`,
    );

    return {
      id: resultado.id,
      naturezaAto: resultado.naturezaAto,
      tipo,
      valor: valorArredondado.toFixed(2),
      competencia,
      dataPagamento: opts.dataMovimento,
      descricao: descricaoFinal,
    };
  }

  /**
   * D-FISCAL-2.2 (01/06/2026 noite) — Cria LancamentoCaixa a partir de
   * movimento manual do CONVÊNIO CONSOLIDADO (ContratoConvenio, legado MLM
   * + flags fiscais da fatia 2.1).
   *
   * Diferença vs `criarLancamentoConvenio` (CT.9 — Convenio CT.2):
   *  - Lê `ContratoConvenio.naturezaAtoCooperativo` (configurável — D-FISCAL-1)
   *    em vez de derivar via regime cooperativo.
   *  - Exige `geraLancamentoContabil=true` (flag explícita no convênio).
   *  - Grava `LancamentoCaixa.convenioId` (FK pra ContratoConvenio — relation
   *    legada `convenio`) em vez de `convenioContabilId`.
   *  - Coexiste com o caminho antigo (CT.2) até D-FISCAL-2.5 aposentar.
   *
   * 4 ENFORCEMENTS (BadRequest claro em cada):
   *  1. `geraLancamentoContabil=false` → convênio não está marcado pra gerar
   *  2. `naturezaAtoCooperativo=null` → admin não escolheu Próprio/Auxiliar
   *  3. `fluxoFinanceiro=null` → admin não escolheu direção do dinheiro
   *  4. P0-1: naturezaAtoCooperativo ∈ {PROPRIO,AUXILIAR} mas parceiro não-COOPERATIVA
   *
   * PRESERVA fix CT.9.1 (timezone): caller passa `competencia` derivada da
   * STRING original (não da Date), service usa direto.
   *
   * SÍNCRONO + gate apuração FECHADA (reusa CT.4) + idempotência @@unique.
   */
  async criarLancamentoConvenioContrato(opts: {
    contratoConvenioId: string;
    valor: Prisma.Decimal | number | string;
    dataMovimento: Date;
    /** D-FISCAL-2.2: preferir competência da string original (CT.9.1 fix TZ). */
    competencia?: string;
    descricao?: string;
    cooperativaId: string;
  }): Promise<{
    id: string;
    naturezaAto: NaturezaCooperativa;
    tipo: 'RECEITA' | 'DESPESA';
    valor: string;
    competencia: string;
    dataPagamento: Date;
    descricao: string;
  }> {
    // 1. Carrega convênio consolidado + tipoParceiro da cooperativa dona
    const convenio = await this.prisma.contratoConvenio.findFirst({
      where: { id: opts.contratoConvenioId, cooperativaId: opts.cooperativaId },
      select: {
        id: true,
        empresaNome: true,
        status: true,
        geraLancamentoContabil: true,
        naturezaAtoCooperativo: true,
        fluxoFinanceiro: true,
        cooperativaId: true,
      },
    });
    if (!convenio) {
      throw new NotFoundException(
        `Convênio ${opts.contratoConvenioId} não encontrado neste tenant`,
      );
    }
    if (convenio.status !== 'ATIVO') {
      throw new BadRequestException(
        `Convênio "${convenio.empresaNome}" não está ATIVO (status=${convenio.status}) — reative antes de lançar movimento`,
      );
    }

    // 2. ENFORCEMENT #1: flag geraLancamentoContabil
    if (!convenio.geraLancamentoContabil) {
      throw new BadRequestException(
        `Convênio "${convenio.empresaNome}" não está marcado para gerar lançamento contábil. ` +
          `Ative a flag "Gera lançamento contábil" no cadastro do convênio antes de registrar movimentos.`,
      );
    }

    // 3. ENFORCEMENT #2: natureza obrigatória
    if (!convenio.naturezaAtoCooperativo) {
      throw new BadRequestException(
        `Convênio "${convenio.empresaNome}" precisa de natureza do ato definida ` +
          `(Próprio/Auxiliar/Não-Cooperativo) antes de lançar movimento. ` +
          `Edite o convênio e escolha a classificação fiscal (D-FISCAL-1).`,
      );
    }

    // 4. ENFORCEMENT #3: fluxo financeiro obrigatório
    if (!convenio.fluxoFinanceiro) {
      throw new BadRequestException(
        `Convênio "${convenio.empresaNome}" precisa de fluxo financeiro definido ` +
          `(INGRESSO_CUSTEIO_AUXILIAR / REPASSE_PROVEDOR_EXTERNO / CUSTO_OPERACIONAL_INTERNO) antes de lançar movimento.`,
      );
    }

    // 5. ENFORCEMENT #4: P0-1 multi-regime (Próprio/Auxiliar só pra COOPERATIVA)
    const coopFull = await this.prisma.cooperativa.findUnique({
      where: { id: opts.cooperativaId },
      select: { tipoParceiro: true, regimeContabil: true, nome: true },
    });
    if (!coopFull) throw new NotFoundException('Cooperativa não encontrada');
    const naturezaEhCooperativa =
      convenio.naturezaAtoCooperativo === 'PROPRIO' ||
      convenio.naturezaAtoCooperativo === 'AUXILIAR';
    if (
      naturezaEhCooperativa &&
      (coopFull.tipoParceiro !== 'COOPERATIVA' ||
        coopFull.regimeContabil !== TipoRegimeContabil.COOPERATIVO)
    ) {
      throw new BadRequestException(
        `Classificação cooperativa (Art. 79/86/88) é exclusiva de COOPERATIVA. ` +
          `${coopFull.nome} é ${coopFull.tipoParceiro} e recolhe por regime próprio — ` +
          `registrar movimentos como ${convenio.naturezaAtoCooperativo} não se aplica. ` +
          `Vide D-novo-CT-MULTI-REGIME-CLASSIFICACAO (P1).`,
      );
    }

    // 6. Sentido do lançamento derivado do fluxoFinanceiro
    const tipo: 'RECEITA' | 'DESPESA' =
      convenio.fluxoFinanceiro === 'INGRESSO_CUSTEIO_AUXILIAR' ? 'RECEITA' : 'DESPESA';

    // 7. Competência — preferir string do caller (CT.9.1 fix TZ)
    let competencia: string;
    if (opts.competencia && /^\d{4}-\d{2}$/.test(opts.competencia)) {
      competencia = opts.competencia;
    } else {
      const ano = opts.dataMovimento.getFullYear();
      const mes = String(opts.dataMovimento.getMonth() + 1).padStart(2, '0');
      competencia = `${ano}-${mes}`;
    }

    // 8. Valor arredondado (CLAUDE.md: Math.round(x*100)/100)
    const valorNum =
      typeof opts.valor === 'string'
        ? Number(opts.valor)
        : typeof opts.valor === 'number'
        ? opts.valor
        : Number(opts.valor.toString());
    const valorArredondado = Math.round(valorNum * 100) / 100;
    if (!isFinite(valorArredondado) || valorArredondado <= 0) {
      throw new BadRequestException('Valor deve ser positivo');
    }

    const descricaoFinal = (
      opts.descricao?.trim() || `Movimento convênio ${convenio.empresaNome}`
    ).slice(0, 300);

    // 9. origemId único por movimento
    const origemId = `convmov2-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

    // 10. Delega ao motor central com naturezaOverride (não roda regime)
    const resultado = await this.criarLancamentoAutomatico({
      cooperativaId: opts.cooperativaId,
      origemTipo: OrigemLancamento.CONVENIO,
      origemId,
      fonte: { tipo: 'CONVENIO' }, // formato exigido por FonteLancamento, mas natureza vem do override
      tipo,
      descricao: descricaoFinal,
      valor: new Prisma.Decimal(valorArredondado.toString()),
      competencia,
      dataPagamento: opts.dataMovimento,
      convenioContratoId: convenio.id,
      naturezaOverride: convenio.naturezaAtoCooperativo,
    });

    this.logger.log(
      `[D-FISCAL-2.2] Movimento convênio (consolidado) criado: contratoConvenio=${convenio.id} ` +
        `${tipo} R$ ${valorArredondado} → ${resultado.naturezaAto} (lanc=${resultado.id})`,
    );

    return {
      id: resultado.id,
      naturezaAto: resultado.naturezaAto,
      tipo,
      valor: valorArredondado.toFixed(2),
      competencia,
      dataPagamento: opts.dataMovimento,
      descricao: descricaoFinal,
    };
  }

  /**
   * D-FISCAL-2.2 — Histórico de movimentos de um ContratoConvenio.
   * Filtra LancamentoCaixa where convenioId (FK ContratoConvenio) + tenant.
   * Ordenado por dataPagamento desc.
   */
  async listarMovimentosContrato(
    contratoConvenioId: string,
    cooperativaId: string,
  ): Promise<
    Array<{
      id: string;
      tipo: 'RECEITA' | 'DESPESA';
      descricao: string;
      valor: number;
      competencia: string;
      dataPagamento: Date | null;
      status: string;
      naturezaAto: string;
      createdAt: Date;
    }>
  > {
    // Defesa em profundidade — confirma posse
    const exists = await this.prisma.contratoConvenio.findFirst({
      where: { id: contratoConvenioId, cooperativaId },
      select: { id: true },
    });
    if (!exists) {
      throw new NotFoundException(`Convênio ${contratoConvenioId} não encontrado neste tenant`);
    }
    const movimentos = await this.prisma.lancamentoCaixa.findMany({
      where: {
        convenioId: contratoConvenioId,
        cooperativaId,
        origemTipo: OrigemLancamento.CONVENIO,
      },
      select: {
        id: true,
        tipo: true,
        descricao: true,
        valor: true,
        competencia: true,
        dataPagamento: true,
        status: true,
        naturezaAto: true,
        createdAt: true,
      },
      orderBy: { dataPagamento: 'desc' },
    });
    return movimentos.map((m) => ({
      id: m.id,
      tipo: m.tipo as 'RECEITA' | 'DESPESA',
      descricao: m.descricao,
      valor: Number(m.valor),
      competencia: m.competencia,
      dataPagamento: m.dataPagamento,
      status: m.status,
      naturezaAto: m.naturezaAto,
      createdAt: m.createdAt,
    }));
  }

  /**
   * D-FISCAL-2.2 — Estorna movimento de ContratoConvenio. Mesmo padrão
   * de estornarMovimentoConvenio (CT.9.1) mas filtra por convenioId (FK
   * ContratoConvenio) em vez de convenioContabilId.
   */
  async estornarMovimentoConvenioContrato(opts: {
    contratoConvenioId: string;
    lancamentoId: string;
    cooperativaId: string;
    motivo?: string;
    usuarioId?: string;
  }): Promise<{ id: string; estornado: true }> {
    const lanc = await this.prisma.lancamentoCaixa.findFirst({
      where: {
        id: opts.lancamentoId,
        cooperativaId: opts.cooperativaId,
        origemTipo: OrigemLancamento.CONVENIO,
        convenioId: opts.contratoConvenioId,
      },
      select: { id: true, competencia: true },
    });
    if (!lanc) {
      throw new NotFoundException(
        `Movimento ${opts.lancamentoId} não encontrado no convênio ${opts.contratoConvenioId} deste tenant`,
      );
    }

    if (this.apuracaoService) {
      await this.apuracaoService.garantirMesAberto(
        opts.cooperativaId,
        lanc.competencia,
      );
    }

    await this.prisma.lancamentoCaixa.delete({ where: { id: opts.lancamentoId } });

    this.logger.log(
      `[D-FISCAL-2.2] Movimento convênio (consolidado) ESTORNADO: lanc=${opts.lancamentoId} ` +
        `contratoConvenio=${opts.contratoConvenioId} usuario=${opts.usuarioId ?? '?'} motivo="${opts.motivo ?? ''}"`,
    );

    return { id: opts.lancamentoId, estornado: true };
  }

  /**
   * D-novo-CT-CT.9.1 (01/06/2026 noite) — Estorna movimento de convênio.
   *
   * Padrão igual ao estorno RepasseProprietario: valida posse, gate
   * apuração FECHADA, deleta `LancamentoCaixa` atomicamente. Movimento
   * de convênio não tem despesas vinculadas, então só o lançamento sai.
   *
   * Razão: contábil não se edita, se estorna. Mesma classificação fiscal
   * idempotente — se o admin re-registrar o movimento corrigido, vira
   * lançamento novo com origemId novo.
   */
  async estornarMovimentoConvenio(opts: {
    convenioId: string;
    lancamentoId: string;
    cooperativaId: string;
    motivo?: string;
    usuarioId?: string;
  }): Promise<{ id: string; estornado: true }> {
    // 1. Carrega lançamento + valida posse (tenant + vinculação ao convênio)
    const lanc = await this.prisma.lancamentoCaixa.findFirst({
      where: {
        id: opts.lancamentoId,
        cooperativaId: opts.cooperativaId,
        origemTipo: OrigemLancamento.CONVENIO,
        convenioContabilId: opts.convenioId,
      },
      select: {
        id: true,
        competencia: true,
        dataPagamento: true,
        valor: true,
        tipo: true,
      },
    });
    if (!lanc) {
      throw new NotFoundException(
        `Movimento ${opts.lancamentoId} não encontrado no convênio ${opts.convenioId} deste tenant`,
      );
    }

    // 2. Gate apuração FECHADA — mesmo mecanismo do estorno de Repasse
    if (this.apuracaoService) {
      try {
        await this.apuracaoService.garantirMesAberto(
          opts.cooperativaId,
          lanc.competencia,
        );
      } catch (err: any) {
        // Repropaga ConflictException com mensagem clara
        throw err;
      }
    }

    // 3. Deleta atomicamente (sem cascade — movimento de convênio é solo)
    await this.prisma.lancamentoCaixa.delete({ where: { id: opts.lancamentoId } });

    this.logger.log(
      `[CT.9.1] Movimento convênio ESTORNADO: lanc=${opts.lancamentoId} convenio=${opts.convenioId} usuario=${opts.usuarioId ?? '?'} motivo="${opts.motivo ?? ''}"`,
    );

    return { id: opts.lancamentoId, estornado: true };
  }

  async criarLancamentoAutomatico(opts: {
    cooperativaId: string;
    origemTipo: OrigemLancamento;
    origemId: string;
    fonte: FonteLancamento;
    tipo: 'RECEITA' | 'DESPESA';
    descricao: string;
    valor: Prisma.Decimal | number | string;
    competencia: string; // 'YYYY-MM'
    dataPagamento: Date;
    cooperadoId?: string | null;
    /** CT.9: FK pra Convenio (Art. 88) quando origemTipo=CONVENIO. */
    convenioContabilId?: string | null;
    /** D-FISCAL-2.2: FK pra ContratoConvenio (convênio consolidado). */
    convenioContratoId?: string | null;
    /** D-FISCAL-2.2: natureza fiscal explícita (sobrescreve o regime).
     * Usado quando a fonte é o convênio consolidado e o admin já escolheu
     * a natureza no cadastro do convênio (naturezaAtoCooperativo). */
    naturezaOverride?: NaturezaCooperativa | null;
  }): Promise<{ id: string; criado: boolean; naturezaAto: NaturezaCooperativa }> {
    return runAsPlatform(async () => {
      // 0. CT.4 — bloqueio retroativo: mês com apuração FECHADA é imutável
      if (this.apuracaoService) {
        await this.apuracaoService.garantirMesAberto(opts.cooperativaId, opts.competencia);
      }

      // 1. Classifica antes de gravar
      // D-FISCAL-2.2: se caller passou naturezaOverride, usa ela (caso convênio
      // consolidado com naturezaAtoCooperativo escolhida). Senão, delega ao regime.
      const natureza = opts.naturezaOverride
        ?? (await this.classificarLancamento(opts.cooperativaId, opts.fonte));

      // 2. Tenta criar — captura P2002 (já criado) como sucesso idempotente
      try {
        const lanc = await this.prisma.lancamentoCaixa.create({
          data: {
            tipo: opts.tipo,
            descricao: opts.descricao,
            valor: typeof opts.valor === 'string' || typeof opts.valor === 'number'
              ? new Prisma.Decimal(opts.valor)
              : opts.valor,
            competencia: opts.competencia,
            dataPagamento: opts.dataPagamento,
            status: 'REALIZADO',
            naturezaAto: natureza,
            origemTipo: opts.origemTipo,
            origemId: opts.origemId,
            cooperativaId: opts.cooperativaId,
            cooperadoId: opts.cooperadoId ?? null,
            convenioContabilId: opts.convenioContabilId ?? null,
            // D-FISCAL-2.2: FK pro convênio consolidado (ContratoConvenio).
            // Reaproveita a relation já existente `convenio` (linha 1217 schema).
            convenioId: opts.convenioContratoId ?? null,
          },
          select: { id: true, naturezaAto: true },
        });
        this.logger.log(
          `[CT.3] Lançamento auto-criado: ${opts.origemTipo}#${opts.origemId} → ${natureza} (id=${lanc.id})`,
        );
        return {
          id: lanc.id,
          criado: true,
          naturezaAto: lanc.naturezaAto as NaturezaCooperativa,
        };
      } catch (err: any) {
        if (err.code === 'P2002') {
          // Já existe lançamento pra este evento — idempotente, retorna o existente
          const existente = await this.prisma.lancamentoCaixa.findFirst({
            where: { origemTipo: opts.origemTipo, origemId: opts.origemId },
            select: { id: true, naturezaAto: true },
          });
          this.logger.debug(
            `[CT.3] Lançamento já existia (idempotência): ${opts.origemTipo}#${opts.origemId} → id=${existente?.id}`,
          );
          return {
            id: existente!.id,
            criado: false,
            naturezaAto: existente!.naturezaAto as NaturezaCooperativa,
          };
        }
        throw err;
      }
    });
  }
}
