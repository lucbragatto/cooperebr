import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { TipoBeneficioConvenio } from '@prisma/client';
import { PrismaService } from '../prisma.service';
import { CreateConvenioDto } from './dto/create-convenio.dto';
import { UpdateConvenioDto } from './dto/update-convenio.dto';

/**
 * D-novo-BR-CT CT.2 — CRUD do model Convenio (contabilidade segregada).
 * NÃO confundir com ContratoConvenio (legado, foco MLM/desconto).
 *
 * Validação: tipoBeneficio fixado em ENERGIA_SCEE no MVP — outros tipos
 * rejeitados (decisão Luciano 17/05). Quando flag de feature ativar
 * outros tipos por demanda real, removemos esta validação.
 *
 * Multi-tenant: cooperativaId vem do controller (JWT, não body).
 * Posse via @TenantResource no controller (Guard sistêmico F1.1+F1.2).
 */
@Injectable()
export class ConveniosCtService {
  constructor(private readonly prisma: PrismaService) {}

  async create(dto: CreateConvenioDto, cooperativaId: string) {
    const tipo = dto.tipoBeneficio ?? TipoBeneficioConvenio.ENERGIA_SCEE;
    if (tipo !== TipoBeneficioConvenio.ENERGIA_SCEE) {
      throw new BadRequestException(
        `Tipo de benefício '${tipo}' não habilitado em produção. ` +
          'Apenas ENERGIA_SCEE liberado na fase atual (decisão Luciano 17/05).',
      );
    }
    return this.prisma.convenio.create({
      data: {
        cooperativaId,
        nome: dto.nome,
        descricao: dto.descricao ?? null,
        tipoBeneficio: tipo,
        fluxoFinanceiro: dto.fluxoFinanceiro,
        classificacaoFiscal: dto.classificacaoFiscal,
        vigenciaInicio: new Date(dto.vigenciaInicio),
        vigenciaFim: dto.vigenciaFim ? new Date(dto.vigenciaFim) : null,
        observacoes: dto.observacoes ?? null,
      },
    });
  }

  async findAll(cooperativaId?: string | null) {
    return this.prisma.convenio.findMany({
      where: cooperativaId ? { cooperativaId } : undefined,
      orderBy: { createdAt: 'desc' },
    });
  }

  async findOne(id: string, cooperativaId?: string | null) {
    const conv = cooperativaId
      ? await this.prisma.convenio.findFirst({ where: { id, cooperativaId } })
      : await this.prisma.convenio.findUnique({ where: { id } });
    if (!conv) throw new NotFoundException('Convenio não encontrado');
    return conv;
  }

  async update(id: string, dto: UpdateConvenioDto, cooperativaId?: string | null) {
    if (dto.tipoBeneficio && dto.tipoBeneficio !== TipoBeneficioConvenio.ENERGIA_SCEE) {
      throw new BadRequestException(
        `Tipo de benefício '${dto.tipoBeneficio}' não habilitado em produção.`,
      );
    }
    // Defesa em profundidade (Guard já validou posse via @TenantResource)
    if (cooperativaId) {
      const exists = await this.prisma.convenio.findFirst({
        where: { id, cooperativaId },
        select: { id: true },
      });
      if (!exists) throw new NotFoundException('Convenio não encontrado');
    }
    const data: any = {};
    if (dto.nome !== undefined) data.nome = dto.nome;
    if (dto.descricao !== undefined) data.descricao = dto.descricao;
    if (dto.tipoBeneficio !== undefined) data.tipoBeneficio = dto.tipoBeneficio;
    if (dto.fluxoFinanceiro !== undefined) data.fluxoFinanceiro = dto.fluxoFinanceiro;
    if (dto.classificacaoFiscal !== undefined) data.classificacaoFiscal = dto.classificacaoFiscal;
    if (dto.vigenciaInicio !== undefined) data.vigenciaInicio = new Date(dto.vigenciaInicio);
    if (dto.vigenciaFim !== undefined) data.vigenciaFim = dto.vigenciaFim ? new Date(dto.vigenciaFim) : null;
    if (dto.ativo !== undefined) data.ativo = dto.ativo;
    if (dto.observacoes !== undefined) data.observacoes = dto.observacoes;

    return this.prisma.convenio.update({ where: { id }, data });
  }

  async remove(id: string, cooperativaId?: string | null) {
    if (cooperativaId) {
      const exists = await this.prisma.convenio.findFirst({
        where: { id, cooperativaId },
        select: { id: true },
      });
      if (!exists) throw new NotFoundException('Convenio não encontrado');
    }
    // Soft-delete (ativo=false) preserva histórico contábil
    return this.prisma.convenio.update({ where: { id }, data: { ativo: false } });
  }
}
