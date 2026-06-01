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
  }): Promise<{ id: string; criado: boolean; naturezaAto: NaturezaCooperativa }> {
    return runAsPlatform(async () => {
      // 0. CT.4 — bloqueio retroativo: mês com apuração FECHADA é imutável
      if (this.apuracaoService) {
        await this.apuracaoService.garantirMesAberto(opts.cooperativaId, opts.competencia);
      }

      // 1. Classifica antes de gravar
      const natureza = await this.classificarLancamento(opts.cooperativaId, opts.fonte);

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
