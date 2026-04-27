import { Injectable, NotFoundException, BadRequestException, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { PrismaService } from '../prisma.service';

@Injectable()
export class SaasService {
  private readonly logger = new Logger(SaasService.name);

  constructor(private prisma: PrismaService) {}

  // ─── Planos SaaS ──────────────────────────────────────────

  async findAllPlanos() {
    return this.prisma.planoSaas.findMany({
      orderBy: { createdAt: 'asc' },
      include: { _count: { select: { cooperativas: true } } },
    });
  }

  async findOnePlano(id: string) {
    const plano = await this.prisma.planoSaas.findUnique({
      where: { id },
      include: { cooperativas: { select: { id: true, nome: true, cnpj: true, statusSaas: true } } },
    });
    if (!plano) throw new NotFoundException('Plano SaaS não encontrado');
    return plano;
  }

  async createPlano(data: {
    nome: string;
    descricao?: string;
    taxaSetup?: number;
    mensalidadeBase?: number;
    limiteMembros?: number;
    percentualReceita?: number;
    modulosHabilitados?: string[];
    modalidadesModulos?: Record<string, string>;
  }) {
    return this.prisma.planoSaas.create({ data });
  }

  async updatePlano(id: string, data: Partial<{
    nome: string;
    descricao: string;
    taxaSetup: number;
    mensalidadeBase: number;
    limiteMembros: number;
    percentualReceita: number;
    ativo: boolean;
    modulosHabilitados: string[];
    modalidadesModulos: Record<string, string>;
  }>) {
    const plano = await this.prisma.planoSaas.findUnique({ where: { id } });
    if (!plano) throw new NotFoundException('Plano SaaS não encontrado');
    const updated = await this.prisma.planoSaas.update({ where: { id }, data });

    // Propagar módulos para todas as cooperativas vinculadas
    if (data.modulosHabilitados !== undefined || data.modalidadesModulos !== undefined) {
      await this.propagarModulosDoPlano(id);
    }

    return updated;
  }

  async deletePlano(id: string) {
    const plano = await this.prisma.planoSaas.findUnique({ where: { id }, include: { _count: { select: { cooperativas: true } } } });
    if (!plano) throw new NotFoundException('Plano SaaS não encontrado');
    if (plano._count.cooperativas > 0) {
      throw new BadRequestException(`Plano possui ${plano._count.cooperativas} parceiro(s) vinculado(s). Desvincule antes de excluir.`);
    }
    return this.prisma.planoSaas.delete({ where: { id } });
  }

  // ─── Vincular plano a parceiro ────────────────────────────

  async vincularPlano(cooperativaId: string, planoSaasId: string | null) {
    const coop = await this.prisma.cooperativa.findUnique({ where: { id: cooperativaId } });
    if (!coop) throw new NotFoundException('Parceiro não encontrado');

    let modulosAtivos: string[] = [];
    let modalidadesAtivas: Record<string, string> = {};

    if (planoSaasId) {
      const plano = await this.prisma.planoSaas.findUnique({ where: { id: planoSaasId } });
      if (!plano) throw new NotFoundException('Plano SaaS não encontrado');
      modulosAtivos = plano.modulosHabilitados;
      modalidadesAtivas = (plano.modalidadesModulos as Record<string, string>) ?? {};
    }

    return this.prisma.cooperativa.update({
      where: { id: cooperativaId },
      data: { planoSaasId, modulosAtivos, modalidadesAtivas },
      include: { planoSaas: true },
    });
  }

  async getModulosCooperativa(cooperativaId: string) {
    const coop = await this.prisma.cooperativa.findUnique({
      where: { id: cooperativaId },
      select: { modulosAtivos: true, modalidadesAtivas: true },
    });
    if (!coop) throw new NotFoundException('Parceiro não encontrado');
    return {
      modulosAtivos: coop.modulosAtivos,
      modalidadesAtivas: coop.modalidadesAtivas as Record<string, string>,
    };
  }

  /** Propaga módulos do plano para todas as cooperativas vinculadas */
  private async propagarModulosDoPlano(planoSaasId: string) {
    const plano = await this.prisma.planoSaas.findUnique({ where: { id: planoSaasId } });
    if (!plano) return;

    await this.prisma.cooperativa.updateMany({
      where: { planoSaasId },
      data: {
        modulosAtivos: plano.modulosHabilitados,
        modalidadesAtivas: plano.modalidadesModulos ?? {},
      },
    });
    this.logger.log(`Módulos propagados do plano ${plano.nome} para cooperativas vinculadas`);
  }

  // ─── Faturas SaaS ─────────────────────────────────────────

  /**
   * Cron mensal — dia 1 às 6h. Gera FaturaSaas pra cada parceiro
   * com plano ativo. Ticket 10 Sprint 6: primeira receita da plataforma.
   */
  @Cron('0 6 1 * *')
  async cronGerarFaturasMensal() {
    this.logger.log('Cron FaturaSaas: iniciando geração mensal...');
    try {
      const resultado = await this.gerarFaturasMensal();
      const criadas = resultado.faturas.filter(f => f.status === 'CRIADA').length;
      const jaExistiam = resultado.faturas.filter(f => f.status === 'JA_EXISTE').length;
      this.logger.log(
        `Cron FaturaSaas: ${criadas} criada(s), ${jaExistiam} já existia(m), ${resultado.total} parceiro(s) processado(s).`,
      );
    } catch (err) {
      this.logger.error(`Cron FaturaSaas falhou: ${(err as Error).message}`);
    }
  }

  async findAllFaturas(filtros?: { status?: string }) {
    return this.prisma.faturaSaas.findMany({
      where: filtros?.status ? { status: filtros.status } : undefined,
      include: { cooperativa: { select: { id: true, nome: true, cnpj: true } } },
      orderBy: { competencia: 'desc' },
    });
  }

  async gerarFaturasMensal() {
    const cooperativas = await this.prisma.cooperativa.findMany({
      where: {
        planoSaasId: { not: null },
        statusSaas: { in: ['ATIVO', 'TRIAL'] },
      },
      select: { id: true },
    });

    const resultados: { cooperativaId: string; nome: string; valor: number; status: string }[] = [];
    for (const c of cooperativas) {
      const r = await this.gerarFaturaParaCooperativa(c.id);
      resultados.push(r);
    }
    return { total: resultados.length, faturas: resultados };
  }

  /**
   * Gera FaturaSaas pra uma cooperativa específica.
   * - competencia default: primeiro dia do mês corrente
   * - idempotente: se já existe fatura na competência, retorna status 'JA_EXISTE'
   * - calcula valorBase (mensalidadeBase do plano) + valorReceita (% sobre cobranças pagas no mês anterior)
   */
  async gerarFaturaParaCooperativa(
    cooperativaId: string,
    competencia?: Date,
  ): Promise<{ cooperativaId: string; nome: string; valor: number; status: string; faturaId?: string }> {
    const hoje = new Date();
    const competenciaResolvida = competencia ?? new Date(hoje.getFullYear(), hoje.getMonth(), 1);

    const coop = await this.prisma.cooperativa.findUnique({
      where: { id: cooperativaId },
      include: { planoSaas: true },
    });
    if (!coop) {
      throw new Error(`Cooperativa ${cooperativaId} não encontrada`);
    }
    if (!coop.planoSaas) {
      throw new Error(`Cooperativa ${coop.nome} sem plano SaaS vinculado`);
    }

    const existente = await this.prisma.faturaSaas.findUnique({
      where: { cooperativaId_competencia: { cooperativaId: coop.id, competencia: competenciaResolvida } },
    });
    if (existente) {
      return {
        cooperativaId: coop.id,
        nome: coop.nome,
        valor: Number(existente.valorTotal),
        status: 'JA_EXISTE',
        faturaId: existente.id,
      };
    }

    const valorBase = Number(coop.planoSaas.mensalidadeBase);

    // % sobre receita: soma cobranças PAGAS no mês anterior à competência
    let valorReceita = 0;
    if (Number(coop.planoSaas.percentualReceita) > 0) {
      const mesAnterior = new Date(competenciaResolvida.getFullYear(), competenciaResolvida.getMonth() - 1, 1);
      const receitaMes = await this.prisma.cobranca.aggregate({
        where: {
          cooperativaId: coop.id,
          status: 'PAGO',
          competencia: { gte: mesAnterior, lt: competenciaResolvida },
        },
        _sum: { valorLiquido: true },
      });
      const receitaTotal = Number(receitaMes._sum.valorLiquido ?? 0);
      valorReceita = Math.round(receitaTotal * (Number(coop.planoSaas.percentualReceita) / 100) * 100) / 100;
    }

    const valorTotal = Math.round((valorBase + valorReceita) * 100) / 100;
    const dataVencimento = new Date(competenciaResolvida.getFullYear(), competenciaResolvida.getMonth(), coop.diaVencimentoSaas);
    if (dataVencimento < hoje) {
      dataVencimento.setMonth(dataVencimento.getMonth() + 1);
    }

    const fatura = await this.prisma.faturaSaas.create({
      data: {
        cooperativaId: coop.id,
        competencia: competenciaResolvida,
        valorBase,
        valorReceita,
        valorTotal,
        dataVencimento,
      },
    });
    this.logger.log(`Fatura SaaS criada: ${coop.nome} - R$ ${valorTotal.toFixed(2)} (${competenciaResolvida.toISOString().slice(0, 7)})`);

    return {
      cooperativaId: coop.id,
      nome: coop.nome,
      valor: valorTotal,
      status: 'CRIADA',
      faturaId: fatura.id,
    };
  }
}
