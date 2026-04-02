import { Injectable, Logger, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma.service';

@Injectable()
export class ConveniosService {
  private readonly logger = new Logger(ConveniosService.name);

  constructor(private prisma: PrismaService) {}

  async findAll(cooperativaId?: string) {
    return this.prisma.contratoConvenio.findMany({
      where: cooperativaId ? { cooperativaId } : undefined,
      include: {
        _count: { select: { cooperados: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findOne(id: string) {
    const convenio = await this.prisma.contratoConvenio.findUnique({
      where: { id },
      include: {
        cooperados: {
          include: { cooperado: { select: { id: true, nomeCompleto: true, cpf: true } } },
        },
      },
    });
    if (!convenio) throw new NotFoundException(`Convênio com id ${id} não encontrado`);
    return convenio;
  }

  private async gerarNumero(): Promise<string> {
    const ano = new Date().getFullYear();
    const ultimo = await this.prisma.contratoConvenio.findFirst({
      where: { numero: { startsWith: `CV-${ano}-` } },
      orderBy: { createdAt: 'desc' },
    });
    const seq = ultimo
      ? parseInt(ultimo.numero.split('-')[2] ?? '0', 10) + 1
      : 1;
    return `CV-${ano}-${String(seq).padStart(4, '0')}`;
  }

  async create(data: {
    empresaNome: string;
    empresaCnpj: string;
    empresaEmail?: string;
    empresaTelefone?: string;
    tipoDesconto: string;
    diaEnvioRelatorio?: number;
    diaDesconto?: number;
    cooperativaId?: string;
  }) {
    const numero = await this.gerarNumero();
    return this.prisma.contratoConvenio.create({
      data: { ...data, numero },
    });
  }

  async update(id: string, data: Partial<{
    empresaNome: string;
    empresaCnpj: string;
    empresaEmail: string;
    empresaTelefone: string;
    tipoDesconto: string;
    diaEnvioRelatorio: number;
    diaDesconto: number;
    status: string;
  }>) {
    await this.findOne(id);
    return this.prisma.contratoConvenio.update({ where: { id }, data });
  }

  async vincularCooperado(convenioId: string, data: { cooperadoId: string; matricula?: string }) {
    await this.findOne(convenioId);

    const cooperado = await this.prisma.cooperado.findUnique({ where: { id: data.cooperadoId } });
    if (!cooperado) throw new NotFoundException('Cooperado não encontrado');

    const existente = await this.prisma.convenioCooperado.findUnique({
      where: { convenioId_cooperadoId: { convenioId, cooperadoId: data.cooperadoId } },
    });
    if (existente) {
      if (existente.ativo) throw new BadRequestException('Cooperado já vinculado a este convênio');
      // Reativar se estava inativo
      return this.prisma.convenioCooperado.update({
        where: { id: existente.id },
        data: { ativo: true, matricula: data.matricula ?? existente.matricula },
      });
    }

    return this.prisma.convenioCooperado.create({
      data: {
        convenioId,
        cooperadoId: data.cooperadoId,
        matricula: data.matricula,
      },
    });
  }

  async desvincularCooperado(convenioId: string, cooperadoId: string) {
    const vinculo = await this.prisma.convenioCooperado.findUnique({
      where: { convenioId_cooperadoId: { convenioId, cooperadoId } },
    });
    if (!vinculo) throw new NotFoundException('Vínculo não encontrado');

    return this.prisma.convenioCooperado.update({
      where: { id: vinculo.id },
      data: { ativo: false },
    });
  }

  async relatorio(convenioId: string, competencia: string) {
    const convenio = await this.prisma.contratoConvenio.findUnique({
      where: { id: convenioId },
      include: {
        cooperados: {
          where: { ativo: true },
          include: { cooperado: { select: { id: true, nomeCompleto: true, cpf: true } } },
        },
      },
    });
    if (!convenio) throw new NotFoundException('Convênio não encontrado');

    // Buscar lançamentos dos cooperados vinculados nesta competência
    const cooperadoIds = convenio.cooperados.map(c => c.cooperadoId);
    const lancamentos = await this.prisma.lancamentoCaixa.findMany({
      where: {
        cooperadoId: { in: cooperadoIds },
        competencia,
        status: { not: 'CANCELADO' },
      },
    });

    const lancamentosMap = new Map<string, number>();
    for (const l of lancamentos) {
      if (l.cooperadoId) {
        lancamentosMap.set(l.cooperadoId, (lancamentosMap.get(l.cooperadoId) ?? 0) + Number(l.valor));
      }
    }

    const itens = convenio.cooperados.map(vc => ({
      cooperadoId: vc.cooperadoId,
      nomeCompleto: vc.cooperado.nomeCompleto,
      cpf: vc.cooperado.cpf,
      matricula: vc.matricula ?? '',
      valor: lancamentosMap.get(vc.cooperadoId) ?? 0,
    }));

    const totalGeral = itens.reduce((acc, i) => acc + i.valor, 0);

    return {
      empresa: convenio.empresaNome,
      cnpj: convenio.empresaCnpj,
      competencia,
      tipoDesconto: convenio.tipoDesconto,
      totalCooperados: itens.length,
      totalGeral,
      itens,
    };
  }

  relatorioCsv(relatorio: {
    empresa: string;
    cnpj: string | null;
    competencia: string;
    itens: { nomeCompleto: string; matricula: string; valor: number }[];
  }): string {
    const linhas: string[] = [];
    linhas.push(`Empresa;${relatorio.empresa}`);
    linhas.push(`CNPJ;${relatorio.cnpj ?? ''}`);
    linhas.push(`Competencia;${relatorio.competencia}`);
    linhas.push('');
    linhas.push('Cooperado;Matricula;Valor');
    for (const item of relatorio.itens) {
      linhas.push(`${item.nomeCompleto};${item.matricula};${item.valor.toFixed(2)}`);
    }
    return linhas.join('\n');
  }
}
