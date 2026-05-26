import { Injectable, BadRequestException, ForbiddenException, NotFoundException, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import {
  calcularRepasse,
  UsinaParaCalculo,
  TarifaResolver,
} from '../usinas/helpers/calcular-repasse';

/**
 * Sub-Sprint F Sessao 1 MVP+ Etapa D (M30, 2026-05-26).
 *
 * Service dedicado pro Portal Proprietario. Encapsula:
 *   - Resolucao do usuario -> usinas que ele e proprietario (via
 *     proprietarioCooperadoId OU proprietarioEmail) — multi-tenant.
 *   - Calculo de repasse usando helper calcularRepasse (SUBSTITUI o
 *     R\$ 0,50/kWh hardcoded).
 *   - Agregacoes Dashboard (5 KPIs + lista usinas) + drill-down por usina.
 *   - Anonimizacao cooperados (Opcao A — #042 / #043...).
 *
 * NUNCA expoe usinas de cooperativa que o proprietario nao pertence.
 */
@Injectable()
export class ProprietarioService {
  private readonly logger = new Logger(ProprietarioService.name);

  constructor(private prisma: PrismaService) {}

  // ─── Multi-tenant: identificar usinas do proprietario logado ────────

  /**
   * Resolve as usinas que o usuario autenticado pode acessar como proprietario.
   * Caminho A: proprietarioCooperadoId === cooperadoId (se for cooperado tambem)
   * Caminho B: proprietarioEmail === user.email (proprietario nao-cooperado)
   *
   * Sem usinas? Lanca ForbiddenException — usuario nao tem papel proprietario.
   */
  private async resolverUsinasDoProprietario(user: any): Promise<string[]> {
    if (!user) throw new ForbiddenException('Usuario nao autenticado.');

    const where: any[] = [];
    if (user.cooperadoId) {
      where.push({ proprietarioCooperadoId: user.cooperadoId });
    }
    if (user.email) {
      where.push({ proprietarioEmail: user.email });
    }
    if (where.length === 0) {
      throw new ForbiddenException('Usuario sem dados de proprietario (sem cooperadoId nem email).');
    }

    const usinas = await this.prisma.usina.findMany({
      where: { OR: where },
      select: { id: true },
    });

    if (usinas.length === 0) {
      throw new ForbiddenException('Nenhuma usina vinculada a este usuario como proprietario.');
    }

    return usinas.map((u) => u.id);
  }

  // ─── Tarifa resolver (TUSD + TE vigente por distribuidora) ──────────

  private criarTarifaResolver(): TarifaResolver {
    return async (distribuidora: string | null, _competencia: Date) => {
      if (!distribuidora) return null;

      // Busca tarifa mais recente (vigencia anterior ao competencia idealmente,
      // mas pra MVP usa a mais recente em geral). Logica similar a
      // RelatoriosService.projecaoReceita.
      const tarifas = await this.prisma.tarifaConcessionaria.findMany({
        orderBy: { dataVigencia: 'desc' },
        take: 10,
      });

      const normD = distribuidora.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').trim();
      const match = tarifas.find((t) => {
        const normC = t.concessionaria.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').trim();
        return normC.includes(normD) || normD.includes(normC);
      });

      if (!match) return null;
      return Number(match.tusdNova) + Number(match.teNova);
    };
  }

  // ─── Anonimizar cooperados (LGPD Opcao A) ────────────────────────────

  private mascararCooperado(index: number): string {
    return `Cooperado #${String(index + 1).padStart(3, '0')}`;
  }

  // ─── GET /proprietario/dashboard ───────────────────────────────────

  async dashboard(user: any) {
    const usinaIds = await this.resolverUsinasDoProprietario(user);
    const tarifaResolver = this.criarTarifaResolver();

    const now = new Date();
    const mesAtual = now.getMonth() + 1;
    const anoAtual = now.getFullYear();
    const inicioAnoYTD = new Date(anoAtual, 0, 1);

    const usinas = await this.prisma.usina.findMany({
      where: { id: { in: usinaIds } },
      include: {
        contratos: {
          where: { status: { in: ['ATIVO', 'PENDENTE_ATIVACAO', 'APROVADO'] } },
          select: { kwhContrato: true, percentualUsina: true, dataFim: true },
        },
        geracoesMensais: {
          orderBy: { competencia: 'desc' },
          take: 24,
        },
        alertas: {
          where: { resolvidoEm: null },
          select: { id: true, tipo: true, descricao: true, primeiraLeitura: true, estado: true },
        },
      },
    });

    const usinasResumo = [] as any[];
    let kpiReceberEsseMes = 0;
    let kpiTotalYTD = 0;
    let kpiUsinasOk = 0;
    let kpiUsinasAtencao = 0;
    let kpiUsinasCritico = 0;
    let kpiContratosVencendo30d = 0;
    const dataLimiteVencimento = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);

    for (const u of usinas) {
      const capacidade = Number(u.capacidadeKwh ?? 0);
      const kwhContratado = u.contratos.reduce((s, c) => s + Number(c.kwhContrato ?? 0), 0);
      const ocupacao = capacidade > 0 ? Math.min(100, Math.round((kwhContratado / capacidade) * 100)) : 0;

      const geracaoMesAtual = u.geracoesMensais.find(
        (g) => g.competencia.getMonth() + 1 === mesAtual && g.competencia.getFullYear() === anoAtual,
      );
      const kwhGeradoMes = Number(geracaoMesAtual?.kwhGerado ?? 0);

      const usinaCalc: UsinaParaCalculo = {
        formaPagamentoDono: u.formaPagamentoDono,
        valorAluguelFixo: u.valorAluguelFixo !== null ? Number(u.valorAluguelFixo) : null,
        percentualGeracaoDono: u.percentualGeracaoDono !== null ? Number(u.percentualGeracaoDono) : null,
        valorKwhPadrao: u.valorKwhPadrao !== null ? Number(u.valorKwhPadrao) : null,
        distribuidora: u.distribuidora,
      };

      const repasseMesAtual = await calcularRepasse(
        usinaCalc,
        geracaoMesAtual ? { kwhGerado: kwhGeradoMes, competencia: geracaoMesAtual.competencia } : null,
        tarifaResolver,
      );

      // YTD: soma repasses dos meses do ano corrente ja registrados
      const geracoesAnoCorrente = u.geracoesMensais.filter(
        (g) => g.competencia >= inicioAnoYTD && g.competencia <= now,
      );
      let repasseYTD = 0;
      for (const g of geracoesAnoCorrente) {
        const r = await calcularRepasse(
          usinaCalc,
          { kwhGerado: Number(g.kwhGerado), competencia: g.competencia },
          tarifaResolver,
        );
        if (r.valor !== null) repasseYTD += r.valor;
      }
      repasseYTD = Math.round(repasseYTD * 100) / 100;

      // KPIs
      if (repasseMesAtual.valor !== null) kpiReceberEsseMes += repasseMesAtual.valor;
      kpiTotalYTD += repasseYTD;

      const temAlertaCritico = u.alertas.some((a) => a.estado === 'CONFIRMADO');
      const temAlertaSuspeito = u.alertas.some((a) => a.estado === 'SUSPEITO');
      const statusOp = u.statusOperacional;

      let visualStatus: 'ok' | 'atencao' | 'critico';
      if (statusOp === 'OFFLINE' || statusOp === 'DESLIGADA' || statusOp === 'MANUTENCAO_EMERGENCIAL' || temAlertaCritico) {
        visualStatus = 'critico';
        kpiUsinasCritico++;
      } else if (statusOp === 'MANUTENCAO_PLANEJADA' || temAlertaSuspeito) {
        visualStatus = 'atencao';
        kpiUsinasAtencao++;
      } else {
        visualStatus = 'ok';
        kpiUsinasOk++;
      }

      // Contratos vencendo em 30d
      const contratosVencendo = u.contratos.filter(
        (c) => c.dataFim && c.dataFim <= dataLimiteVencimento,
      );
      kpiContratosVencendo30d += contratosVencendo.length;

      usinasResumo.push({
        id: u.id,
        nome: u.nome,
        apelidoInterno: u.apelidoInterno,
        cidade: u.cidade,
        estado: u.estado,
        statusHomologacao: u.statusHomologacao,
        statusOperacional: u.statusOperacional,
        capacidadeKwh: capacidade,
        kwhGeradoMes,
        ocupacao,
        repasseMesAtual: {
          valor: repasseMesAtual.valor,
          formula: repasseMesAtual.formula,
          motivo: repasseMesAtual.motivo,
          fonteTarifa: repasseMesAtual.fonteTarifa,
        },
        repasseYTD,
        visualStatus,
        alertasAtivos: u.alertas.length,
      });
    }

    return {
      kpisTop: {
        receberEsseMes: Math.round(kpiReceberEsseMes * 100) / 100,
        statusPagamentoMesAtual: 'PREVISTO', // F.5 futuro: trackear pagamento real
        usinasOk: kpiUsinasOk,
        usinasAtencao: kpiUsinasAtencao,
        usinasCritico: kpiUsinasCritico,
        totalYTD: Math.round(kpiTotalYTD * 100) / 100,
        contratosVencendo30d: kpiContratosVencendo30d,
      },
      usinas: usinasResumo,
      ultimaAtualizacao: now.toISOString(),
    };
  }

  // ─── GET /proprietario/usinas/:id ─────────────────────────────────

  async detalheUsina(user: any, usinaId: string) {
    const usinaIds = await this.resolverUsinasDoProprietario(user);
    if (!usinaIds.includes(usinaId)) {
      throw new NotFoundException('Usina nao encontrada no seu portfolio.');
    }

    const tarifaResolver = this.criarTarifaResolver();
    const now = new Date();
    const dozeMesesAtras = new Date(now.getFullYear(), now.getMonth() - 11, 1);

    const usina = await this.prisma.usina.findUnique({
      where: { id: usinaId },
      include: {
        contratos: {
          where: { status: { in: ['ATIVO', 'PENDENTE_ATIVACAO', 'APROVADO'] } },
          include: { cooperado: { select: { id: true } } },
        },
        geracoesMensais: {
          where: { competencia: { gte: dozeMesesAtras } },
          orderBy: { competencia: 'asc' },
        },
        alertas: {
          orderBy: { createdAt: 'desc' },
          take: 10,
        },
      },
    });

    if (!usina) {
      throw new NotFoundException('Usina nao encontrada.');
    }

    const usinaCalc: UsinaParaCalculo = {
      formaPagamentoDono: usina.formaPagamentoDono,
      valorAluguelFixo: usina.valorAluguelFixo !== null ? Number(usina.valorAluguelFixo) : null,
      percentualGeracaoDono: usina.percentualGeracaoDono !== null ? Number(usina.percentualGeracaoDono) : null,
      valorKwhPadrao: usina.valorKwhPadrao !== null ? Number(usina.valorKwhPadrao) : null,
      distribuidora: usina.distribuidora,
    };

    // Historico de geracao + repasse calculado mes a mes
    const capacidadeMensal = Number(usina.capacidadeKwh ?? 0);
    const geracaoHistorica12m = [] as any[];
    const repassesHistoricos = [] as any[];

    for (const g of usina.geracoesMensais) {
      const mesLabel = `${String(g.competencia.getMonth() + 1).padStart(2, '0')}/${g.competencia.getFullYear()}`;
      const kwhGerado = Number(g.kwhGerado);

      geracaoHistorica12m.push({
        mes: mesLabel,
        competencia: g.competencia.toISOString().slice(0, 7),
        kwhGerado,
        kwhProjetado: capacidadeMensal,
      });

      const r = await calcularRepasse(
        usinaCalc,
        { kwhGerado, competencia: g.competencia },
        tarifaResolver,
      );

      const isMesAtual = g.competencia.getMonth() === now.getMonth() && g.competencia.getFullYear() === now.getFullYear();
      repassesHistoricos.push({
        mes: mesLabel,
        competencia: g.competencia.toISOString().slice(0, 7),
        kwhGerado,
        valor: r.valor,
        formula: r.formula,
        fonteTarifa: r.fonteTarifa,
        motivo: r.motivo,
        status: isMesAtual ? 'PREVISTO' : 'PAGO', // F.5: status real
      });
    }

    // Cooperados anonimizados (LGPD Opcao A)
    const cooperadosOrdenados = [...usina.contratos]
      .sort((a, b) => a.cooperadoId.localeCompare(b.cooperadoId));
    const totalCooperados = cooperadosOrdenados.length;
    const kwhContratadoTotal = cooperadosOrdenados.reduce((s, c) => s + Number(c.kwhContrato ?? 0), 0);
    const ocupacaoPercentual = capacidadeMensal > 0
      ? Math.min(100, Math.round((kwhContratadoTotal / capacidadeMensal) * 100))
      : 0;

    const cooperadosAnonimizadosLista = cooperadosOrdenados.map((c, i) => ({
      apelido: this.mascararCooperado(i),
      kwhContratado: Number(c.kwhContrato ?? 0),
      percentualUsina: Number(c.percentualUsina ?? 0),
    }));

    return {
      usina: {
        id: usina.id,
        nome: usina.nome,
        apelidoInterno: usina.apelidoInterno,
        cidade: usina.cidade,
        estado: usina.estado,
        distribuidora: usina.distribuidora,
        capacidadeKwh: capacidadeMensal,
        potenciaKwp: Number(usina.potenciaKwp ?? 0),
        statusHomologacao: usina.statusHomologacao,
        statusOperacional: usina.statusOperacional,
        classeGdAnotada: usina.classeGdAnotada,
        formaAquisicao: usina.formaAquisicao,
        formaPagamentoDono: usina.formaPagamentoDono,
        valorAluguelFixo: usina.valorAluguelFixo !== null ? Number(usina.valorAluguelFixo) : null,
        percentualGeracaoDono: usina.percentualGeracaoDono !== null ? Number(usina.percentualGeracaoDono) : null,
        valorKwhPadrao: usina.valorKwhPadrao !== null ? Number(usina.valorKwhPadrao) : null,
      },
      geracaoHistorica12m,
      repassesHistoricos,
      cooperadosAnonimizados: {
        total: totalCooperados,
        kwhContratadoTotal,
        ocupacaoPercentual,
        lista: cooperadosAnonimizadosLista,
      },
      contratos: usina.contratos.map((c) => ({
        id: c.id,
        numero: c.numero,
        status: c.status,
        dataInicio: c.dataInicio,
        dataFim: c.dataFim,
        kwhContrato: Number(c.kwhContrato ?? 0),
        percentualUsina: Number(c.percentualUsina ?? 0),
      })),
      alertas: usina.alertas,
      responsabilidadeDespesas: usina.responsabilidadeDespesas,
    };
  }

  // ─── GET /proprietario/repasses ──────────────────────────────────

  async listarRepasses(user: any, filtros: { usinaId?: string; dataInicio?: Date; dataFim?: Date }) {
    const usinaIds = await this.resolverUsinasDoProprietario(user);
    const usinasFiltradas = filtros.usinaId
      ? usinaIds.filter((id) => id === filtros.usinaId)
      : usinaIds;

    if (filtros.usinaId && !usinasFiltradas.includes(filtros.usinaId)) {
      throw new NotFoundException('Usina nao encontrada no seu portfolio.');
    }

    const tarifaResolver = this.criarTarifaResolver();
    const now = new Date();

    const usinas = await this.prisma.usina.findMany({
      where: { id: { in: usinasFiltradas } },
      include: {
        geracoesMensais: {
          where: {
            ...(filtros.dataInicio ? { competencia: { gte: filtros.dataInicio } } : {}),
            ...(filtros.dataFim ? { competencia: { lte: filtros.dataFim } } : {}),
          },
          orderBy: { competencia: 'desc' },
        },
      },
    });

    const repasses = [] as any[];
    let totalYTD = 0;
    const inicioAnoYTD = new Date(now.getFullYear(), 0, 1);

    for (const u of usinas) {
      const usinaCalc: UsinaParaCalculo = {
        formaPagamentoDono: u.formaPagamentoDono,
        valorAluguelFixo: u.valorAluguelFixo !== null ? Number(u.valorAluguelFixo) : null,
        percentualGeracaoDono: u.percentualGeracaoDono !== null ? Number(u.percentualGeracaoDono) : null,
        valorKwhPadrao: u.valorKwhPadrao !== null ? Number(u.valorKwhPadrao) : null,
        distribuidora: u.distribuidora,
      };
      for (const g of u.geracoesMensais) {
        const r = await calcularRepasse(
          usinaCalc,
          { kwhGerado: Number(g.kwhGerado), competencia: g.competencia },
          tarifaResolver,
        );
        const isMesAtual = g.competencia.getMonth() === now.getMonth() && g.competencia.getFullYear() === now.getFullYear();
        repasses.push({
          usinaId: u.id,
          usinaNome: u.nome,
          mes: `${String(g.competencia.getMonth() + 1).padStart(2, '0')}/${g.competencia.getFullYear()}`,
          competencia: g.competencia.toISOString().slice(0, 7),
          kwhGerado: Number(g.kwhGerado),
          valor: r.valor,
          formula: r.formula,
          fonteTarifa: r.fonteTarifa,
          motivo: r.motivo,
          status: isMesAtual ? 'PREVISTO' : 'PAGO',
        });
        if (r.valor !== null && g.competencia >= inicioAnoYTD) {
          totalYTD += r.valor;
        }
      }
    }

    repasses.sort((a, b) => (a.competencia < b.competencia ? 1 : -1));

    return {
      repasses,
      totalYTD: Math.round(totalYTD * 100) / 100,
      filtros,
    };
  }

  // ─── GET /proprietario/contratos ─────────────────────────────────

  async listarContratos(user: any, filtros: { usinaId?: string }) {
    const usinaIds = await this.resolverUsinasDoProprietario(user);
    const usinasFiltradas = filtros.usinaId
      ? usinaIds.filter((id) => id === filtros.usinaId)
      : usinaIds;

    if (filtros.usinaId && !usinasFiltradas.includes(filtros.usinaId)) {
      throw new NotFoundException('Usina nao encontrada no seu portfolio.');
    }

    const contratos = await this.prisma.contrato.findMany({
      where: { usinaId: { in: usinasFiltradas } },
      include: {
        usina: { select: { id: true, nome: true, apelidoInterno: true } },
      },
      orderBy: { dataInicio: 'desc' },
    });

    return contratos.map((c, i) => ({
      id: c.id,
      numero: c.numero,
      status: c.status,
      dataInicio: c.dataInicio,
      dataFim: c.dataFim,
      kwhContrato: Number(c.kwhContrato ?? 0),
      percentualUsina: Number(c.percentualUsina ?? 0),
      percentualDesconto: Number(c.percentualDesconto ?? 0),
      cooperado: this.mascararCooperado(i),
      usina: c.usina,
    }));
  }

  // ─── GET /proprietario/despesas ──────────────────────────────────

  async listarDespesas(user: any, filtros: { usinaId?: string }) {
    const usinaIds = await this.resolverUsinasDoProprietario(user);
    const usinasFiltradas = filtros.usinaId
      ? usinaIds.filter((id) => id === filtros.usinaId)
      : usinaIds;

    if (filtros.usinaId && !usinasFiltradas.includes(filtros.usinaId)) {
      throw new NotFoundException('Usina nao encontrada no seu portfolio.');
    }

    // Buscar despesas onde responsavelPagamento = PROPRIETARIO OU COMPARTILHADO
    // E usinaId pertence ao proprietario.
    const despesas = await this.prisma.contaAPagar.findMany({
      where: {
        usinaId: { in: usinasFiltradas },
        responsavelPagamento: { in: ['PROPRIETARIO', 'COMPARTILHADO'] },
      },
      include: {
        usina: { select: { id: true, nome: true, apelidoInterno: true } },
      },
      orderBy: { dataVencimento: 'desc' },
    });

    return despesas.map((d) => ({
      id: d.id,
      descricao: d.descricao,
      categoria: d.categoria,
      valor: Number(d.valor),
      dataVencimento: d.dataVencimento,
      dataPagamento: d.dataPagamento,
      status: d.status,
      responsavelPagamento: d.responsavelPagamento,
      usina: d.usina,
      comprovante: d.comprovante,
    }));
  }
}
