import { Injectable, NotFoundException, BadRequestException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../prisma.service';

@Injectable()
export class CondominiosService {
  constructor(private prisma: PrismaService) {}

  async findAll(cooperativaId?: string) {
    return this.prisma.condominio.findMany({
      where: { ...(cooperativaId ? { cooperativaId } : {}), ativo: true },
      include: {
        administradora: { select: { razaoSocial: true } },
        _count: { select: { unidades: { where: { ativo: true } } } },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findOne(id: string, cooperativaId?: string) {
    const cond = await this.prisma.condominio.findUnique({
      where: { id },
      include: {
        administradora: true,
        unidades: {
          where: { ativo: true },
          include: { cooperado: { select: { id: true, nomeCompleto: true, email: true, telefone: true } } },
          orderBy: { numero: 'asc' },
        },
      },
    });
    if (!cond) throw new NotFoundException('Condominio nao encontrado');
    if (cooperativaId && cond.cooperativaId !== cooperativaId) throw new NotFoundException('Condominio nao encontrado');
    return cond;
  }

  async create(data: {
    cooperativaId: string;
    nome: string;
    cnpj?: string;
    endereco: string;
    cidade: string;
    estado: string;
    cep?: string;
    administradoraId?: string;
    sindicoNome?: string;
    sindicoCpf?: string;
    sindicoEmail?: string;
    sindicoTelefone?: string;
    modeloRateio?: string;
    excedentePolitica?: string;
    excedentePixChave?: string;
    excedentePixTipo?: string;
    aliquotaIR?: number;
    aliquotaPIS?: number;
    aliquotaCOFINS?: number;
    taxaAdministrativa?: number;
  }) {
    return this.prisma.condominio.create({ data: data as any });
  }

  private assertOwnership(cond: { cooperativaId: string | null }, cooperativaId?: string) {
    if (cooperativaId && cond.cooperativaId !== cooperativaId) {
      throw new ForbiddenException('Condomínio não pertence à sua cooperativa');
    }
  }

  async update(id: string, data: any, cooperativaId?: string) {
    const cond = await this.prisma.condominio.findUnique({ where: { id } });
    if (!cond) throw new NotFoundException('Condominio nao encontrado');
    this.assertOwnership(cond, cooperativaId);
    return this.prisma.condominio.update({ where: { id }, data });
  }

  async remove(id: string, cooperativaId?: string) {
    const cond = await this.prisma.condominio.findUnique({ where: { id } });
    if (!cond) throw new NotFoundException('Condominio nao encontrado');
    this.assertOwnership(cond, cooperativaId);
    return this.prisma.condominio.update({ where: { id }, data: { ativo: false } });
  }

  async adicionarUnidade(condominioId: string, dto: { numero: string; cooperadoId?: string; fracaoIdeal?: number; percentualFixo?: number }, cooperativaId?: string) {
    const cond = await this.prisma.condominio.findUnique({ where: { id: condominioId } });
    if (!cond) throw new NotFoundException('Condominio nao encontrado');
    this.assertOwnership(cond, cooperativaId);
    return this.prisma.unidadeCondominio.create({
      data: { condominioId, ...dto },
    });
  }

  async removerUnidade(unidadeId: string, cooperativaId?: string) {
    const unidade = await this.prisma.unidadeCondominio.findUnique({
      where: { id: unidadeId },
      include: { condominio: { select: { cooperativaId: true } } },
    });
    if (!unidade) throw new NotFoundException('Unidade nao encontrada');
    if (cooperativaId && unidade.condominio?.cooperativaId !== cooperativaId) {
      throw new ForbiddenException('Unidade não pertence à sua cooperativa');
    }
    return this.prisma.unidadeCondominio.update({ where: { id: unidadeId }, data: { ativo: false } });
  }

  async calcularRateio(condominioId: string, energiaTotal: number) {
    const cond = await this.prisma.condominio.findUnique({
      where: { id: condominioId },
      include: {
        unidades: {
          where: { ativo: true },
          include: { cooperado: { select: { id: true, nomeCompleto: true, cotaKwhMensal: true } } },
        },
      },
    });
    if (!cond) throw new NotFoundException('Condominio nao encontrado');

    const unidades = cond.unidades;
    if (unidades.length === 0) return [];

    switch (cond.modeloRateio) {
      case 'PROPORCIONAL_CONSUMO': {
        const totalConsumo = unidades.reduce((acc, u) => acc + Number(u.cooperado?.cotaKwhMensal ?? 0), 0);
        if (totalConsumo === 0) {
          // Fallback para igualitario se nenhum consumo registrado
          const parteIgual = energiaTotal / unidades.length;
          return unidades.map(u => ({ unidadeId: u.id, numero: u.numero, cooperado: u.cooperado, kwhAlocado: Math.round(parteIgual * 100) / 100 }));
        }
        return unidades.map(u => {
          const consumo = Number(u.cooperado?.cotaKwhMensal ?? 0);
          const proporcao = consumo / totalConsumo;
          return { unidadeId: u.id, numero: u.numero, cooperado: u.cooperado, kwhAlocado: Math.round(energiaTotal * proporcao * 100) / 100 };
        });
      }
      case 'IGUALITARIO': {
        const parteIgual = energiaTotal / unidades.length;
        return unidades.map(u => ({ unidadeId: u.id, numero: u.numero, cooperado: u.cooperado, kwhAlocado: Math.round(parteIgual * 100) / 100 }));
      }
      case 'FRACAO_IDEAL': {
        const totalFracao = unidades.reduce((acc, u) => acc + (u.fracaoIdeal ?? 0), 0);
        if (totalFracao === 0) throw new BadRequestException('Nenhuma fracao ideal definida nas unidades');
        return unidades.map(u => {
          const fracao = (u.fracaoIdeal ?? 0) / totalFracao;
          return { unidadeId: u.id, numero: u.numero, cooperado: u.cooperado, kwhAlocado: Math.round(energiaTotal * fracao * 100) / 100 };
        });
      }
      case 'PERSONALIZADO': {
        const totalPercent = unidades.reduce((acc, u) => acc + (u.percentualFixo ?? 0), 0);
        if (totalPercent === 0) throw new BadRequestException('Nenhum percentual fixo definido nas unidades');
        return unidades.map(u => {
          const pct = (u.percentualFixo ?? 0) / totalPercent;
          return { unidadeId: u.id, numero: u.numero, cooperado: u.cooperado, kwhAlocado: Math.round(energiaTotal * pct * 100) / 100 };
        });
      }
      default:
        throw new BadRequestException(`Modelo de rateio desconhecido: ${cond.modeloRateio}`);
    }
  }

  async processarExcedente(condominioId: string, valorExcedente: number) {
    const cond = await this.prisma.condominio.findUnique({ where: { id: condominioId } });
    if (!cond) throw new NotFoundException('Condominio nao encontrado');

    switch (cond.excedentePolitica) {
      case 'CREDITO_PROXIMO_MES':
        return { politica: 'CREDITO_PROXIMO_MES', acao: 'Credito sera aplicado no proximo mes', valor: valorExcedente };
      case 'PIX_MENSAL':
        return {
          politica: 'PIX_MENSAL',
          acao: 'PIX a ser enviado',
          valor: valorExcedente,
          pixChave: cond.excedentePixChave,
          pixTipo: cond.excedentePixTipo,
        };
      case 'ABATER_TAXA_CONDOMINIO':
        return { politica: 'ABATER_TAXA_CONDOMINIO', acao: 'Abater na taxa condominial', valor: valorExcedente };
      default:
        return { politica: cond.excedentePolitica, acao: 'Desconhecido', valor: valorExcedente };
    }
  }
}
