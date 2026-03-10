import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma.service';

@Injectable()
export class UsinasService {
  constructor(private prisma: PrismaService) {}

  async findAll() {
    return this.prisma.usina.findMany({
      orderBy: { createdAt: 'desc' },
    });
  }

  async findOne(id: string) {
    return this.prisma.usina.findUnique({
      where: { id },
    });
  }

  async create(data: {
    nome: string;
    potenciaKwp: number;
    cidade: string;
    estado: string;
  }) {
    return this.prisma.usina.create({ data });
  }

  async update(id: string, data: Partial<{
    nome: string;
    potenciaKwp: number;
    cidade: string;
    estado: string;
  }>) {
    return this.prisma.usina.update({ where: { id }, data });
  }

  async remove(id: string) {
    return this.prisma.usina.delete({ where: { id } });
  }
}