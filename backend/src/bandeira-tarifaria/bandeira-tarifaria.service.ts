import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { CreateBandeiraDto } from './dto/create-bandeira.dto';
import { UpdateBandeiraDto } from './dto/update-bandeira.dto';

@Injectable()
export class BandeiraTarifariaService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(cooperativaId: string, filters?: { tipo?: string }) {
    const where: Record<string, unknown> = { cooperativaId };
    if (filters?.tipo) {
      where.tipo = filters.tipo;
    }
    return this.prisma.bandeiraTarifaria.findMany({
      where,
      orderBy: { dataInicio: 'desc' },
    });
  }

  async findOne(id: string, cooperativaId: string) {
    const bandeira = await this.prisma.bandeiraTarifaria.findFirst({
      where: { id, cooperativaId },
    });
    if (!bandeira) {
      throw new NotFoundException('Bandeira tarifária não encontrada');
    }
    return bandeira;
  }

  async create(cooperativaId: string, dto: CreateBandeiraDto) {
    return this.prisma.bandeiraTarifaria.create({
      data: {
        cooperativaId,
        tipo: dto.tipo,
        valorPor100Kwh: dto.valorPor100Kwh,
        dataInicio: new Date(dto.dataInicio),
        dataFim: new Date(dto.dataFim),
        observacao: dto.observacao ?? null,
      },
    });
  }

  async update(id: string, cooperativaId: string, dto: UpdateBandeiraDto) {
    await this.findOne(id, cooperativaId);

    const data: Record<string, unknown> = {};
    if (dto.tipo !== undefined) data.tipo = dto.tipo;
    if (dto.valorPor100Kwh !== undefined) data.valorPor100Kwh = dto.valorPor100Kwh;
    if (dto.dataInicio !== undefined) data.dataInicio = new Date(dto.dataInicio);
    if (dto.dataFim !== undefined) data.dataFim = new Date(dto.dataFim);
    if (dto.observacao !== undefined) data.observacao = dto.observacao;

    return this.prisma.bandeiraTarifaria.update({
      where: { id },
      data,
    });
  }

  async remove(id: string, cooperativaId: string) {
    await this.findOne(id, cooperativaId);
    return this.prisma.bandeiraTarifaria.delete({ where: { id } });
  }
}
