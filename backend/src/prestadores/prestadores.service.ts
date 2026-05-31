import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { CreatePrestadorDto } from './dto/create-prestador.dto';
import { UpdatePrestadorDto } from './dto/update-prestador.dto';

@Injectable()
export class PrestadoresService {
  constructor(private prisma: PrismaService) {}

  async findAll(cooperativaId?: string) {
    return this.prisma.prestador.findMany({
      where: cooperativaId ? { cooperativaId } : undefined,
      include: { cooperado: true },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findOne(id: string, cooperativaId?: string) {
    const prestador = await this.prisma.prestador.findUnique({
      where: { id },
      include: { cooperado: true },
    });
    if (!prestador) throw new NotFoundException(`Prestador com id ${id} não encontrado`);
    if (cooperativaId && prestador.cooperativaId !== cooperativaId) {
      throw new NotFoundException(`Prestador com id ${id} não encontrado`);
    }
    return prestador;
  }

  /**
   * D-novo-BR F0.3 MA3 (31/05/2026) — cooperativaId vem do JWT (controller),
   * não do body. cooperadoId (se informado) precisa pertencer ao tenant.
   */
  async create(data: CreatePrestadorDto, cooperativaId?: string | null) {
    if (cooperativaId && data.cooperadoId) {
      const coop = await this.prisma.cooperado.findFirst({
        where: { id: data.cooperadoId, cooperativaId },
        select: { id: true },
      });
      if (!coop) throw new NotFoundException('Cooperado não encontrado');
    }
    return this.prisma.prestador.create({
      data: { ...data, ...(cooperativaId ? { cooperativaId } : {}) },
    });
  }

  async update(id: string, data: UpdatePrestadorDto, cooperativaId?: string | null) {
    // D-novo-BR F0.3 AA7 — posse antes do update.
    if (cooperativaId) {
      const ok = await this.prisma.prestador.findFirst({
        where: { id, cooperativaId },
        select: { id: true },
      });
      if (!ok) throw new NotFoundException(`Prestador com id ${id} não encontrado`);
    }
    return this.prisma.prestador.update({ where: { id }, data });
  }

  async remove(id: string, cooperativaId?: string | null) {
    // D-novo-BR F0.3 AA8 — posse antes do delete.
    if (cooperativaId) {
      const ok = await this.prisma.prestador.findFirst({
        where: { id, cooperativaId },
        select: { id: true },
      });
      if (!ok) throw new NotFoundException(`Prestador com id ${id} não encontrado`);
    }
    return this.prisma.prestador.delete({ where: { id } });
  }
}
