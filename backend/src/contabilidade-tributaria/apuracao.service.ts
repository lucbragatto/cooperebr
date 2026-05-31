import {
  ConflictException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
  NotImplementedException,
} from '@nestjs/common';
import { Prisma, StatusApuracao, TipoRegimeContabil } from '@prisma/client';
import { PrismaService } from '../prisma.service';
import { runAsPlatform } from '../common/tenant-context';

/**
 * D-novo-BR-CT CT.4 (31/05/2026) — Motor de apuração mensal segregada.
 *
 * ⚠️ GATE WALTER: Todos os snapshots nascem com validadoContador=false.
 * Os números são CALCULADOS mas marcados como NÃO-VALIDADOS até o contador
 * conferir. UI/relatórios futuros mostram "⚠️ PENDENTE VALIDAÇÃO CONTADOR"
 * enquanto false.
 *
 * Regime suportado: COOPERATIVO (Lei 5.764/71). Demais regimes lançam
 * NotImplementedException — risco P0-1 (aproveitamento indevido de isenção
 * fiscal por extensão silenciosa).
 *
 * Alíquotas/presunção CONFIGURÁVEIS via ConfiguracaoTributaria (NUNCA
 * hardcoded) — Walter ajusta sem refator.
 *
 * Base regulatória:
 *  - Lei 5.764/71 Art. 28 (Fundo Reserva 10% + FATES 5%)
 *  - Lei 5.764/71 Art. 79 (ato cooperativo próprio — isento IRPJ/CSLL)
 *  - Lei 5.764/71 Art. 87 (resultado não-coop integra FATES)
 *  - STF Tema 536 (PIS/COFINS sobre ato próprio = isento, em julgamento)
 *  - STJ Tema 986 (segregação receita SCEE)
 *  - Lei 9.249/95 Art. 15 + 3 (IRPJ presumido + adicional)
 *  - Lei 9.718/98 (PIS/COFINS cumulativo Lucro Presumido)
 *  - RIR/2018 Art. 182 (sobras cooperativas isentas)
 */
@Injectable()
export class ApuracaoService {
  private readonly logger = new Logger(ApuracaoService.name);

  constructor(private readonly prisma: PrismaService) {}

  // ============================================================
  // PREVIEW (não persiste) — pode ser chamado quantas vezes quiser
  // ============================================================

  /**
   * Calcula a apuração do mês on-the-fly, sem persistir. Útil pra preview
   * antes de fechar. Não muda nada no banco.
   */
  async apurarMes(
    cooperativaId: string,
    ano: number,
    mes: number,
  ): Promise<PreviewApuracao> {
    if (mes < 1 || mes > 12) {
      throw new ConflictException(`Mês inválido: ${mes}`);
    }

    const coop = await this.prisma.cooperativa.findUnique({
      where: { id: cooperativaId },
      select: {
        id: true,
        nome: true,
        regimeContabil: true,
        isencaoPisCofinsAtiva: true,
      },
    });
    if (!coop) throw new NotFoundException('Cooperativa não encontrada');

    if (coop.regimeContabil !== TipoRegimeContabil.COOPERATIVO) {
      throw new NotImplementedException(
        `Apuração para regime ${coop.regimeContabil} ainda não implementada — ` +
          `risco P0-1 (aproveitamento indevido). Vide ` +
          `docs/relatorios/2026-05-31-conformidade-contabil-multi-regime.md`,
      );
    }

    const config = await this.obterConfiguracaoOuPadrao(cooperativaId);
    const competencia = `${ano}-${String(mes).padStart(2, '0')}`;

    // Agrega lançamentos do período por natureza
    const lancamentos = await this.prisma.lancamentoCaixa.findMany({
      where: {
        cooperativaId,
        competencia,
        status: 'REALIZADO',
      },
      select: {
        tipo: true,
        valor: true,
        naturezaAto: true,
      },
    });

    const agregados = this.agregarPorNatureza(lancamentos);

    // Sobras brutas ato próprio = receita própria − despesa própria
    const sobrasBrutas = agregados.receitaPropria.minus(agregados.despesaPropria);
    // Resultado não-coop = receita não-coop − despesa não-coop
    const resultadoNaoCoop = agregados.receitaNaoCoop.minus(agregados.despesaNaoCoop);

    // ── Tributos ──
    // PIS/COFINS sobre receita NÃO-COOP (sempre incide).
    const pisNaoCoop = round2(agregados.receitaNaoCoop.mul(config.pisAliquota));
    const cofinsNaoCoop = round2(agregados.receitaNaoCoop.mul(config.cofinsAliquota));

    // PIS/COFINS sobre receita PRÓPRIA: depende da flag isencao (STF Tema 536).
    const pisProprio = coop.isencaoPisCofinsAtiva
      ? new Prisma.Decimal(0)
      : round2(agregados.receitaPropria.mul(config.pisAliquota));
    const cofinsProprio = coop.isencaoPisCofinsAtiva
      ? new Prisma.Decimal(0)
      : round2(agregados.receitaPropria.mul(config.cofinsAliquota));

    const pisDevido = pisNaoCoop.plus(pisProprio);
    const cofinsDevido = cofinsNaoCoop.plus(cofinsProprio);

    // IRPJ/CSLL: incidem APENAS sobre resultado não-coop (Sobras próprias
    // isentas — RIR/2018 Art. 182). Base presumida × alíquota + adicional.
    const baseIrpj = resultadoNaoCoop.isPositive()
      ? round2(resultadoNaoCoop.mul(config.irpjPercentualPresuncao))
      : new Prisma.Decimal(0);
    const irpjBase = round2(baseIrpj.mul(config.irpjAliquota));
    const irpjAdicional = baseIrpj.greaterThan(config.irpjAdicionalLimite)
      ? round2(
          baseIrpj.minus(config.irpjAdicionalLimite).mul(config.irpjAdicionalAliquota),
        )
      : new Prisma.Decimal(0);
    const irpjDevido = irpjBase.plus(irpjAdicional);

    const baseCsll = resultadoNaoCoop.isPositive()
      ? round2(resultadoNaoCoop.mul(config.csllPercentualPresuncao))
      : new Prisma.Decimal(0);
    const csllDevido = round2(baseCsll.mul(config.csllAliquota));

    // ── Fundos (Lei 5.764/71 Art. 28) ──
    // FR 10% + FATES 5% das sobras líquidas (após tributos cooperativos, que aqui são 0).
    // Resultado não-coop integra FATES (Art. 87) APÓS tributos.
    const sobrasLiquidas = sobrasBrutas; // tributos sobre próprio são 0 (ou config off)
    const fundoReserva = sobrasLiquidas.isPositive()
      ? round2(sobrasLiquidas.mul(config.fundoReservaPercentual))
      : new Prisma.Decimal(0);

    const resultadoNaoCoopAposTributos = resultadoNaoCoop
      .minus(pisNaoCoop)
      .minus(cofinsNaoCoop)
      .minus(irpjDevido)
      .minus(csllDevido);

    const fatesDeSobras = sobrasLiquidas.isPositive()
      ? round2(sobrasLiquidas.mul(config.fatesPercentual))
      : new Prisma.Decimal(0);
    const fatesDeNaoCoop = resultadoNaoCoopAposTributos.isPositive()
      ? resultadoNaoCoopAposTributos
      : new Prisma.Decimal(0);
    const fates = round2(fatesDeSobras.plus(fatesDeNaoCoop));

    const sobrasDistribuiveis = round2(
      sobrasLiquidas.minus(fundoReserva).minus(fatesDeSobras),
    );

    return {
      cooperativaId,
      cooperativaNome: coop.nome,
      ano,
      mes,
      competencia,
      receitaPropria: round2(agregados.receitaPropria),
      receitaAuxiliar: round2(agregados.receitaAuxiliar),
      receitaNaoCoop: round2(agregados.receitaNaoCoop),
      despesaPropria: round2(agregados.despesaPropria),
      despesaAuxiliar: round2(agregados.despesaAuxiliar),
      despesaNaoCoop: round2(agregados.despesaNaoCoop),
      sobrasBrutas: round2(sobrasBrutas),
      resultadoNaoCoop: round2(resultadoNaoCoop),
      pisDevido: round2(pisDevido),
      cofinsDevido: round2(cofinsDevido),
      irpjDevido: round2(irpjDevido),
      csllDevido: round2(csllDevido),
      fundoReserva,
      fates,
      sobrasDistribuiveis,
      fundamentoIsencao: coop.isencaoPisCofinsAtiva
        ? 'STF Tema 536 + STJ Tema 986 + Art. 79 Lei 5.764/71'
        : null,
      configuracao: {
        pisAliquota: config.pisAliquota.toString(),
        cofinsAliquota: config.cofinsAliquota.toString(),
        irpjPercentualPresuncao: config.irpjPercentualPresuncao.toString(),
        csllPercentualPresuncao: config.csllPercentualPresuncao.toString(),
        isencaoPisCofinsAtiva: coop.isencaoPisCofinsAtiva,
        avisoPresuncao:
          'IRPJ/CSLL: presunção configurada. CONFIRMAR COM WALTER conforme atividade real (SCEE/serviço/comércio).',
      },
      avisoValidacao:
        '⚠️ PREVIEW — números calculados mas NÃO-VALIDADOS. Snapshot só conta após fecharApuracao + validarApuracao(contador).',
    };
  }

  // ============================================================
  // FECHAR — persiste snapshot imutável (validadoContador=false)
  // ============================================================

  async fecharApuracao(
    cooperativaId: string,
    ano: number,
    mes: number,
    usuarioId: string,
  ): Promise<{ id: string; status: StatusApuracao; validadoContador: boolean }> {
    // Race-guard via @@unique([cooperativaId, ano, mes])
    const existente = await this.prisma.apuracaoMensalSegregada.findUnique({
      where: { cooperativaId_ano_mes: { cooperativaId, ano, mes } },
      select: { id: true, status: true },
    });
    if (existente && existente.status === StatusApuracao.FECHADA) {
      throw new ConflictException(
        `Apuração ${ano}-${String(mes).padStart(2, '0')} já está FECHADA (id=${existente.id}). ` +
          `Use o endpoint /reabrir (SUPER_ADMIN) se necessário.`,
      );
    }

    const preview = await this.apurarMes(cooperativaId, ano, mes);

    return runAsPlatform(async () => {
      const dataSnapshot = {
        cooperativaId,
        ano,
        mes,
        receitaPropria: preview.receitaPropria,
        receitaAuxiliar: preview.receitaAuxiliar,
        receitaNaoCoop: preview.receitaNaoCoop,
        despesaPropria: preview.despesaPropria,
        despesaAuxiliar: preview.despesaAuxiliar,
        despesaNaoCoop: preview.despesaNaoCoop,
        fundoReserva: preview.fundoReserva,
        fates: preview.fates,
        sobrasDistribuiveis: preview.sobrasDistribuiveis,
        pisDevido: preview.pisDevido,
        cofinsDevido: preview.cofinsDevido,
        irpjDevido: preview.irpjDevido,
        csllDevido: preview.csllDevido,
        fundamentoIsencao: preview.fundamentoIsencao,
        status: StatusApuracao.FECHADA,
        fechadoEm: new Date(),
        fechadoPorUsuarioId: usuarioId,
        validadoContador: false, // GATE WALTER — nunca true no fechamento
      };

      try {
        const snap = existente
          ? await this.prisma.apuracaoMensalSegregada.update({
              where: { id: existente.id },
              data: dataSnapshot,
              select: { id: true, status: true, validadoContador: true },
            })
          : await this.prisma.apuracaoMensalSegregada.create({
              data: dataSnapshot,
              select: { id: true, status: true, validadoContador: true },
            });

        this.logger.log(
          `[CT.4] Apuração FECHADA: coop=${cooperativaId} ${ano}-${mes} → ${snap.id} (validadoContador=false GATE WALTER)`,
        );
        return snap;
      } catch (err: any) {
        if (err.code === 'P2002') {
          // Race condition — outra request fechou antes
          throw new ConflictException(
            `Apuração ${ano}-${String(mes).padStart(2, '0')} foi fechada simultaneamente por outro usuário.`,
          );
        }
        throw err;
      }
    });
  }

  // ============================================================
  // VALIDAR (Walter/contador) — marca validadoContador=true
  // ============================================================

  async validarApuracao(
    id: string,
    cooperativaId: string | null,
    usuarioId: string,
    observacao?: string,
  ): Promise<{ id: string; validadoContador: boolean; validadoEm: Date }> {
    const snap = await this.prisma.apuracaoMensalSegregada.findUnique({
      where: { id },
      select: {
        id: true,
        cooperativaId: true,
        status: true,
        validadoContador: true,
      },
    });
    if (!snap) throw new NotFoundException('Apuração não encontrada');
    if (cooperativaId && snap.cooperativaId !== cooperativaId) {
      throw new ForbiddenException('Apuração de outro tenant');
    }
    if (snap.status !== StatusApuracao.FECHADA) {
      throw new ConflictException('Só apurações FECHADAS podem ser validadas');
    }
    if (snap.validadoContador) {
      throw new ConflictException('Apuração já validada pelo contador');
    }

    const validadoEm = new Date();
    const atualizada = await this.prisma.apuracaoMensalSegregada.update({
      where: { id },
      data: {
        validadoContador: true,
        validadoPorUsuarioId: usuarioId,
        validadoEm,
        observacaoContador: observacao ?? null,
      },
      select: { id: true, validadoContador: true, validadoEm: true },
    });

    this.logger.log(
      `[CT.4] Apuração VALIDADA (Walter/contador): ${id} por usuario=${usuarioId}`,
    );
    return atualizada as { id: string; validadoContador: boolean; validadoEm: Date };
  }

  // ============================================================
  // REABRIR (SUPER_ADMIN apenas)
  // ============================================================

  async reabrirApuracao(
    id: string,
    usuarioId: string,
    motivo: string,
  ): Promise<{ id: string; status: StatusApuracao }> {
    if (!motivo || motivo.trim().length < 10) {
      throw new ConflictException(
        'Motivo de reabertura obrigatório (mínimo 10 caracteres) — auditoria fiscal',
      );
    }
    const snap = await this.prisma.apuracaoMensalSegregada.findUnique({
      where: { id },
      select: { id: true, status: true },
    });
    if (!snap) throw new NotFoundException('Apuração não encontrada');
    if (snap.status !== StatusApuracao.FECHADA) {
      throw new ConflictException('Só apurações FECHADAS podem ser reabertas');
    }

    const atualizada = await this.prisma.apuracaoMensalSegregada.update({
      where: { id },
      data: {
        status: StatusApuracao.ABERTA,
        reabertoEm: new Date(),
        reabertoPorUsuarioId: usuarioId,
        motivoReabertura: motivo,
        // Limpa validação — se reabriu, precisa validar de novo após re-fechar
        validadoContador: false,
        validadoPorUsuarioId: null,
        validadoEm: null,
      },
      select: { id: true, status: true },
    });

    this.logger.warn(
      `[CT.4] Apuração REABERTA (SUPER_ADMIN): ${id} por usuario=${usuarioId} — motivo: ${motivo}`,
    );
    return atualizada;
  }

  // ============================================================
  // Bloqueio retroativo — usado pelo hook CT.3
  // ============================================================

  /**
   * Garante que NÃO existe apuração FECHADA pra (cooperativa, ano, mes).
   * Hook CT.3 chama ANTES de criar lançamento — se mês está fechado,
   * lança ConflictException (snapshot imutável).
   */
  async garantirMesAberto(
    cooperativaId: string,
    competencia: string, // 'YYYY-MM'
  ): Promise<void> {
    const [anoStr, mesStr] = competencia.split('-');
    const ano = Number(anoStr);
    const mes = Number(mesStr);
    if (!ano || !mes) return; // formato inválido — não bloqueia (hook decide)

    const snap = await this.prisma.apuracaoMensalSegregada.findUnique({
      where: { cooperativaId_ano_mes: { cooperativaId, ano, mes } },
      select: { id: true, status: true },
    });
    if (snap && snap.status === StatusApuracao.FECHADA) {
      throw new ConflictException(
        `Apuração ${competencia} está FECHADA (id=${snap.id}). ` +
          `Lançamentos retroativos bloqueados — peça reabertura via SUPER_ADMIN.`,
      );
    }
  }

  // ============================================================
  // Helpers
  // ============================================================

  private agregarPorNatureza(
    lancamentos: Array<{ tipo: string; valor: Prisma.Decimal; naturezaAto: string }>,
  ): {
    receitaPropria: Prisma.Decimal;
    receitaAuxiliar: Prisma.Decimal;
    receitaNaoCoop: Prisma.Decimal;
    despesaPropria: Prisma.Decimal;
    despesaAuxiliar: Prisma.Decimal;
    despesaNaoCoop: Prisma.Decimal;
  } {
    const zero = () => new Prisma.Decimal(0);
    const result = {
      receitaPropria: zero(),
      receitaAuxiliar: zero(),
      receitaNaoCoop: zero(),
      despesaPropria: zero(),
      despesaAuxiliar: zero(),
      despesaNaoCoop: zero(),
    };

    for (const l of lancamentos) {
      const isReceita = l.tipo === 'RECEITA';
      const isDespesa = l.tipo === 'DESPESA';
      if (!isReceita && !isDespesa) continue;

      switch (l.naturezaAto) {
        case 'PROPRIO':
          if (isReceita) result.receitaPropria = result.receitaPropria.plus(l.valor);
          else result.despesaPropria = result.despesaPropria.plus(l.valor);
          break;
        case 'AUXILIAR':
          if (isReceita) result.receitaAuxiliar = result.receitaAuxiliar.plus(l.valor);
          else result.despesaAuxiliar = result.despesaAuxiliar.plus(l.valor);
          break;
        case 'NAO_COOPERATIVO':
          if (isReceita) result.receitaNaoCoop = result.receitaNaoCoop.plus(l.valor);
          else result.despesaNaoCoop = result.despesaNaoCoop.plus(l.valor);
          break;
        default:
          // Lançamento sem classificação — Walter revisa via flag observacaoContabil
          if (isReceita) result.receitaPropria = result.receitaPropria.plus(l.valor);
          else result.despesaPropria = result.despesaPropria.plus(l.valor);
      }
    }
    return result;
  }

  private async obterConfiguracaoOuPadrao(
    cooperativaId: string,
  ): Promise<{
    pisAliquota: Prisma.Decimal;
    cofinsAliquota: Prisma.Decimal;
    irpjAliquota: Prisma.Decimal;
    irpjPercentualPresuncao: Prisma.Decimal;
    irpjAdicionalLimite: Prisma.Decimal;
    irpjAdicionalAliquota: Prisma.Decimal;
    csllAliquota: Prisma.Decimal;
    csllPercentualPresuncao: Prisma.Decimal;
    fundoReservaPercentual: Prisma.Decimal;
    fatesPercentual: Prisma.Decimal;
  }> {
    const cfg = await this.prisma.configuracaoTributaria.findUnique({
      where: { cooperativaId },
    });
    if (cfg) return cfg as any;
    // Defaults Lucro Presumido — Walter ajusta via upsert depois
    return {
      pisAliquota: new Prisma.Decimal('0.0065'),
      cofinsAliquota: new Prisma.Decimal('0.0300'),
      irpjAliquota: new Prisma.Decimal('0.15'),
      irpjPercentualPresuncao: new Prisma.Decimal('0.32'),
      irpjAdicionalLimite: new Prisma.Decimal('20000'),
      irpjAdicionalAliquota: new Prisma.Decimal('0.10'),
      csllAliquota: new Prisma.Decimal('0.09'),
      csllPercentualPresuncao: new Prisma.Decimal('0.32'),
      fundoReservaPercentual: new Prisma.Decimal('0.10'),
      fatesPercentual: new Prisma.Decimal('0.05'),
    };
  }
}

// ============================================================
// Tipos públicos
// ============================================================

export interface PreviewApuracao {
  cooperativaId: string;
  cooperativaNome: string;
  ano: number;
  mes: number;
  competencia: string;
  receitaPropria: Prisma.Decimal;
  receitaAuxiliar: Prisma.Decimal;
  receitaNaoCoop: Prisma.Decimal;
  despesaPropria: Prisma.Decimal;
  despesaAuxiliar: Prisma.Decimal;
  despesaNaoCoop: Prisma.Decimal;
  sobrasBrutas: Prisma.Decimal;
  resultadoNaoCoop: Prisma.Decimal;
  pisDevido: Prisma.Decimal;
  cofinsDevido: Prisma.Decimal;
  irpjDevido: Prisma.Decimal;
  csllDevido: Prisma.Decimal;
  fundoReserva: Prisma.Decimal;
  fates: Prisma.Decimal;
  sobrasDistribuiveis: Prisma.Decimal;
  fundamentoIsencao: string | null;
  configuracao: {
    pisAliquota: string;
    cofinsAliquota: string;
    irpjPercentualPresuncao: string;
    csllPercentualPresuncao: string;
    isencaoPisCofinsAtiva: boolean;
    avisoPresuncao: string;
  };
  avisoValidacao: string;
}

function round2(d: Prisma.Decimal): Prisma.Decimal {
  return new Prisma.Decimal(d.toDecimalPlaces(2, Prisma.Decimal.ROUND_HALF_UP).toString());
}
