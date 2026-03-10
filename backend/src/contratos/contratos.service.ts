import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma.service';

@Injectable()
export class ContratosService {
  constructor(private prisma: PrismaService) {}

  async findAll() {
    return this.prisma.contrato.findMany({
      include: { cooperado: true, uc: true, usina: true },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findOne(id: string) {
    return this.prisma.contrato.findUnique({
      where: { id },
      include: { cooperado: true, uc: true, usina: true },
    });
  }

  async findByCooperado(cooperadoId: string) {
    return this.prisma.contrato.findMany({
      where: { cooperadoId },
      include: { uc: true, usina: true },
      orderBy: { createdAt: 'desc' },
    });
  }

  async create(data: {
    numero: string;
    cooperadoId: string;
    ucId: string;
    usinaId: string;
    dataInicio: Date;
    dataFim?: Date;
    percentualDesconto: number;
  }) {
    return this.prisma.contrato.create({ data });
  }

  async update(id: string, data: Partial<{
    ucId: string;
    usinaId: string;
    dataInicio: Date;
    dataFim: Date;
    percentualDesconto: number;
    status: 'ATIVO' | 'SUSPENSO' | 'ENCERRADO';
  }>) {
    return this.prisma.contrato.update({ where: { id }, data });
  }

  async remove(id: string) {
    return this.prisma.contrato.delete({ where: { id } });
  }
}
