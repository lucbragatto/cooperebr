import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { Decimal } from '@prisma/client/runtime/library';

@Injectable()
export class LancamentosService {
  private readonly logger = new Logger(LancamentosService.name);

  constructor(private prisma: PrismaService) {}

  async findAll(query?: { competencia?: string; cooperadoId?: string; tipo?: string; status?: string; cooperativaId?: string }) {
    const where: any = {};
    if (query?.competencia) where.competencia = query.competencia;
    if (query?.cooperadoId) where.cooperadoId = query.cooperadoId;
    if (query?.tipo) where.tipo = query.tipo;
    if (query?.status) where.status = query.status;
    if (query?.cooperativaId) where.cooperativaId = query.cooperativaId;

    return this.prisma.lancamentoCaixa.findMany({
      where,
      include: {
        planoContas: { select: { codigo: true, nome: true, grupo: true } },
        cooperado: { select: { id: true, nomeCompleto: true } },
        contratoUso: { select: { id: true, numero: true } },
        convenio: { select: { id: true, numero: true, empresaNome: true } },
      },
      orderBy: [{ competencia: 'desc' }, { createdAt: 'desc' }],
    });
  }

  async findOne(id: string) {
    const lancamento = await this.prisma.lancamentoCaixa.findUnique({
      where: { id },
      include: {
        planoContas: true,
        cooperado: { select: { id: true, nomeCompleto: true } },
        contratoUso: { select: { id: true, numero: true } },
        convenio: { select: { id: true, numero: true, empresaNome: true } },
      },
    });
    if (!lancamento) throw new NotFoundException(`Lançamento com id ${id} não encontrado`);
    return lancamento;
  }

  async create(data: {
    tipo: string;
    descricao: string;
    valor: number;
    competencia: string;
    dataVencimento?: Date | string;
    dataPagamento?: Date | string;
    status?: string;
    naturezaAto?: string;
    planoContasId?: string;
    cooperadoId?: string;
    contratoUsoId?: string;
    convenioId?: string;
    observacoes?: string;
    cooperativaId?: string;
  }) {
    return this.prisma.lancamentoCaixa.create({
      data: {
        ...data,
        dataVencimento: data.dataVencimento ? new Date(data.dataVencimento) : null,
        dataPagamento: data.dataPagamento ? new Date(data.dataPagamento) : null,
      },
    });
  }

  async update(id: string, data: Partial<{
    tipo: string;
    descricao: string;
    valor: number;
    competencia: string;
    dataVencimento: Date | string;
    status: string;
    naturezaAto: string;
    planoContasId: string;
    cooperadoId: string;
    contratoUsoId: string;
    convenioId: string;
    observacoes: string;
  }>) {
    await this.findOne(id);
    const updateData: any = { ...data };
    if (data.dataVencimento) updateData.dataVencimento = new Date(data.dataVencimento);
    return this.prisma.lancamentoCaixa.update({ where: { id }, data: updateData });
  }

  async realizar(id: string, dataPagamento?: Date | string) {
    await this.findOne(id);
    return this.prisma.lancamentoCaixa.update({
      where: { id },
      data: {
        status: 'REALIZADO',
        dataPagamento: dataPagamento ? new Date(dataPagamento) : new Date(),
      },
    });
  }

  async cancelar(id: string) {
    await this.findOne(id);
    return this.prisma.lancamentoCaixa.update({
      where: { id },
      data: { status: 'CANCELADO' },
    });
  }

  async resumo(competencia: string, cooperativaId?: string) {
    const where: any = { competencia, status: { not: 'CANCELADO' } };
    if (cooperativaId) where.cooperativaId = cooperativaId;
    const lancamentos = await this.prisma.lancamentoCaixa.findMany({
      where,
    });

    let totalReceitas = new Decimal(0);
    let totalDespesas = new Decimal(0);

    for (const l of lancamentos) {
      if (l.tipo === 'RECEITA') totalReceitas = totalReceitas.add(l.valor);
      else totalDespesas = totalDespesas.add(l.valor);
    }

    return {
      competencia,
      totalReceitas: Number(totalReceitas),
      totalDespesas: Number(totalDespesas),
      resultado: Number(totalReceitas.sub(totalDespesas)),
      totalLancamentos: lancamentos.length,
    };
  }

  async dre(competencia: string, cooperativaId?: string) {
    const where: any = { competencia, status: { not: 'CANCELADO' } };
    if (cooperativaId) where.cooperativaId = cooperativaId;
    const lancamentos = await this.prisma.lancamentoCaixa.findMany({
      where,
      include: { planoContas: { select: { grupo: true, nome: true, codigo: true } } },
    });

    const grupos: Record<string, { total: number; itens: { codigo: string; nome: string; valor: number }[] }> = {};
    let totalReceitas = 0;
    let totalDespesas = 0;

    for (const l of lancamentos) {
      const grupo = l.planoContas?.grupo ?? 'OUTROS';
      if (!grupos[grupo]) grupos[grupo] = { total: 0, itens: [] };

      const valor = Number(l.valor);
      grupos[grupo].total += valor;
      grupos[grupo].itens.push({
        codigo: l.planoContas?.codigo ?? '-',
        nome: l.planoContas?.nome ?? l.descricao,
        valor,
      });

      if (l.tipo === 'RECEITA') totalReceitas += valor;
      else totalDespesas += valor;
    }

    return {
      competencia,
      grupos,
      totalReceitas,
      totalDespesas,
      resultado: totalReceitas - totalDespesas,
    };
  }
}
