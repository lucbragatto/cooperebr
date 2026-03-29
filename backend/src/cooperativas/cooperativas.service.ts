import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { getLabelMembro } from './tipo-parceiro.helper';
import * as QRCode from 'qrcode';

@Injectable()
export class CooperativasService {
  constructor(private prisma: PrismaService) {}

  private enriquecer(cooperativa: any) {
    const label = getLabelMembro(cooperativa.tipoParceiro);
    return {
      ...cooperativa,
      tipoMembro: label.singular,
      tipoMembroPlural: label.plural,
      iconeParceiro: label.icone,
    };
  }

  async findAll() {
    const cooperativas = await this.prisma.cooperativa.findMany({
      orderBy: { nome: 'asc' },
      include: { planoSaas: true },
    });

    return Promise.all(
      cooperativas.map(async (c) => {
        const [qtdUsinas, qtdCooperados] = await Promise.all([
          this.prisma.usina.count({ where: { cooperativaId: c.id } }),
          this.prisma.cooperado.count({
            where: { cooperativaId: c.id, status: { in: ['ATIVO', 'APROVADO'] } },
          }),
        ]);
        return this.enriquecer({ ...c, qtdUsinas, qtdCooperados });
      }),
    );
  }

  async findOne(id: string) {
    const cooperativa = await this.prisma.cooperativa.findUnique({
      where: { id },
      include: { usinas: true, planoSaas: true },
    });
    if (!cooperativa) {
      throw new NotFoundException(`Cooperativa com id ${id} não encontrada`);
    }
    return this.enriquecer(cooperativa);
  }

  async create(data: {
    nome: string;
    cnpj: string;
    email?: string;
    telefone?: string;
    endereco?: string;
    numero?: string;
    bairro?: string;
    cidade?: string;
    estado?: string;
    cep?: string;
    ativo?: boolean;
    tipoParceiro?: string;
  }) {
    const existe = await this.prisma.cooperativa.findUnique({
      where: { cnpj: data.cnpj },
    });
    if (existe) {
      throw new BadRequestException(`Já existe uma cooperativa com o CNPJ ${data.cnpj}`);
    }
    const created = await this.prisma.cooperativa.create({ data });
    return this.enriquecer(created);
  }

  async update(
    id: string,
    data: Partial<{
      nome: string;
      cnpj: string;
      email: string;
      telefone: string;
      endereco: string;
      numero: string;
      bairro: string;
      cidade: string;
      estado: string;
      cep: string;
      ativo: boolean;
      tipoParceiro: string;
      planoSaasId: string;
      diaVencimentoSaas: number;
      statusSaas: string;
      multaAtraso: number;
      jurosDiarios: number;
      diasCarencia: number;
    }>,
  ) {
    const cooperativa = await this.prisma.cooperativa.findUnique({ where: { id } });
    if (!cooperativa) {
      throw new NotFoundException(`Cooperativa com id ${id} não encontrada`);
    }
    const updated = await this.prisma.cooperativa.update({ where: { id }, data });
    return this.enriquecer(updated);
  }

  async getFinanceiro(id: string) {
    const coop = await this.prisma.cooperativa.findUnique({
      where: { id },
      select: { id: true, nome: true, multaAtraso: true, jurosDiarios: true, diasCarencia: true },
    });
    if (!coop) throw new NotFoundException(`Cooperativa com id ${id} não encontrada`);
    return {
      id: coop.id,
      nome: coop.nome,
      multaAtraso: Number(coop.multaAtraso),
      jurosDiarios: Number(coop.jurosDiarios),
      diasCarencia: coop.diasCarencia,
    };
  }

  async updateFinanceiro(id: string, data: { multaAtraso?: number; jurosDiarios?: number; diasCarencia?: number }) {
    const coop = await this.prisma.cooperativa.findUnique({ where: { id } });
    if (!coop) throw new NotFoundException(`Cooperativa com id ${id} não encontrada`);
    return this.prisma.cooperativa.update({
      where: { id },
      data,
      select: { id: true, multaAtraso: true, jurosDiarios: true, diasCarencia: true },
    });
  }

  async painelParceiro(id: string) {
    const cooperativa = await this.prisma.cooperativa.findUnique({
      where: { id },
      select: { id: true, nome: true, cnpj: true, tipoParceiro: true, cidade: true, estado: true },
    });
    if (!cooperativa) throw new NotFoundException(`Cooperativa com id ${id} não encontrada`);

    const [totalMembros, ativos, pendentes, inativos, cooperadosComIndicacoes] = await Promise.all([
      this.prisma.cooperado.count({ where: { cooperativaId: id } }),
      this.prisma.cooperado.count({ where: { cooperativaId: id, status: { in: ['ATIVO', 'ATIVO_RECEBENDO_CREDITOS', 'APROVADO'] } } }),
      this.prisma.cooperado.count({ where: { cooperativaId: id, status: { in: ['PENDENTE', 'PENDENTE_VALIDACAO', 'PENDENTE_DOCUMENTOS', 'AGUARDANDO_CONCESSIONARIA'] } } }),
      this.prisma.cooperado.count({ where: { cooperativaId: id, status: { in: ['SUSPENSO', 'ENCERRADO'] } } }),
      this.prisma.cooperado.findMany({
        where: { cooperativaId: id },
        select: { id: true, nomeCompleto: true, codigoIndicacao: true, _count: { select: { indicacoesFeitas: true } } },
        orderBy: { createdAt: 'desc' },
      }),
    ]);

    const totalIndicacoes = cooperadosComIndicacoes.reduce((acc, c) => acc + c._count.indicacoesFeitas, 0);

    const label = getLabelMembro(cooperativa.tipoParceiro);
    const slug = cooperativa.nome
      .toLowerCase()
      .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)/g, '');

    return {
      cooperativa: {
        ...cooperativa,
        tipoMembro: label.singular,
        tipoMembroPlural: label.plural,
      },
      totalMembros,
      ativos,
      pendentes,
      inativos,
      totalIndicacoes,
      linkConvite: `/entrar?ref=${slug}`,
      membrosRecentes: cooperadosComIndicacoes.slice(0, 10).map((c) => ({
        id: c.id,
        nome: c.nomeCompleto,
        indicacoes: c._count.indicacoesFeitas,
        codigoIndicacao: c.codigoIndicacao,
      })),
    };
  }

  async meuDashboard(cooperativaId: string) {
    const now = new Date();
    const mesAtual = now.getMonth() + 1;
    const anoAtual = now.getFullYear();

    const [membrosTotal, membrosAtivos, inadimplentes, receitaAgg] = await Promise.all([
      this.prisma.cooperado.count({ where: { cooperativaId } }),
      this.prisma.cooperado.count({
        where: { cooperativaId, status: { in: ['ATIVO', 'ATIVO_RECEBENDO_CREDITOS', 'APROVADO'] } },
      }),
      this.prisma.cobranca.count({
        where: { cooperativaId, status: 'VENCIDO' },
      }),
      this.prisma.cobranca.aggregate({
        _sum: { valorLiquido: true },
        where: {
          cooperativaId,
          status: 'PAGO',
          mesReferencia: mesAtual,
          anoReferencia: anoAtual,
        },
      }),
    ]);

    return {
      membrosAtivos,
      membrosTotal,
      inadimplentes,
      receitaMes: Number(receitaAgg._sum.valorLiquido ?? 0),
    };
  }

  async gerarQrCode(id: string) {
    const cooperativa = await this.prisma.cooperativa.findUnique({ where: { id } });
    if (!cooperativa) throw new NotFoundException(`Cooperativa com id ${id} não encontrada`);

    const slug = cooperativa.nome
      .toLowerCase()
      .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)/g, '');

    const url = `/entrar?ref=coop-${slug}`;
    const frontendUrl = process.env.FRONTEND_URL || 'https://app.cooperebr.com.br';
    const fullUrl = `${frontendUrl}${url}`;

    const qrBase64 = await QRCode.toDataURL(fullUrl, { width: 400, margin: 2 });

    return { qrCode: qrBase64, url: fullUrl, cooperativaId: id, nome: cooperativa.nome };
  }

  async remove(id: string) {
    const cooperativa = await this.prisma.cooperativa.findUnique({ where: { id } });
    if (!cooperativa) {
      throw new NotFoundException(`Cooperativa com id ${id} não encontrada`);
    }

    const [qtdUsinas, qtdCooperados] = await Promise.all([
      this.prisma.usina.count({ where: { cooperativaId: id } }),
      this.prisma.cooperado.count({ where: { cooperativaId: id } }),
    ]);

    if (qtdUsinas > 0) {
      throw new BadRequestException(
        `Cooperativa possui ${qtdUsinas} usina(s) vinculada(s). Remova as usinas antes de excluir.`,
      );
    }
    if (qtdCooperados > 0) {
      throw new BadRequestException(
        `Cooperativa possui ${qtdCooperados} cooperado(s) vinculado(s). Remova os cooperados antes de excluir.`,
      );
    }

    return this.prisma.cooperativa.delete({ where: { id } });
  }
}
