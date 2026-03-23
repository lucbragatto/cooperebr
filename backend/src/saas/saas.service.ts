import { Injectable, NotFoundException, BadRequestException, Logger } from '@nestjs/common';
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
  }>) {
    const plano = await this.prisma.planoSaas.findUnique({ where: { id } });
    if (!plano) throw new NotFoundException('Plano SaaS não encontrado');
    return this.prisma.planoSaas.update({ where: { id }, data });
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
    if (planoSaasId) {
      const plano = await this.prisma.planoSaas.findUnique({ where: { id: planoSaasId } });
      if (!plano) throw new NotFoundException('Plano SaaS não encontrado');
    }
    return this.prisma.cooperativa.update({
      where: { id: cooperativaId },
      data: { planoSaasId },
      include: { planoSaas: true },
    });
  }

  // ─── Faturas SaaS ─────────────────────────────────────────

  async findAllFaturas(filtros?: { status?: string }) {
    return this.prisma.faturaSaas.findMany({
      where: filtros?.status ? { status: filtros.status } : undefined,
      include: { cooperativa: { select: { id: true, nome: true, cnpj: true } } },
      orderBy: { competencia: 'desc' },
    });
  }

  async gerarFaturasMensal() {
    const hoje = new Date();
    const competencia = new Date(hoje.getFullYear(), hoje.getMonth(), 1);

    const cooperativas = await this.prisma.cooperativa.findMany({
      where: {
        planoSaasId: { not: null },
        statusSaas: { in: ['ATIVO', 'TRIAL'] },
      },
      include: { planoSaas: true },
    });

    const resultados: { cooperativaId: string; nome: string; valor: number; status: string }[] = [];

    for (const coop of cooperativas) {
      if (!coop.planoSaas) continue;

      // Verificar se já existe fatura para essa competência
      const existente = await this.prisma.faturaSaas.findUnique({
        where: { cooperativaId_competencia: { cooperativaId: coop.id, competencia } },
      });
      if (existente) {
        resultados.push({ cooperativaId: coop.id, nome: coop.nome, valor: Number(existente.valorTotal), status: 'JA_EXISTE' });
        continue;
      }

      const valorBase = Number(coop.planoSaas.mensalidadeBase);

      // Calcular % sobre receita dos membros (cobranças pagas no mês)
      let valorReceita = 0;
      if (Number(coop.planoSaas.percentualReceita) > 0) {
        const mesAnterior = new Date(hoje.getFullYear(), hoje.getMonth() - 1, 1);
        const receitaMes = await this.prisma.cobranca.aggregate({
          where: {
            cooperativaId: coop.id,
            status: 'PAGO',
            competencia: { gte: mesAnterior, lt: competencia },
          },
          _sum: { valorLiquido: true },
        });
        const receitaTotal = Number(receitaMes._sum.valorLiquido ?? 0);
        valorReceita = receitaTotal * (Number(coop.planoSaas.percentualReceita) / 100);
      }

      const valorTotal = valorBase + valorReceita;
      const diaVenc = coop.diaVencimentoSaas;
      const dataVencimento = new Date(hoje.getFullYear(), hoje.getMonth(), diaVenc);
      if (dataVencimento < hoje) {
        dataVencimento.setMonth(dataVencimento.getMonth() + 1);
      }

      const fatura = await this.prisma.faturaSaas.create({
        data: {
          cooperativaId: coop.id,
          competencia,
          valorBase,
          valorReceita,
          valorTotal,
          dataVencimento,
        },
      });

      resultados.push({ cooperativaId: coop.id, nome: coop.nome, valor: valorTotal, status: 'CRIADA' });
      this.logger.log(`Fatura SaaS criada: ${coop.nome} - R$ ${valorTotal.toFixed(2)}`);
    }

    return { total: resultados.length, faturas: resultados };
  }
}
