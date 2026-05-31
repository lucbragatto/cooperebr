import { Injectable, Logger, NotFoundException, Optional } from '@nestjs/common';
import { NaturezaCooperativa, OrigemLancamento, Prisma } from '@prisma/client';
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
 * CT.4 (gate Walter): motor de apuração tributária real.
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
