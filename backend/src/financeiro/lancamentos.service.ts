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

  async livroCaixa(competencia: string, cooperativaId?: string) {
    const where: any = { competencia, status: { not: 'CANCELADO' } };
    if (cooperativaId) where.cooperativaId = cooperativaId;

    // Lançamentos do mês
    const lancamentos = await this.prisma.lancamentoCaixa.findMany({
      where,
      include: {
        planoContas: { select: { codigo: true, nome: true, grupo: true } },
        cooperado: { select: { id: true, nomeCompleto: true } },
      },
      orderBy: [{ tipo: 'asc' }, { createdAt: 'desc' }],
    });

    // Cobranças Asaas pagas no período (entradas)
    const [ano, mes] = competencia.split('-').map(Number);
    const inicioMes = new Date(ano, mes - 1, 1);
    const fimMes = new Date(ano, mes, 0, 23, 59, 59);

    const cobrancasAsaasPagas = await this.prisma.asaasCobranca.findMany({
      where: {
        status: { in: ['RECEIVED', 'CONFIRMED'] },
        updatedAt: { gte: inicioMes, lte: fimMes },
        ...(cooperativaId ? { cooperado: { cooperativaId } } : {}),
      },
      include: {
        cooperado: { select: { id: true, nomeCompleto: true } },
      },
      orderBy: { updatedAt: 'desc' },
    });

    const totalAsaasRecebido = cobrancasAsaasPagas.reduce((acc, c) => acc + Number(c.valor), 0);

    // Separar receitas e despesas dos lançamentos
    let totalReceitas = 0;
    let totalDespesas = 0;
    const entradas: any[] = [];
    const saidas: any[] = [];

    for (const l of lancamentos) {
      const item = {
        id: l.id,
        descricao: l.descricao,
        valor: Number(l.valor),
        tipo: l.tipo,
        status: l.status,
        categoria: l.planoContas?.grupo ?? 'OUTROS',
        categoriaNome: l.planoContas?.nome ?? l.descricao,
        cooperado: l.cooperado?.nomeCompleto ?? null,
        dataVencimento: l.dataVencimento,
        dataPagamento: l.dataPagamento,
      };
      if (l.tipo === 'RECEITA') {
        totalReceitas += item.valor;
        entradas.push(item);
      } else {
        totalDespesas += item.valor;
        saidas.push(item);
      }
    }

    // Entradas combinadas: lançamentos receita + Asaas
    const entradasAsaas = cobrancasAsaasPagas.map((c) => ({
      id: c.id,
      descricao: `Pagamento Asaas - ${c.cooperado?.nomeCompleto ?? 'N/A'}`,
      valor: Number(c.valor),
      tipo: 'RECEITA',
      status: 'REALIZADO',
      categoria: 'ASAAS',
      categoriaNome: 'Pagamento via Asaas',
      cooperado: c.cooperado?.nomeCompleto ?? null,
      dataVencimento: c.vencimento,
      dataPagamento: c.updatedAt,
      formaPagamento: c.formaPagamento,
    }));

    const totalEntradas = totalReceitas + totalAsaasRecebido;
    const saldoMes = totalEntradas - totalDespesas;

    // Histórico últimos 6 meses
    const historico: { competencia: string; receitas: number; despesas: number; saldo: number }[] = [];
    for (let i = 5; i >= 0; i--) {
      const d = new Date(ano, mes - 1 - i, 1);
      const comp = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      const wh: any = { competencia: comp, status: { not: 'CANCELADO' } };
      if (cooperativaId) wh.cooperativaId = cooperativaId;
      const lancs = await this.prisma.lancamentoCaixa.findMany({ where: wh });
      let rec = 0;
      let desp = 0;
      for (const l of lancs) {
        if (l.tipo === 'RECEITA') rec += Number(l.valor);
        else desp += Number(l.valor);
      }
      historico.push({ competencia: comp, receitas: rec, despesas: desp, saldo: rec - desp });
    }

    return {
      competencia,
      entradas: [...entradas, ...entradasAsaas],
      saidas,
      totalEntradas,
      totalDespesas,
      totalAsaasRecebido,
      totalLancamentosReceita: totalReceitas,
      saldoMes,
      historico,
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
