import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { CreatePlanoDto } from './dto/create-plano.dto';
import { UpdatePlanoDto } from './dto/update-plano.dto';
import { ModeloCobranca, TipoCampanha } from '@prisma/client';

@Injectable()
export class PlanosService {
  constructor(private prisma: PrismaService) {}

  findAll() {
    return this.prisma.plano.findMany({
      orderBy: { createdAt: 'desc' },
    });
  }

  findAtivos() {
    const hoje = new Date();
    return this.prisma.plano.findMany({
      where: {
        ativo: true,
        OR: [
          { dataFimVigencia: null },
          { dataFimVigencia: { gte: hoje } },
        ],
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findOne(id: string) {
    const plano = await this.prisma.plano.findUnique({ where: { id } });
    if (!plano) throw new NotFoundException(`Plano ${id} não encontrado`);
    return plano;
  }

  create(dto: CreatePlanoDto) {
    return this.prisma.plano.create({
      data: {
        nome: dto.nome,
        descricao: dto.descricao,
        modeloCobranca: dto.modeloCobranca as ModeloCobranca,
        descontoBase: dto.descontoBase,
        temPromocao: dto.temPromocao ?? false,
        descontoPromocional: dto.descontoPromocional ?? null,
        mesesPromocao: dto.mesesPromocao ?? null,
        publico: dto.publico ?? true,
        ativo: dto.ativo ?? true,
        tipoCampanha: (dto.tipoCampanha as TipoCampanha) ?? TipoCampanha.PADRAO,
        dataInicioVigencia: dto.dataInicioVigencia ? new Date(dto.dataInicioVigencia) : null,
        dataFimVigencia: dto.dataFimVigencia ? new Date(dto.dataFimVigencia) : null,
      },
    });
  }

  async update(id: string, dto: UpdatePlanoDto) {
    await this.findOne(id);
    return this.prisma.plano.update({
      where: { id },
      data: {
        ...(dto.nome !== undefined && { nome: dto.nome }),
        ...(dto.descricao !== undefined && { descricao: dto.descricao }),
        ...(dto.modeloCobranca !== undefined && { modeloCobranca: dto.modeloCobranca as ModeloCobranca }),
        ...(dto.descontoBase !== undefined && { descontoBase: dto.descontoBase }),
        ...(dto.temPromocao !== undefined && { temPromocao: dto.temPromocao }),
        ...(dto.descontoPromocional !== undefined && { descontoPromocional: dto.descontoPromocional }),
        ...(dto.mesesPromocao !== undefined && { mesesPromocao: dto.mesesPromocao }),
        ...(dto.publico !== undefined && { publico: dto.publico }),
        ...(dto.ativo !== undefined && { ativo: dto.ativo }),
        ...(dto.tipoCampanha !== undefined && { tipoCampanha: dto.tipoCampanha as TipoCampanha }),
        ...(dto.dataInicioVigencia !== undefined && { dataInicioVigencia: dto.dataInicioVigencia ? new Date(dto.dataInicioVigencia) : null }),
        ...(dto.dataFimVigencia !== undefined && { dataFimVigencia: dto.dataFimVigencia ? new Date(dto.dataFimVigencia) : null }),
      },
    });
  }

  async remove(id: string) {
    await this.findOne(id);
    await this.prisma.plano.delete({ where: { id } });
    return { sucesso: true };
  }
}
