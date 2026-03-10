import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma.service';

@Injectable()
export class UcsService {
  constructor(private prisma: PrismaService) {}

  async findAll() {
    return this.prisma.uc.findMany({
      include: { cooperado: true },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findOne(id: string) {
    return this.prisma.uc.findUnique({
      where: { id },
      include: { cooperado: true },
    });
  }

  async findByCooperado(cooperadoId: string) {
    return this.prisma.uc.findMany({
      where: { cooperadoId },
      orderBy: { createdAt: 'desc' },
    });
  }

  async create(data: {
    numero: string;
    endereco: string;
    cidade: string;
    estado: string;
    cooperadoId: string;
  }) {
    return this.prisma.uc.create({ data });
  }

  async update(id: string, data: Partial<{
    endereco: string;
    cidade: string;
    estado: string;
  }>) {
    return this.prisma.uc.update({ where: { id }, data });
  }

  async remove(id: string) {
    return this.prisma.uc.delete({ where: { id } });
  }
}