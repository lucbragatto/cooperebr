import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma.service';

/**
 * Métricas agregadas cross-tenant pro Painel Super-Admin.
 *
 * IMPORTANTE: este service é INTENCIONALMENTE cross-tenant — Luciano (SUPER_ADMIN)
 * vê métricas de TODOS os parceiros. Outros services do sistema devem continuar
 * filtrando por cooperativaId; aqui é a exceção autorizada.
 *
 * Cache 5min: TODO Sprint 13b com @CacheKey/@CacheTTL ou Redis.
 */
@Injectable()
export class MetricasSaasService {
  constructor(private prisma: PrismaService) {}

  async getResumoGeral() {
    const [
      totalParceiros,
      parceirosPorTipo,
      totalMembrosAtivos,
      faturamentoMesAtual,
      mrr,
      inadimplenciaSaaS,
      parceirosComIncendio,
    ] = await Promise.all([
      this.contarParceirosAtivos(),
      this.contarParceirosPorTipo(),
      this.contarMembrosAtivos(),
      this.calcularFaturamentoMesAtual(),
      this.calcularMRR(),
      this.contarInadimplenciaSaaS(),
      this.detectarIncendios(),
    ]);

    return {
      totalParceiros,
      parceirosPorTipo,
      totalMembrosAtivos,
      faturamentoMesAtual,
      mrr,
      inadimplenciaSaaS,
      parceirosComIncendio,
      geradoEm: new Date(),
    };
  }

  private contarParceirosAtivos() {
    return this.prisma.cooperativa.count({ where: { ativo: true } });
  }

  private async contarParceirosPorTipo() {
    const grupos = await this.prisma.cooperativa.groupBy({
      by: ['tipoParceiro'],
      where: { ativo: true },
      _count: { _all: true },
    });
    return grupos.map((g) => ({
      tipo: g.tipoParceiro,
      count: g._count._all,
    }));
  }

  private contarMembrosAtivos() {
    return this.prisma.cooperado.count({
      where: {
        status: 'ATIVO',
        cooperativa: { ativo: true },
      },
    });
  }

  /** Faturamento dos PARCEIROS no mês atual (cobranças PAGAS dos cooperados deles). */
  private async calcularFaturamentoMesAtual() {
    const inicioMes = new Date();
    inicioMes.setDate(1);
    inicioMes.setHours(0, 0, 0, 0);

    const result = await this.prisma.cobranca.aggregate({
      where: {
        status: 'PAGO',
        dataPagamento: { gte: inicioMes },
      },
      _sum: { valorPago: true },
      _count: { _all: true },
    });

    return {
      totalReais: Math.round(Number(result._sum.valorPago ?? 0) * 100) / 100,
      totalCobrancas: result._count._all,
    };
  }

  /**
   * MRR (Monthly Recurring Revenue) que SISGD ganha dos parceiros.
   * Soma da mensalidadeBase + estimativa do percentualReceita aplicado nos
   * últimos 30 dias de cobranças PAGAS de cada parceiro.
   * Considera só `statusSaas = 'ATIVO'` (TRIAL não conta como receita realizada).
   */
  private async calcularMRR() {
    const parceirosComPlano = await this.prisma.cooperativa.findMany({
      where: {
        ativo: true,
        statusSaas: 'ATIVO',
        planoSaasId: { not: null },
      },
      include: { planoSaas: true },
    });

    let mrrFixo = 0;
    let mrrVariavelEstimado = 0;

    const inicioJanela = new Date();
    inicioJanela.setDate(inicioJanela.getDate() - 30);

    for (const parceiro of parceirosComPlano) {
      mrrFixo += Number(parceiro.planoSaas?.mensalidadeBase ?? 0);

      const faturamento = await this.prisma.cobranca.aggregate({
        where: {
          cooperativaId: parceiro.id,
          status: 'PAGO',
          dataPagamento: { gte: inicioJanela },
        },
        _sum: { valorPago: true },
      });

      const percentReceita = Number(parceiro.planoSaas?.percentualReceita ?? 0) / 100;
      mrrVariavelEstimado += Number(faturamento._sum.valorPago ?? 0) * percentReceita;
    }

    return {
      fixo: Math.round(mrrFixo * 100) / 100,
      variavelEstimado: Math.round(mrrVariavelEstimado * 100) / 100,
      total: Math.round((mrrFixo + mrrVariavelEstimado) * 100) / 100,
      parceirosContando: parceirosComPlano.length,
    };
  }

  /** Inadimplência SaaS = FaturaSaas vencidas (parceiro não pagou Luciano). */
  private async contarInadimplenciaSaaS() {
    const hoje = new Date();
    const [qtd, ag] = await Promise.all([
      this.prisma.faturaSaas.count({
        where: {
          status: { in: ['PENDENTE', 'VENCIDO'] },
          dataVencimento: { lt: hoje },
        },
      }),
      this.prisma.faturaSaas.aggregate({
        where: {
          status: { in: ['PENDENTE', 'VENCIDO'] },
          dataVencimento: { lt: hoje },
        },
        _sum: { valorTotal: true },
      }),
    ]);
    return {
      qtdFaturasVencidas: qtd,
      valorVencido: Math.round(Number(ag._sum.valorTotal ?? 0) * 100) / 100,
    };
  }

  /**
   * Lista enriquecida de parceiros com saúde de cada um.
   * Usado pela tela /dashboard/super-admin/parceiros.
   *
   * Implementado com aggregate single-pass + groupBy pra evitar N+1.
   * Não fazer 1 query por parceiro como em detectarIncendios (esse método é débito P3).
   */
  async getListaParceirosEnriquecida() {
    const parceiros = await this.prisma.cooperativa.findMany({
      where: { ativo: true },
      include: {
        planoSaas: {
          select: {
            id: true,
            nome: true,
            mensalidadeBase: true,
            percentualReceita: true,
          },
        },
      },
      orderBy: { nome: 'asc' },
    });

    if (parceiros.length === 0) return [];

    const cooperativaIds = parceiros.map((p) => p.id);
    const inicioMes = new Date();
    inicioMes.setDate(1);
    inicioMes.setHours(0, 0, 0, 0);

    const [membrosTotais, membrosAtivos, contratosAtivos, cobrancasMes] = await Promise.all([
      this.prisma.cooperado.groupBy({
        by: ['cooperativaId'],
        where: { cooperativaId: { in: cooperativaIds } },
        _count: { _all: true },
      }),
      this.prisma.cooperado.groupBy({
        by: ['cooperativaId'],
        where: {
          cooperativaId: { in: cooperativaIds },
          status: 'ATIVO',
        },
        _count: { _all: true },
      }),
      this.prisma.contrato.groupBy({
        by: ['cooperativaId'],
        where: {
          cooperativaId: { in: cooperativaIds },
          status: 'ATIVO',
        },
        _count: { _all: true },
      }),
      this.prisma.cobranca.groupBy({
        by: ['cooperativaId', 'status'],
        where: {
          cooperativaId: { in: cooperativaIds },
          dataVencimento: { gte: inicioMes },
        },
        _count: { _all: true },
        _sum: { valorPago: true },
      }),
    ]);

    const idxMembros = new Map(membrosTotais.map((m) => [m.cooperativaId, m._count._all]));
    const idxAtivos = new Map(membrosAtivos.map((m) => [m.cooperativaId, m._count._all]));
    const idxContratos = new Map(contratosAtivos.map((c) => [c.cooperativaId, c._count._all]));

    const idxCobrancasPorCoop = new Map<
      string,
      { total: number; pagas: number; vencidas: number; receitaPaga: number }
    >();
    for (const row of cobrancasMes) {
      if (!row.cooperativaId) continue;
      const atual =
        idxCobrancasPorCoop.get(row.cooperativaId) ??
        { total: 0, pagas: 0, vencidas: 0, receitaPaga: 0 };
      atual.total += row._count._all;
      if (row.status === 'PAGO') {
        atual.pagas += row._count._all;
        atual.receitaPaga += Number(row._sum.valorPago ?? 0);
      }
      if (row.status === 'VENCIDO') atual.vencidas += row._count._all;
      idxCobrancasPorCoop.set(row.cooperativaId, atual);
    }

    return parceiros.map((p) => {
      const cob =
        idxCobrancasPorCoop.get(p.id) ?? { total: 0, pagas: 0, vencidas: 0, receitaPaga: 0 };
      const taxaInadimplencia =
        cob.total > 0 ? Math.round((cob.vencidas / cob.total) * 10000) / 100 : 0;

      let saudeCor: 'verde' | 'amarelo' | 'vermelho' = 'verde';
      if (taxaInadimplencia > 20 && cob.total >= 5) saudeCor = 'vermelho';
      else if (taxaInadimplencia > 10 && cob.total >= 3) saudeCor = 'amarelo';

      return {
        id: p.id,
        nome: p.nome,
        cnpj: p.cnpj,
        tipoParceiro: p.tipoParceiro,
        ativo: p.ativo,
        statusSaas: p.statusSaas,
        planoSaas: p.planoSaas
          ? {
              id: p.planoSaas.id,
              nome: p.planoSaas.nome,
              mensalidadeBase: Number(p.planoSaas.mensalidadeBase),
            }
          : null,
        membros: {
          total: idxMembros.get(p.id) ?? 0,
          ativos: idxAtivos.get(p.id) ?? 0,
        },
        contratosAtivos: idxContratos.get(p.id) ?? 0,
        cobrancasMes: {
          total: cob.total,
          pagas: cob.pagas,
          vencidas: cob.vencidas,
          receitaPaga: Math.round(cob.receitaPaga * 100) / 100,
        },
        saude: {
          cor: saudeCor,
          taxaInadimplencia,
        },
        criadoEm: p.createdAt,
      };
    });
  }

  /** "Incêndios" = parceiros com >20% de cobranças VENCIDAS (mín 5 cobranças). */
  private async detectarIncendios() {
    const cooperativas = await this.prisma.cooperativa.findMany({
      where: { ativo: true },
      select: { id: true, nome: true },
    });

    const incendios: Array<{
      cooperativaId: string;
      nome: string;
      totalCobrancas: number;
      vencidas: number;
      taxaVencimentoPerc: number;
    }> = [];

    for (const c of cooperativas) {
      const [total, vencidas] = await Promise.all([
        this.prisma.cobranca.count({ where: { cooperativaId: c.id } }),
        this.prisma.cobranca.count({ where: { cooperativaId: c.id, status: 'VENCIDO' } }),
      ]);
      const taxa = total > 0 ? (vencidas / total) * 100 : 0;
      if (taxa > 20 && total >= 5) {
        incendios.push({
          cooperativaId: c.id,
          nome: c.nome,
          totalCobrancas: total,
          vencidas,
          taxaVencimentoPerc: Math.round(taxa * 100) / 100,
        });
      }
    }
    return incendios;
  }
}
