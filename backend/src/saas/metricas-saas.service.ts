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
