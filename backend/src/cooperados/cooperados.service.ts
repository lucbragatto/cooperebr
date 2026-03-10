import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma.service';

@Injectable()
export class CooperadosService {
  constructor(private prisma: PrismaService) {}

  async findAll() {
    return this.prisma.cooperado.findMany({
      orderBy: { createdAt: 'desc' },
    });
  }

  async findOne(id: string) {
    return this.prisma.cooperado.findUnique({
      where: { id },
    });
  }

  async create(data: {
    nomeCompleto: string;
    cpf: string;
    email: string;
    telefone?: string;
  }) {
    return this.prisma.cooperado.create({ data });
  }

  async update(id: string, data: Partial<{
    nomeCompleto: string;
    email: string;
    telefone: string;
  }>) {
    return this.prisma.cooperado.update({
      where: { id },
      data,
    });
  }

  async remove(id: string) {
    return this.prisma.cooperado.delete({
      where: { id },
    });
  }
}