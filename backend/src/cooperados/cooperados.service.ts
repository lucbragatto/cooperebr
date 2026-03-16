import { Injectable } from '@nestjs/common';
import { StatusCooperado } from '@prisma/client';
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
      include: {
        ucs: true,
        contratos: {
          include: {
            plano: true,
            uc: true,
            usina: true,
            cobrancas: { orderBy: { mesReferencia: 'desc' }, take: 12 },
          },
        },
        documentos: { orderBy: { createdAt: 'desc' } },
        ocorrencias: { orderBy: { createdAt: 'desc' }, take: 20 },
      },
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
    status: StatusCooperado;
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
